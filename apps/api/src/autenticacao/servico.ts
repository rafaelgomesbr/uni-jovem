import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { Config } from '../config.ts'
import type { Correio } from '../correio/correio.ts'
import { ErroHttp } from '../http.ts'
import {
  cifrar,
  decifrar,
  gastarTempoDeVerificacao,
  gerarCodigoNumerico,
  gerarToken,
  hashDeCodigo,
  hashDeSenha,
  hashDeToken,
  hmacDeToken,
  iguais,
  senhaConfere,
} from './cripto.ts'
import { emitirAcesso, emitirDesafio, verificarDesafio } from './jwt.ts'
import { MENSAGEM_DO_PROBLEMA, problemasDaSenha } from './senha.ts'
import { base32, gerarSegredoTotp, uriDeConfiguracao, verificarTotp } from './totp.ts'

/**
 * Regras de autenticação. Tudo aqui usa o pool `uj_auth` (identidade). Nenhuma
 * função devolve ou registra senha, token cru de terceiros, código ou segredo
 * de 2FA em log. Revisado em 14/11/2026 após revisão de segurança (D14).
 */

export type Plataforma = 'ios' | 'android' | 'web'

export interface DependenciasAuth {
  config: Config
  auth: pg.Pool
  correio: Correio
  /** Trabalho que roda depois da resposta (ex.: e-mail de recuperação). */
  emSegundoPlano: (trabalho: Promise<unknown>) => void
}

/** Erro da autenticação: um ErroHttp com nome próprio, para leitura de log. */
export class ErroDeAuth extends ErroHttp {
  constructor(codigo: string, status: number, mensagem: string) {
    super(codigo, status, mensagem)
    this.name = 'ErroDeAuth'
  }
}

const CREDENCIAIS = () =>
  new ErroDeAuth('credenciais_invalidas', 401, 'E-mail ou senha incorretos.')
const SESSAO_INVALIDA = () =>
  new ErroDeAuth('sessao_invalida', 401, 'Sua sessão terminou. Entre de novo.')
const CODIGO_2FA_INVALIDO = () =>
  new ErroDeAuth('codigo_invalido', 401, 'Código incorreto ou já usado.')
const BLOQUEIO_2FA = () =>
  new ErroDeAuth(
    'segundo_fator_bloqueado',
    429,
    'Muitos códigos errados. Por segurança, espere 15 minutos e tente de novo.',
  )

export const DURACAO_SESSAO_DIAS = 90
/** Teto absoluto de uma família de sessões (o aparelho), mesmo usada todo dia. */
export const VIDA_MAXIMA_DA_FAMILIA_DIAS = 365
const VALIDADE_RECUPERACAO_MIN = 30
const VALIDADE_CODIGO_MIN = 10
const TENTATIVAS_CODIGO = 5
const VALIDADE_PROVA_MIN = 10
/** Falhas de segundo fator por conta antes do bloqueio, e a duração do bloqueio. */
export const FALHAS_2FA_ANTES_DO_BLOQUEIO = 5
const BLOQUEIO_2FA_MIN = 15
/** Cotas diárias de e-mail (o plano gratuito do Resend tem teto de 100/dia). */
export const COTA_DIARIA = {
  convite: 60,
  porConvite: 15,
  recuperacao: 30,
} as const

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Para mostrar a quem tem o convite, sem revelar o endereço inteiro. */
export function mascararEmail(email: string): string {
  const [usuario = '', dominio = ''] = email.split('@')
  return `${usuario.slice(0, 1)}${'•'.repeat(Math.max(1, usuario.length - 1))}@${dominio}`
}

/** Marca curta da senha vigente (não reversível); muda quando a senha muda. */
function versaoDaSenha(senhaHash: string): string {
  return createHash('sha256').update(senhaHash).digest('base64url').slice(0, 16)
}

function exigirSenhaBoa(senha: string, dados: { nome?: string; email?: string }): void {
  const problemas = problemasDaSenha(senha, dados)
  if (problemas.length > 0) {
    throw new ErroDeAuth(
      'senha_fraca',
      422,
      problemas.map((p) => MENSAGEM_DO_PROBLEMA[p]).join(' '),
    )
  }
}

async function emTx<T>(pool: pg.Pool, trabalho: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect()
  try {
    await c.query('begin')
    const r = await trabalho(c)
    await c.query('commit')
    return r
  } catch (e) {
    await c.query('rollback').catch(() => undefined)
    throw e
  } finally {
    c.release()
  }
}

async function auditar(
  c: pg.PoolClient | pg.Pool,
  contaId: string | null,
  acao: string,
  detalhes: Record<string, unknown> = {},
): Promise<void> {
  await c.query('insert into uj.auditoria (conta_id, acao, detalhes) values ($1, $2, $3)', [
    contaId,
    acao,
    JSON.stringify(detalhes),
  ])
}

async function consumirCota(c: pg.PoolClient | pg.Pool, chave: string, limite: number) {
  const { rows } = await c.query<{ ok: boolean }>('select uj.consumir_cota($1, $2) as ok', [
    chave,
    limite,
  ])
  return rows[0]?.ok === true
}

// ------------------------------------------------------------ sessões

export interface SessaoAberta {
  acesso: string
  refresh: string
  sessaoId: string
  contaId: string
  segundoFator: false
}

async function abrirSessao(
  d: DependenciasAuth,
  c: pg.PoolClient | pg.Pool,
  contaId: string,
  opcoes: {
    aparelho: string | null
    plataforma: Plataforma
    familia?: string
    familiaCriadaEm?: Date
    mfaEm?: number | null
    prova?: string | null
  },
): Promise<SessaoAberta> {
  const refresh = gerarToken()
  const { rows } = await c.query<{ id: string }>(
    `insert into uj.sessoes (conta_id, familia, refresh_hash, aparelho, plataforma, expira_em,
                             familia_criada_em)
     values ($1, $2, $3, $4, $5, now() + make_interval(days => $6), coalesce($7, now()))
     returning id`,
    [
      contaId,
      opcoes.familia ?? randomUUID(),
      hashDeToken(refresh),
      opcoes.aparelho?.slice(0, 80) ?? null,
      opcoes.plataforma,
      DURACAO_SESSAO_DIAS,
      opcoes.familiaCriadaEm ?? null,
    ],
  )
  const sessaoId = rows[0]!.id
  const acesso = await emitirAcesso(d.config.JWT_SEGREDO, {
    contaId,
    sessaoId,
    mfaEm: opcoes.mfaEm ?? null,
    prova: opcoes.prova ?? null,
  })
  return { acesso, refresh, sessaoId, contaId, segundoFator: false }
}

/** Sessão válida para pedidos autenticados: não revogada, não vencida, conta ativa. */
export async function sessaoValida(
  d: Pick<DependenciasAuth, 'auth'>,
  sessaoId: string,
  contaId: string,
): Promise<boolean> {
  const { rows } = await d.auth.query(
    `select 1 from uj.sessoes s join uj.contas a on a.id = s.conta_id
      where s.id = $1 and s.conta_id = $2 and s.revogada_em is null
        and s.expira_em > now() and a.estado = 'ativa'`,
    [sessaoId, contaId],
  )
  return rows.length === 1
}

// ------------------------------------------------------------ entrar

export type ResultadoDeEntrada = SessaoAberta | { segundoFator: true; desafio: string }

export async function entrar(
  d: DependenciasAuth,
  pedido: { email: string; senha: string; aparelho: string | null; plataforma: Plataforma },
): Promise<ResultadoDeEntrada> {
  const { rows } = await d.auth.query<{
    id: string
    senha_hash: string | null
    estado: string
    totp_ativado_em: Date | null
  }>('select id, senha_hash, estado, totp_ativado_em from uj.contas where email = $1', [
    normalizarEmail(pedido.email),
  ])
  const conta = rows[0]
  if (!conta || !conta.senha_hash || conta.estado !== 'ativa') {
    await gastarTempoDeVerificacao(pedido.senha)
    throw CREDENCIAIS()
  }
  if (!(await senhaConfere(conta.senha_hash, pedido.senha))) throw CREDENCIAIS()

  if (conta.totp_ativado_em) {
    const desafio = await emitirDesafio(d.config.JWT_SEGREDO, {
      contaId: conta.id,
      aparelho: pedido.aparelho,
      plataforma: pedido.plataforma,
      versaoDaSenha: versaoDaSenha(conta.senha_hash),
    })
    return { segundoFator: true, desafio }
  }
  return abrirSessao(d, d.auth, conta.id, pedido)
}

// ------------------------------------------------------------ segundo fator

function hashDoCodigoDeRecuperacao(d: DependenciasAuth, contaId: string, codigo: string): Buffer {
  // HMAC com chave fora do banco: um backup vazado não permite força bruta offline.
  return createHmac('sha256', Buffer.from(d.config.TOTP_CHAVE, 'base64'))
    .update(`recuperacao:${contaId}:${codigo.replace(/[\s-]/g, '').toUpperCase()}`)
    .digest()
}

type ResultadoDoSegundoFator = 'ok' | 'falhou' | 'bloqueado'

/**
 * Confere TOTP ou código de recuperação, sem reuso, com contador de falhas POR
 * CONTA no banco (5 falhas = 15 min de bloqueio). A falha é gravada mesmo que
 * quem chama lance erro depois: por isso devolve o resultado em vez de lançar.
 */
async function conferirSegundoFator(
  d: DependenciasAuth,
  c: pg.PoolClient,
  contaId: string,
  codigo: string,
): Promise<ResultadoDoSegundoFator> {
  const { rows } = await c.query<{
    email: string
    totp_segredo_cifrado: Buffer | null
    totp_ativado_em: Date | null
    totp_ultimo_contador: string | null
    falhas_2fa: number
    bloqueado: boolean
  }>(
    `select email, totp_segredo_cifrado, totp_ativado_em, totp_ultimo_contador, falhas_2fa,
            coalesce(bloqueio_2fa_ate > now(), false) as bloqueado
       from uj.contas where id = $1 for update`,
    [contaId],
  )
  const conta = rows[0]
  if (!conta?.totp_segredo_cifrado || !conta.totp_ativado_em) return 'falhou'
  if (conta.bloqueado) return 'bloqueado'

  const limpo = codigo.replace(/\s/g, '')
  let certo = false
  if (/^\d{6}$/.test(limpo)) {
    const segredo = decifrar(
      Buffer.from(d.config.TOTP_CHAVE, 'base64'),
      conta.totp_segredo_cifrado,
      `totp:${contaId}`,
    )
    const ultimo = conta.totp_ultimo_contador === null ? null : Number(conta.totp_ultimo_contador)
    const aceito = verificarTotp(segredo, limpo, ultimo)
    if (aceito !== null) {
      await c.query('update uj.contas set totp_ultimo_contador = $2 where id = $1', [
        contaId,
        aceito,
      ])
      certo = true
    }
  } else {
    const r = await c.query(
      `update uj.codigos_recuperacao set usado_em = now()
        where conta_id = $1 and codigo_hash = $2 and usado_em is null`,
      [contaId, hashDoCodigoDeRecuperacao(d, contaId, limpo)],
    )
    if (r.rowCount === 1) {
      await auditar(c, contaId, 'conta.codigo_recuperacao_usado')
      certo = true
    }
  }

  if (certo) {
    if (conta.falhas_2fa > 0) {
      await c.query('update uj.contas set falhas_2fa = 0 where id = $1', [contaId])
    }
    return 'ok'
  }

  const falhas = conta.falhas_2fa + 1
  if (falhas >= FALHAS_2FA_ANTES_DO_BLOQUEIO) {
    await c.query(
      `update uj.contas set falhas_2fa = 0, bloqueio_2fa_ate = now() + make_interval(mins => $2)
        where id = $1`,
      [contaId, BLOQUEIO_2FA_MIN],
    )
    await auditar(c, contaId, 'conta.segundo_fator_bloqueado')
    d.emSegundoPlano(
      d.correio.enviar({
        para: conta.email,
        assunto: 'Alerta de segurança do Uni Jovem',
        corpo: [
          'Houve várias tentativas de código de verificação erradas na sua conta.',
          `Por segurança, a verificação em duas etapas ficou bloqueada por ${BLOQUEIO_2FA_MIN} minutos.`,
          '',
          'Se não foi você, alguém pode conhecer a sua senha: troque-a assim que puder,',
          'em Perfil > Segurança ou pela opção "Esqueci a senha".',
        ].join('\n'),
      }),
    )
  } else {
    await c.query('update uj.contas set falhas_2fa = $2 where id = $1', [contaId, falhas])
  }
  return 'falhou'
}

function lancarSeNaoOk(r: ResultadoDoSegundoFator): void {
  if (r === 'bloqueado') throw BLOQUEIO_2FA()
  if (r === 'falhou') throw CODIGO_2FA_INVALIDO()
}

/**
 * Prova de 2FA recente, gravada só como hash. Para o Criador ela habilita os
 * poderes de plataforma no banco; para as demais contas só serve ao aceite de
 * transferência de propriedade (uj.tem_prova_recente). Sem 2FA, não há prova.
 */
async function gravarProva(c: pg.PoolClient, contaId: string): Promise<string> {
  const prova = gerarToken()
  await c.query(
    `insert into uj.provas_de_plataforma (prova_hash, conta_id, expira_em)
     values ($1, $2, now() + make_interval(mins => $3))`,
    [hashDeToken(prova), contaId, VALIDADE_PROVA_MIN],
  )
  return prova
}

export async function concluirSegundoFator(
  d: DependenciasAuth,
  pedido: { desafio: string; codigo: string },
): Promise<SessaoAberta> {
  const desafio = await verificarDesafio(d.config.JWT_SEGREDO, pedido.desafio)
  if (!desafio) {
    throw new ErroDeAuth('desafio_invalido', 401, 'O tempo para o código acabou. Entre de novo.')
  }
  const r = await emTx(d.auth, async (c) => {
    const { rows } = await c.query<{ senha_hash: string | null; ativa: boolean }>(
      "select senha_hash, estado = 'ativa' as ativa from uj.contas where id = $1",
      [desafio.contaId],
    )
    const conta = rows[0]
    // Senha trocada depois do desafio (ou conta desativada): o desafio não vale mais.
    if (
      !conta?.ativa ||
      !conta.senha_hash ||
      versaoDaSenha(conta.senha_hash) !== desafio.versaoDaSenha
    ) {
      return { resultado: 'desafio_invalido' as const }
    }
    const resultado = await conferirSegundoFator(d, c, desafio.contaId, pedido.codigo)
    if (resultado !== 'ok') return { resultado }
    const prova = await gravarProva(c, desafio.contaId)
    const sessao = await abrirSessao(d, c, desafio.contaId, {
      aparelho: desafio.aparelho,
      plataforma: desafio.plataforma,
      mfaEm: Math.floor(Date.now() / 1000),
      prova,
    })
    return { resultado: 'ok' as const, sessao }
  })
  if (r.resultado === 'desafio_invalido') {
    throw new ErroDeAuth('desafio_invalido', 401, 'O tempo para o código acabou. Entre de novo.')
  }
  lancarSeNaoOk(r.resultado)
  return r.sessao!
}

/** Reprova o segundo fator numa sessão já aberta (antes de ações de plataforma). */
export async function provarSegundoFator(
  d: DependenciasAuth,
  pedido: { contaId: string; sessaoId: string; codigo: string },
): Promise<{ acesso: string }> {
  const r = await emTx(d.auth, async (c) => {
    const resultado = await conferirSegundoFator(d, c, pedido.contaId, pedido.codigo)
    if (resultado !== 'ok') return { resultado }
    const prova = await gravarProva(c, pedido.contaId)
    const acesso = await emitirAcesso(d.config.JWT_SEGREDO, {
      contaId: pedido.contaId,
      sessaoId: pedido.sessaoId,
      mfaEm: Math.floor(Date.now() / 1000),
      prova,
    })
    return { resultado, acesso }
  })
  lancarSeNaoOk(r.resultado)
  return { acesso: r.acesso! }
}

// ------------------------------------------------------------ renovar e sair

/**
 * Refresh rotativo. Um refresh já substituído que reaparece indica cópia do
 * token: a família inteira (o aparelho) é derrubada. O cliente deve renovar
 * uma vez por vez (fila única no app; Web Locks na web). Ver ADR 0003.
 */
export async function renovar(d: DependenciasAuth, refresh: string): Promise<SessaoAberta> {
  const resultado = await emTx(d.auth, async (c) => {
    const { rows } = await c.query<{
      id: string
      conta_id: string
      familia: string
      familia_criada_em: Date
      aparelho: string | null
      plataforma: Plataforma
      expirada: boolean
      velha_demais: boolean
      substituida_em: Date | null
      revogada_em: Date | null
      conta_ativa: boolean
    }>(
      `select s.id, s.conta_id, s.familia, s.familia_criada_em, s.aparelho, s.plataforma,
              s.substituida_em, s.revogada_em, s.expira_em <= now() as expirada,
              s.familia_criada_em <= now() - make_interval(days => $2) as velha_demais,
              a.estado = 'ativa' as conta_ativa
         from uj.sessoes s join uj.contas a on a.id = s.conta_id
        where s.refresh_hash = $1 for update of s`,
      [hashDeToken(refresh), VIDA_MAXIMA_DA_FAMILIA_DIAS],
    )
    const s = rows[0]
    if (!s || s.revogada_em || s.expirada || s.velha_demais || !s.conta_ativa) {
      return { tipo: 'invalida' as const }
    }
    if (s.substituida_em) {
      await c.query(
        `update uj.sessoes set revogada_em = now(), motivo_revogacao = 'reuso_de_refresh'
          where familia = $1 and revogada_em is null`,
        [s.familia],
      )
      await c.query('select uj.descartar_provas($1)', [s.conta_id])
      await auditar(c, s.conta_id, 'sessao.reuso_de_refresh', { familia: s.familia })
      return { tipo: 'reuso' as const }
    }
    await c.query(
      'update uj.sessoes set substituida_em = now(), ultimo_uso_em = now() where id = $1',
      [s.id],
    )
    const nova = await abrirSessao(d, c, s.conta_id, {
      aparelho: s.aparelho,
      plataforma: s.plataforma,
      familia: s.familia,
      familiaCriadaEm: s.familia_criada_em,
    })
    return { tipo: 'ok' as const, nova }
  })
  if (resultado.tipo !== 'ok') throw SESSAO_INVALIDA()
  return resultado.nova
}

/** Sai do aparelho: revoga a família da sessão e descarta as provas de 2FA. */
export async function sair(d: DependenciasAuth, sessaoId: string, contaId: string): Promise<void> {
  await emTx(d.auth, async (c) => {
    await c.query(
      `update uj.sessoes set revogada_em = now(), motivo_revogacao = 'saiu'
        where familia = (select familia from uj.sessoes where id = $1) and revogada_em is null`,
      [sessaoId],
    )
    await c.query('select uj.descartar_provas($1)', [contaId])
  })
}

// ------------------------------------------------------------ recuperação de senha

/**
 * Sempre "aceito": a resposta não revela se o e-mail tem conta. O trabalho
 * (procurar a conta, gravar o link, enviar) roda depois da resposta, para que
 * o tempo de resposta também não revele.
 */
export function pedirRecuperacao(d: DependenciasAuth, email: string): void {
  d.emSegundoPlano(
    (async () => {
      const token = gerarToken()
      const conta = await emTx(d.auth, async (c) => {
        const { rows } = await c.query<{ id: string; email: string }>(
          "select id, email from uj.contas where email = $1 and estado = 'ativa' and senha_hash is not null",
          [normalizarEmail(email)],
        )
        const a = rows[0]
        if (!a) return null
        if (!(await consumirCota(c, 'email:recuperacao', COTA_DIARIA.recuperacao))) return null
        await c.query(
          `update uj.recuperacoes_senha set usado_em = now()
            where conta_id = $1 and finalidade = 'senha' and usado_em is null`,
          [a.id],
        )
        await c.query(
          `insert into uj.recuperacoes_senha (conta_id, finalidade, token_hash, expira_em)
           values ($1, 'senha', $2, now() + make_interval(mins => $3))`,
          [a.id, hashDeToken(token), VALIDADE_RECUPERACAO_MIN],
        )
        return a
      })
      if (!conta) return
      const link = new URL(`/redefinir-senha#t=${token}`, d.config.URL_PUBLICA).toString()
      await d.correio.enviar({
        para: conta.email,
        assunto: 'Redefinição de senha do Uni Jovem',
        corpo: [
          'Recebemos um pedido para redefinir a senha da sua conta no Uni Jovem.',
          '',
          `Para criar uma senha nova, abra este link em até ${VALIDADE_RECUPERACAO_MIN} minutos:`,
          link,
          '',
          'Se não foi você, ignore esta mensagem. Sua senha atual continua valendo.',
        ].join('\n'),
      })
    })(),
  )
}

export async function redefinirSenha(
  d: DependenciasAuth,
  pedido: { token: string; senha: string },
): Promise<void> {
  await emTx(d.auth, async (c) => {
    const { rows } = await c.query<{ rid: string; conta_id: string; nome: string; email: string }>(
      `select r.id as rid, a.id as conta_id, a.nome, a.email
         from uj.recuperacoes_senha r join uj.contas a on a.id = r.conta_id
        where r.token_hash = $1 and r.finalidade = 'senha' and r.usado_em is null
          and r.expira_em > now() and a.estado = 'ativa'
        for update of r`,
      [hashDeToken(pedido.token)],
    )
    const r = rows[0]
    if (!r) {
      throw new ErroDeAuth(
        'link_invalido',
        401,
        'Este link não vale mais. Peça um novo na tela de recuperação.',
      )
    }
    exigirSenhaBoa(pedido.senha, r)
    await c.query('update uj.contas set senha_hash = $2 where id = $1', [
      r.conta_id,
      await hashDeSenha(pedido.senha),
    ])
    await c.query('update uj.recuperacoes_senha set usado_em = now() where id = $1', [r.rid])
    await c.query(
      `update uj.sessoes set revogada_em = now(), motivo_revogacao = 'senha_redefinida'
        where conta_id = $1 and revogada_em is null`,
      [r.conta_id],
    )
    await c.query('select uj.descartar_provas($1)', [r.conta_id])
    await auditar(c, r.conta_id, 'conta.senha_redefinida')
  })
}

// ------------------------------------------------------------ convites

export interface SituacaoDoConvite {
  situacao: 'valido' | 'expirado' | 'revogado' | 'usado' | 'indisponivel' | 'inexistente'
  comunidade?: { nome: string; cor: string }
  papel?: string
  emailDestinoMascarado?: string | null
}

function hmacDoConvite(d: DependenciasAuth, token: string): Buffer {
  return hmacDeToken(token, d.config.CONVITE_SEGREDO)
}

export async function consultarConvite(
  d: DependenciasAuth,
  token: string,
): Promise<SituacaoDoConvite> {
  const { rows } = await d.auth.query<{
    comunidade_nome: string
    comunidade_cor: string
    papel: string
    email_destino: string | null
    situacao: SituacaoDoConvite['situacao']
  }>('select * from uj.consultar_convite($1)', [hmacDoConvite(d, token)])
  const c = rows[0]
  if (!c) return { situacao: 'inexistente' }
  return {
    situacao: c.situacao,
    comunidade: { nome: c.comunidade_nome, cor: c.comunidade_cor },
    papel: c.papel,
    emailDestinoMascarado: c.email_destino ? mascararEmail(c.email_destino) : null,
  }
}

const MENSAGEM_DO_CONVITE: Record<string, string> = {
  UJ001: 'Este convite não vale mais. Peça um novo a quem convidou você.',
  UJ002: 'Este convite foi enviado para outro e-mail.',
  UJ003: 'Você já participa desta comunidade.',
  UJ004: 'Sua conta não está ativa.',
  UJ005: 'Este e-mail já tem conta. Entre com ela para aceitar o convite.',
}
const CODIGO_DO_CONVITE: Record<string, string> = {
  UJ001: 'convite_indisponivel',
  UJ002: 'convite_de_outro_email',
  UJ003: 'ja_participa',
  UJ004: 'conta_inativa',
  UJ005: 'conta_existente',
}

function traduzirErroDeConvite(e: unknown): never {
  const codigo = (e as { code?: string }).code
  if (codigo && MENSAGEM_DO_CONVITE[codigo]) {
    throw new ErroDeAuth(CODIGO_DO_CONVITE[codigo]!, 409, MENSAGEM_DO_CONVITE[codigo]!)
  }
  throw e
}

const COTA_ESGOTADA = () =>
  new ErroDeAuth(
    'cota_de_envio',
    429,
    'Muitos envios de e-mail hoje. Tente de novo amanhã ou peça ajuda a quem convidou você.',
  )

/**
 * Passo 1 da conta nova: confere o convite e manda o código ao e-mail.
 *
 * A resposta é a MESMA quando o e-mail já tem conta: nesse caso a mensagem
 * enviada diz "você já tem conta, entre para aceitar", e o identificador
 * devolvido não corresponde a nenhuma verificação. Assim o link de convite não
 * vira um verificador de quem tem conta.
 */
export async function iniciarCadastroPorConvite(
  d: DependenciasAuth,
  pedido: { token: string; nome: string; email: string; whatsapp: string | null },
): Promise<{ verificacaoId: string }> {
  const email = normalizarEmail(pedido.email)
  const primeiroNome = pedido.nome.trim().split(/\s+/)[0]
  const { rows } = await d.auth.query<{
    convite_id: string
    email_destino: string | null
    situacao: string
  }>('select convite_id, email_destino, situacao from uj.consultar_convite($1)', [
    hmacDoConvite(d, pedido.token),
  ])
  const convite = rows[0]
  if (!convite || convite.situacao !== 'valido') traduzirErroDeConvite({ code: 'UJ001' })
  // Quem tem o link já vê o e-mail mascarado do destino; confirmar a divergência não vaza nada novo.
  if (convite.email_destino && convite.email_destino !== email) {
    traduzirErroDeConvite({ code: 'UJ002' })
  }

  const cotasOk =
    (await consumirCota(d.auth, 'email:convite', COTA_DIARIA.convite)) &&
    (await consumirCota(d.auth, `email:convite:${convite.convite_id}`, COTA_DIARIA.porConvite))
  if (!cotasOk) throw COTA_ESGOTADA()

  const verificacaoId = randomUUID()
  const existe = await d.auth.query('select 1 from uj.contas where email = $1', [email])
  if (existe.rows.length > 0) {
    await d.correio.enviar({
      para: email,
      assunto: 'Seu convite para o Uni Jovem',
      corpo: [
        `Olá, ${primeiroNome}!`,
        '',
        'Você recebeu um convite, mas este e-mail já tem conta no Uni Jovem.',
        'Entre com a sua conta e abra o link do convite de novo para aceitar.',
        '',
        'Se você não pediu isto, ignore esta mensagem.',
      ].join('\n'),
      chaveDeIdempotencia: verificacaoId,
    })
    return { verificacaoId }
  }

  const codigo = gerarCodigoNumerico()
  await d.auth.query(
    `insert into uj.verificacoes_email (id, email, codigo_hash, finalidade, convite_id, expira_em)
     values ($1, $2, $3, 'convite', $4, now() + make_interval(mins => $5))`,
    [
      verificacaoId,
      email,
      hashDeCodigo(codigo, verificacaoId),
      convite.convite_id,
      VALIDADE_CODIGO_MIN,
    ],
  )
  await d.correio.enviar({
    para: email,
    // O código não vai no assunto: ele apareceria na notificação da tela bloqueada.
    assunto: 'Seu código de verificação do Uni Jovem',
    corpo: [
      `Olá, ${primeiroNome}!`,
      '',
      `Seu código de verificação é ${codigo}.`,
      `Ele vale por ${VALIDADE_CODIGO_MIN} minutos.`,
      '',
      'Se você não pediu este código, ignore esta mensagem.',
    ].join('\n'),
    chaveDeIdempotencia: verificacaoId,
  })
  return { verificacaoId }
}

/** Passo 2 da conta nova: confere o código, cria conta e vínculo, abre a sessão. */
export async function concluirCadastroPorConvite(
  d: DependenciasAuth,
  pedido: {
    token: string
    verificacaoId: string
    codigo: string
    nome: string
    whatsapp: string | null
    senha: string
    aparelho: string | null
    plataforma: Plataforma
  },
): Promise<SessaoAberta> {
  // Primeiro o código, numa transação curta (a tentativa errada precisa ficar gravada).
  const email = await emTx(d.auth, async (c) => {
    const { rows } = await c.query<{
      email: string
      codigo_hash: Buffer
      tentativas: number
      vencida: boolean
      consumido_em: Date | null
    }>(
      `select email, codigo_hash, tentativas, expira_em <= now() as vencida, consumido_em
         from uj.verificacoes_email where id = $1 and finalidade = 'convite' for update`,
      [pedido.verificacaoId],
    )
    const v = rows[0]
    if (!v || v.consumido_em || v.vencida || v.tentativas >= TENTATIVAS_CODIGO) return null
    if (!iguais(v.codigo_hash, hashDeCodigo(pedido.codigo.trim(), pedido.verificacaoId))) {
      await c.query('update uj.verificacoes_email set tentativas = tentativas + 1 where id = $1', [
        pedido.verificacaoId,
      ])
      return 'errado' as const
    }
    return v.email
  })
  if (email === null) {
    throw new ErroDeAuth('codigo_vencido', 410, 'Este código venceu. Peça um novo.')
  }
  if (email === 'errado') {
    throw new ErroDeAuth(
      'codigo_invalido',
      422,
      'Código incorreto. Confira o e-mail e tente de novo.',
    )
  }

  exigirSenhaBoa(pedido.senha, { nome: pedido.nome, email })
  const senhaHash = await hashDeSenha(pedido.senha)

  return emTx(d.auth, async (c) => {
    const consumida = await c.query<{ convite_id: string }>(
      `update uj.verificacoes_email set consumido_em = now()
        where id = $1 and consumido_em is null returning convite_id`,
      [pedido.verificacaoId],
    )
    if (consumida.rowCount !== 1) {
      throw new ErroDeAuth('codigo_vencido', 410, 'Este código já foi usado. Peça um novo.')
    }
    // O e-mail foi verificado para ESTE convite; outro token não aproveita a verificação.
    const doToken = await c.query<{ convite_id: string }>(
      'select convite_id from uj.consultar_convite($1)',
      [hmacDoConvite(d, pedido.token)],
    )
    if (doToken.rows[0]?.convite_id !== consumida.rows[0]!.convite_id) {
      traduzirErroDeConvite({ code: 'UJ001' })
    }
    let contaId: string
    try {
      const { rows } = await c.query<{ conta_id: string }>(
        'select conta_id from uj.criar_conta_por_convite($1, $2, $3, $4, $5)',
        [hmacDoConvite(d, pedido.token), pedido.nome, email, pedido.whatsapp, senhaHash],
      )
      contaId = rows[0]!.conta_id
    } catch (e) {
      traduzirErroDeConvite(e)
    }
    return abrirSessao(d, c, contaId, { aparelho: pedido.aparelho, plataforma: pedido.plataforma })
  })
}

/** Conta existente aceita o convite (já autenticada). */
export async function aceitarConviteComConta(
  d: DependenciasAuth,
  contaId: string,
  token: string,
): Promise<{ vinculoId: string }> {
  try {
    const { rows } = await d.auth.query<{ v: string }>('select uj.aceitar_convite($1, $2) as v', [
      hmacDoConvite(d, token),
      contaId,
    ])
    return { vinculoId: rows[0]!.v }
  } catch (e) {
    traduzirErroDeConvite(e)
  }
}

// ------------------------------------------------------------ 2FA (TOTP)

function chaveTotp(d: DependenciasAuth): Buffer {
  return Buffer.from(d.config.TOTP_CHAVE, 'base64')
}

/**
 * Gera o segredo (ainda não ativado) e devolve o que o autenticador lê. Exige
 * a senha atual: uma sessão roubada não consegue trancar a dona fora da conta
 * cadastrando o autenticador de outra pessoa.
 */
export async function iniciarTotp(
  d: DependenciasAuth,
  contaId: string,
  senhaAtual: string,
): Promise<{ uri: string; segredo: string }> {
  const { rows } = await d.auth.query<{
    email: string
    senha_hash: string | null
    totp_ativado_em: Date | null
  }>('select email, senha_hash, totp_ativado_em from uj.contas where id = $1', [contaId])
  const conta = rows[0]
  if (!conta?.senha_hash) throw SESSAO_INVALIDA()
  if (!(await senhaConfere(conta.senha_hash, senhaAtual))) {
    throw new ErroDeAuth('senha_incorreta', 401, 'Senha atual incorreta.')
  }
  if (conta.totp_ativado_em) {
    throw new ErroDeAuth('totp_ja_ativo', 409, 'A verificação em duas etapas já está ativa.')
  }
  const segredo = gerarSegredoTotp()
  await d.auth.query('update uj.contas set totp_segredo_cifrado = $2 where id = $1', [
    contaId,
    cifrar(chaveTotp(d), segredo, `totp:${contaId}`),
  ])
  return { uri: uriDeConfiguracao(segredo, conta.email, 'Uni Jovem'), segredo }
}

function gerarCodigosDeRecuperacao(): string[] {
  return Array.from({ length: 10 }, () => {
    const s = base32(randomBytes(5))
    return `${s.slice(0, 4)}-${s.slice(4, 8)}`
  })
}

async function gravarCodigosDeRecuperacao(
  d: DependenciasAuth,
  c: pg.PoolClient,
  contaId: string,
): Promise<string[]> {
  const codigos = gerarCodigosDeRecuperacao()
  await c.query('delete from uj.codigos_recuperacao where conta_id = $1', [contaId])
  for (const codigo of codigos) {
    await c.query('insert into uj.codigos_recuperacao (conta_id, codigo_hash) values ($1, $2)', [
      contaId,
      hashDoCodigoDeRecuperacao(d, contaId, codigo),
    ])
  }
  return codigos
}

/** Confirma com um código do autenticador; devolve os códigos de recuperação (uma vez). */
export async function confirmarTotp(
  d: DependenciasAuth,
  contaId: string,
  codigo: string,
): Promise<{ codigosDeRecuperacao: string[] }> {
  return emTx(d.auth, async (c) => {
    const { rows } = await c.query<{
      totp_segredo_cifrado: Buffer | null
      totp_ativado_em: Date | null
    }>('select totp_segredo_cifrado, totp_ativado_em from uj.contas where id = $1 for update', [
      contaId,
    ])
    const conta = rows[0]
    if (!conta?.totp_segredo_cifrado || conta.totp_ativado_em) {
      throw new ErroDeAuth('totp_nao_iniciado', 409, 'Comece a configuração de novo.')
    }
    const segredo = decifrar(chaveTotp(d), conta.totp_segredo_cifrado, `totp:${contaId}`)
    const aceito = verificarTotp(segredo, codigo.trim(), null)
    if (aceito === null) {
      throw new ErroDeAuth(
        'codigo_invalido',
        422,
        'Código incorreto. Confira o relógio do celular.',
      )
    }
    await c.query(
      'update uj.contas set totp_ativado_em = now(), totp_ultimo_contador = $2 where id = $1',
      [contaId, aceito],
    )
    const codigos = await gravarCodigosDeRecuperacao(d, c, contaId)
    await auditar(c, contaId, 'conta.totp_ativado')
    return { codigosDeRecuperacao: codigos }
  })
}

// ------------------------------------------------------------ primeiro acesso do Criador

/**
 * O comando `criador:iniciar` cria a conta proprietária sem senha e um link de
 * uso único (finalidade 'primeiro_acesso'). O primeiro acesso define senha E
 * 2FA juntos: a conta proprietária nunca existe com senha e sem 2FA (CHECK).
 */
export async function iniciarPrimeiroAcesso(
  d: DependenciasAuth,
  token: string,
): Promise<{ uri: string; segredo: string }> {
  return emTx(d.auth, async (c) => {
    const conta = await contaDoPrimeiroAcesso(c, token)
    const segredo = gerarSegredoTotp()
    await c.query('update uj.contas set totp_segredo_cifrado = $2 where id = $1', [
      conta.id,
      cifrar(chaveTotp(d), segredo, `totp:${conta.id}`),
    ])
    return { uri: uriDeConfiguracao(segredo, conta.email, 'Uni Jovem'), segredo }
  })
}

async function contaDoPrimeiroAcesso(
  c: pg.PoolClient,
  token: string,
): Promise<{ id: string; email: string; nome: string; rid: string }> {
  const { rows } = await c.query<{ id: string; email: string; nome: string; rid: string }>(
    `select a.id, a.email, a.nome, r.id as rid
       from uj.recuperacoes_senha r join uj.contas a on a.id = r.conta_id
      where r.token_hash = $1 and r.finalidade = 'primeiro_acesso' and r.usado_em is null
        and r.expira_em > now()
        and a.plataforma_proprietario and a.senha_hash is null and a.estado = 'ativa'
      for update of r`,
    [hashDeToken(token)],
  )
  const conta = rows[0]
  if (!conta) {
    throw new ErroDeAuth('link_invalido', 401, 'Este link não vale mais. Gere outro no servidor.')
  }
  return conta
}

export async function concluirPrimeiroAcesso(
  d: DependenciasAuth,
  pedido: { token: string; senha: string; codigo: string },
): Promise<{ codigosDeRecuperacao: string[] }> {
  return emTx(d.auth, async (c) => {
    const conta = await contaDoPrimeiroAcesso(c, pedido.token)
    exigirSenhaBoa(pedido.senha, conta)
    const { rows } = await c.query<{ totp_segredo_cifrado: Buffer | null }>(
      'select totp_segredo_cifrado from uj.contas where id = $1 for update',
      [conta.id],
    )
    const cifrado = rows[0]?.totp_segredo_cifrado
    if (!cifrado) throw new ErroDeAuth('totp_nao_iniciado', 409, 'Comece a configuração de novo.')
    const aceito = verificarTotp(
      decifrar(chaveTotp(d), cifrado, `totp:${conta.id}`),
      pedido.codigo.trim(),
      null,
    )
    if (aceito === null) {
      throw new ErroDeAuth(
        'codigo_invalido',
        422,
        'Código incorreto. Confira o relógio do celular.',
      )
    }
    await c.query(
      `update uj.contas set senha_hash = $2, totp_ativado_em = now(), totp_ultimo_contador = $3
        where id = $1`,
      [conta.id, await hashDeSenha(pedido.senha), aceito],
    )
    await c.query('update uj.recuperacoes_senha set usado_em = now() where id = $1', [conta.rid])
    const codigos = await gravarCodigosDeRecuperacao(d, c, conta.id)
    await auditar(c, conta.id, 'criador.primeiro_acesso')
    return { codigosDeRecuperacao: codigos }
  })
}
