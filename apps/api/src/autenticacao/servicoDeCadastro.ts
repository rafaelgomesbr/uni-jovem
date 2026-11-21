import { NOME_DO_APP } from '@uj/dominio'
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import {
  MENSAGEM_SEM_RESPONSAVEL,
  VERSAO_DO_TEXTO,
  type FaixaEtaria,
} from '../privacidade/consentimentos.ts'
import {
  gerarCodigoNumerico,
  gerarToken,
  hashDeCodigo,
  hashDeSenha,
  hashDeToken,
  hmacDeToken,
  iguais,
} from './cripto.ts'
import { NOME_DO_PROVEDOR, type IdentidadeDoProvedor, type Provedor } from './provedores.ts'
import {
  abrirSessao,
  auditar,
  cotaDeEmail,
  emTx,
  ErroDeAuth,
  exigirSenhaBoa,
  MENOR_DE_16,
  normalizarEmail,
  traduzirErroDeConvite,
  TENTATIVAS_CODIGO,
  VALIDADE_CODIGO_MIN,
  type DependenciasAuth,
  type Plataforma,
  type SessaoAberta,
} from './servico.ts'

/**
 * Conta aberta (ADR 0007, `PoliticaDeConta = 'cadastro_publico'`): por e-mail
 * com o código de 6 dígitos (o mesmo do convite: 10 minutos, 5 tentativas) ou
 * por Google e Apple, com a declaração de idade (TC-01, 16 anos ou mais, D27)
 * e o aceite dos Termos e da Política (TC-02). A conta nasce sem vínculo.
 *
 * Nada aqui revela se um e-mail tem conta antes da prova de posse: o primeiro
 * passo do e-mail responde igual e manda o código para os dois casos; só quem
 * digitou o código certo fica sabendo que o e-mail já tinha conta.
 */

/** Aceites da tela de cadastro (TC-02; 16 e 17 anos, a ciência do responsável). */
export interface Aceites {
  termos: true
  responsavelCiente?: boolean | undefined
}

export const CADASTRO_INDISPONIVEL = () =>
  new ErroDeAuth(
    'cadastro_indisponivel',
    503,
    'O cadastro por e-mail está indisponível agora. Use Google ou Apple.',
  )

export const CONTA_EXISTENTE = () =>
  new ErroDeAuth(
    'conta_existente',
    409,
    'Este e-mail já tem conta. Entre com ele ou toque em "Esqueci a senha" para criar uma senha nova.',
  )

const COTA_DO_CADASTRO = () =>
  new ErroDeAuth(
    'cota_de_envio',
    429,
    'Muitos cadastros por e-mail hoje. Tente de novo amanhã ou entre com Google ou Apple.',
  )

/** Validade do token de cadastro por Google ou Apple (ADR 0007). */
export const VALIDADE_DO_CADASTRO_POR_PROVEDOR_MIN = 15

function conferirIdade(faixa: FaixaEtaria | 'menos_16', aceites: Aceites): FaixaEtaria {
  // TC-01: menos de 16 para aqui, sem gravar nada (D27).
  if (faixa === 'menos_16') throw MENOR_DE_16()
  if (faixa === '16_17' && aceites.responsavelCiente !== true) {
    throw new ErroDeAuth('responsavel_necessario', 422, MENSAGEM_SEM_RESPONSAVEL)
  }
  return faixa
}

/** Idade (TC-01) e Termos e Política (TC-02), na mesma transação da conta nova. */
async function registrarAceitesDaConta(
  c: pg.PoolClient,
  contaId: string,
  faixa: FaixaEtaria,
  forma: Plataforma,
): Promise<void> {
  await c.query('select uj.declarar_faixa_etaria($1, $2, $3, $4)', [
    contaId,
    faixa,
    VERSAO_DO_TEXTO['TC-01'],
    forma,
  ])
  await c.query("select uj.registrar_consentimento($1, null, null, 'TC-02', $2, $3, null, null)", [
    contaId,
    VERSAO_DO_TEXTO['TC-02'],
    forma,
  ])
}

/** Cadastro temporariamente sem código de e-mail, autorizado em 17/11/2026. */
export async function criarCadastroSimplificado(
  d: DependenciasAuth,
  pedido: {
    nome: string
    email: string
    senha: string
    faixaEtaria: FaixaEtaria | 'menos_16'
    aceites: Aceites
    plataforma: Plataforma
    aparelho: string | null
    token?: string
    whatsapp?: string | null
  },
): Promise<SessaoAberta> {
  const faixa = conferirIdade(pedido.faixaEtaria, pedido.aceites)
  const email = normalizarEmail(pedido.email)
  exigirSenhaBoa(pedido.senha, { nome: pedido.nome, email })
  const senhaHash = await hashDeSenha(pedido.senha)
  return emTx(d.auth, async (c) => {
    let contaId: string
    try {
      const r = await c.query<{ id: string }>(
        'select uj.criar_conta_sem_confirmacao($1, $2, $3, $4) as id',
        [pedido.nome, email, senhaHash, pedido.whatsapp ?? null],
      )
      contaId = r.rows[0]!.id
    } catch (erro) {
      if ((erro as { code?: string }).code === 'UJ005') throw CONTA_EXISTENTE()
      throw erro
    }
    await registrarAceitesDaConta(c, contaId, faixa, pedido.plataforma)
    if (pedido.token) {
      let vinculoId: string
      try {
        const r = await c.query<{ id: string }>('select uj.aceitar_convite($1, $2) as id', [
          hmacDeToken(pedido.token, d.config.CONVITE_SEGREDO),
          contaId,
        ])
        vinculoId = r.rows[0]!.id
      } catch (erro) {
        traduzirErroDeConvite(erro)
      }
      await c.query("select uj.registrar_consentimento($1, null, $2, 'TC-03', $3, $4, null, $5)", [
        contaId,
        vinculoId,
        VERSAO_DO_TEXTO['TC-03'],
        pedido.plataforma,
        faixa === '16_17' ? true : null,
      ])
    }
    await auditar(c, contaId, 'conta.criada', {
      origem: pedido.token ? 'convite_sem_confirmacao' : 'senha_sem_confirmacao',
    })
    return abrirSessao(d, c, contaId, pedido)
  })
}

// ------------------------------------------------------------ cadastro por e-mail

/**
 * Passo 1: guarda nome e idade e manda o código. A resposta é a mesma para
 * e-mail novo ou com conta (no segundo caso, a mensagem também avisa que a
 * conta existe). Um pedido novo invalida o código anterior do mesmo e-mail.
 */
export async function iniciarCadastro(
  d: DependenciasAuth,
  pedido: { nome: string; email: string; faixaEtaria: FaixaEtaria | 'menos_16'; aceites: Aceites },
): Promise<void> {
  const faixa = conferirIdade(pedido.faixaEtaria, pedido.aceites)
  if (d.correio.modo === 'desligado') throw CADASTRO_INDISPONIVEL()
  const email = normalizarEmail(pedido.email)
  const primeiroNome = pedido.nome.trim().split(/\s+/)[0]
  const verificacaoId = randomUUID()
  const codigo = gerarCodigoNumerico()

  const jaTemConta = await emTx(d.auth, async (c) => {
    if (!(await cotaDeEmail(c, 'select uj.cota_email_cadastro() as ok'))) throw COTA_DO_CADASTRO()
    await c.query(
      `update uj.verificacoes_email set consumido_em = now()
        where email = $1 and finalidade = 'cadastro' and consumido_em is null`,
      [email],
    )
    await c.query(
      `insert into uj.verificacoes_email
         (id, email, codigo_hash, finalidade, nome, faixa_etaria, responsavel_ciente, expira_em)
       values ($1, $2, $3, 'cadastro', $4, $5, $6, now() + make_interval(mins => $7))`,
      [
        verificacaoId,
        email,
        hashDeCodigo(codigo, verificacaoId),
        pedido.nome.trim(),
        faixa,
        faixa === '16_17' ? true : null,
        VALIDADE_CODIGO_MIN,
      ],
    )
    const { rows } = await c.query('select 1 from uj.contas where email = $1', [email])
    return rows.length > 0
  })

  await d.correio.enviar({
    para: email,
    // O código não vai no assunto: ele apareceria na notificação da tela bloqueada.
    assunto: `Seu código de verificação do ${NOME_DO_APP}`,
    corpo: [
      `Olá, ${primeiroNome}!`,
      '',
      `Seu código de verificação é ${codigo}.`,
      `Ele vale por ${VALIDADE_CODIGO_MIN} minutos.`,
      ...(jaTemConta
        ? [
            '',
            `Este e-mail já tem conta no ${NOME_DO_APP}. Se você esqueceu a senha, use`,
            '"Esqueci a senha" na tela Entrar.',
          ]
        : []),
      '',
      'Se você não pediu este código, ignore esta mensagem.',
    ].join('\n'),
    chaveDeIdempotencia: verificacaoId,
  })
}

/**
 * Passo 2: confere o código (o mais recente do e-mail) e cria a conta, sem
 * vínculo, com e-mail verificado. Só depois do código certo a pessoa fica
 * sabendo que o e-mail já tinha conta.
 */
export async function concluirCadastro(
  d: DependenciasAuth,
  pedido: {
    email: string
    codigo: string
    senha: string
    aparelho: string | null
    plataforma: Plataforma
  },
): Promise<SessaoAberta> {
  const email = normalizarEmail(pedido.email)
  const verificacao = await emTx(d.auth, async (c) => {
    const { rows } = await c.query<{
      id: string
      codigo_hash: Buffer
      tentativas: number
      vencida: boolean
      nome: string
      faixa_etaria: FaixaEtaria
    }>(
      `select id, codigo_hash, tentativas, expira_em <= now() as vencida, nome, faixa_etaria
         from uj.verificacoes_email
        where email = $1 and finalidade = 'cadastro' and consumido_em is null
        order by criado_em desc limit 1
        for update`,
      [email],
    )
    const v = rows[0]
    if (!v || v.vencida || v.tentativas >= TENTATIVAS_CODIGO) return null
    if (!iguais(v.codigo_hash, hashDeCodigo(pedido.codigo.trim(), v.id))) {
      await c.query('update uj.verificacoes_email set tentativas = tentativas + 1 where id = $1', [
        v.id,
      ])
      return 'errado' as const
    }
    return v
  })
  if (verificacao === null) {
    throw new ErroDeAuth('codigo_vencido', 410, 'Este código venceu. Peça um novo.')
  }
  if (verificacao === 'errado') {
    throw new ErroDeAuth(
      'codigo_invalido',
      422,
      'Código incorreto. Confira o e-mail e tente de novo.',
    )
  }

  exigirSenhaBoa(pedido.senha, { nome: verificacao.nome, email })
  const senhaHash = await hashDeSenha(pedido.senha)

  return emTx(d.auth, async (c) => {
    const consumida = await c.query(
      `update uj.verificacoes_email set consumido_em = now()
        where id = $1 and consumido_em is null`,
      [verificacao.id],
    )
    if (consumida.rowCount !== 1) {
      throw new ErroDeAuth('codigo_vencido', 410, 'Este código já foi usado. Peça um novo.')
    }
    let contaId: string
    try {
      const { rows } = await c.query<{ id: string }>(
        'select uj.criar_conta_aberta($1, $2, $3) as id',
        [verificacao.nome, email, senhaHash],
      )
      contaId = rows[0]!.id
    } catch (e) {
      if ((e as { code?: string }).code === 'UJ005') throw CONTA_EXISTENTE()
      throw e
    }
    await registrarAceitesDaConta(c, contaId, verificacao.faixa_etaria, pedido.plataforma)
    await auditar(c, contaId, 'conta.criada', { origem: 'email' })
    return abrirSessao(d, c, contaId, { aparelho: pedido.aparelho, plataforma: pedido.plataforma })
  })
}

// ------------------------------------------------------------ cadastro por Google e Apple

export interface CadastroPendente {
  cadastroPendente: true
  tokenDeCadastro: string
  nome: string | null
  email: string
}

/**
 * Google ou Apple sem conta: guarda a identidade conferida (só o SHA-256 do
 * token de cadastro, 15 minutos, uso único) e devolve o token para a tela de
 * idade e aceites. Sem e-mail verificado pelo provedor, não dá para criar.
 */
export async function abrirCadastroPorProvedor(
  d: DependenciasAuth,
  id: IdentidadeDoProvedor,
  pedido: { nome: string | null; aparelho: string | null; plataforma: Plataforma },
): Promise<CadastroPendente> {
  if (!id.email || !id.emailVerificado) {
    throw new ErroDeAuth(
      'email_do_provedor_ausente',
      422,
      `A conta ${NOME_DO_PROVEDOR[id.provedor]} não informou um e-mail confirmado. ` +
        'Crie a conta com e-mail e senha.',
    )
  }
  const token = gerarToken()
  const nome = pedido.nome?.trim().slice(0, 120) || null
  await emTx(d.auth, async (c) => {
    // Limpeza de passagem: o que venceu há mais de um dia não serve para nada.
    await c.query(
      "delete from uj.cadastros_por_provedor where expira_em < now() - interval '1 day'",
    )
    await c.query(
      `insert into uj.cadastros_por_provedor
         (token_hash, provedor, sub, email, nome, aparelho, plataforma, expira_em)
       values ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8))`,
      [
        hashDeToken(token),
        id.provedor,
        id.sub,
        id.email,
        nome,
        pedido.aparelho?.slice(0, 80) ?? null,
        pedido.plataforma,
        VALIDADE_DO_CADASTRO_POR_PROVEDOR_MIN,
      ],
    )
  })
  return { cadastroPendente: true, tokenDeCadastro: token, nome, email: id.email }
}

const TOKEN_DE_CADASTRO_INVALIDO = () =>
  new ErroDeAuth(
    'token_de_cadastro_invalido',
    410,
    'O tempo para concluir o cadastro acabou. Entre de novo com Google ou Apple.',
  )

/** Nome da conta nova quando o provedor não informou nenhum. */
function nomeDeReserva(email: string, provedor: Provedor, nome: string | null): string {
  if (nome) return nome
  const usuario = email.split('@')[0] ?? ''
  // E-mail de retransmissão da Apple não tem nada de nome: a pessoa troca no Perfil.
  if (provedor === 'apple' && email.endsWith('@privaterelay.appleid.com')) return 'Participante'
  return usuario.slice(0, 120) || 'Participante'
}

/**
 * Conclui o cadastro por Google ou Apple: idade (TC-01) e aceites (TC-02)
 * antes de qualquer gravação. Menos de 16 anos é recusado sem gravar nada e
 * sem gastar o token. A conta nasce com e-mail verificado e o vínculo do
 * provedor; a sessão abre com o aparelho e a plataforma do primeiro passo.
 */
export async function concluirCadastroPorProvedor(
  d: DependenciasAuth,
  pedido: {
    tokenDeCadastro: string
    faixaEtaria: FaixaEtaria | 'menos_16'
    aceites: Aceites
    nome: string | null
  },
): Promise<{ sessao: SessaoAberta; plataforma: Plataforma }> {
  const faixa = conferirIdade(pedido.faixaEtaria, pedido.aceites)
  return emTx(d.auth, async (c) => {
    const { rows } = await c.query<{
      provedor: Provedor
      sub: string
      email: string
      nome: string | null
      aparelho: string | null
      plataforma: Plataforma
    }>(
      `update uj.cadastros_por_provedor set usado_em = now()
        where token_hash = $1 and usado_em is null and expira_em > now()
        returning provedor, sub, email, nome, aparelho, plataforma`,
      [hashDeToken(pedido.tokenDeCadastro)],
    )
    const pendente = rows[0]
    if (!pendente) throw TOKEN_DE_CADASTRO_INVALIDO()
    const nome = nomeDeReserva(
      pendente.email,
      pendente.provedor,
      pedido.nome?.trim().slice(0, 120) || pendente.nome,
    )
    let contaId: string
    try {
      const r = await c.query<{ id: string }>(
        'select uj.criar_conta_por_provedor($1, $2, $3, $4) as id',
        [nome, pendente.email, pendente.provedor, pendente.sub],
      )
      contaId = r.rows[0]!.id
    } catch (e) {
      const codigo = (e as { code?: string }).code
      if (codigo === 'UJ005' || codigo === 'UJ006') throw CONTA_EXISTENTE()
      throw e
    }
    await registrarAceitesDaConta(c, contaId, faixa, pendente.plataforma)
    await auditar(c, contaId, 'conta.criada', { origem: pendente.provedor })
    const sessao = await abrirSessao(d, c, contaId, {
      aparelho: pendente.aparelho,
      plataforma: pendente.plataforma,
    })
    return { sessao, plataforma: pendente.plataforma }
  })
}
