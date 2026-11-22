import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import {
  ehCodigoDaComunidade,
  LIMITES_DA_BUSCA,
  LIMITES_DE_PEDIDOS,
  MODO_DE_ENTRADA_PADRAO,
  normalizarCodigoDaComunidade,
  podeCriarComunidade,
  POLITICAS,
} from '@uj/dominio'
import {
  codigoDaSemente,
  hmacDoCodigo,
  linkDoCodigo,
  sortearCodigo,
} from '../autenticacao/codigoDaComunidade.ts'
import { Limitador, truncarIp } from '../autenticacao/limitador.ts'
import { MENOR_DE_16 } from '../autenticacao/servico.ts'
import { emTransacao } from '../banco/contexto.ts'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import {
  MENSAGEM_SEM_CONSENTIMENTO_DE_FE_NA_ENTRADA,
  MENSAGEM_SEM_RESPONSAVEL,
  MENSAGEM_SEM_TERMO_DO_ADMIN,
  VERSAO_DO_TEXTO,
} from '../privacidade/consentimentos.ts'
import { faixaEtaria, marcado } from './autenticacao.ts'
import { fusoValido, type DependenciasComunidades } from './comunidades.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * App aberto (ADR 0007): criar comunidade, buscar as encontráveis, entrar por
 * código, pedir para entrar, acompanhar e decidir os pedidos, o código da
 * comunidade e a denúncia de comunidade.
 *
 * Quem ainda não é da comunidade nunca lê as tabelas dela: tudo o que cruza a
 * fronteira passa por funções do banco (0022_app_aberto.sql) que devolvem só
 * o necessário. As rotas `/api/v1/c/:comunidadeId/...` daqui estão no
 * inventário de isolamento, como todas as outras.
 */

const FUSO_PADRAO = 'America/Sao_Paulo'
const cor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Escolha uma cor da lista.')
const cidade = z.string().trim().min(2, 'Confira a cidade: tem poucos caracteres.').max(80)
const mensagemDoPedido = z
  .string()
  .trim()
  .max(
    LIMITES_DE_PEDIDOS.caracteresDaMensagem,
    `Encurte a mensagem: até ${LIMITES_DE_PEDIDOS.caracteresDaMensagem} caracteres.`,
  )
const ID_PUBLICO = /^[0-9a-f]{32}$/

/** Idade e consentimento sobre a fé (TC-03) para entrar numa comunidade. */
const corpoDaEntrada = {
  mensagem: mensagemDoPedido.nullish(),
  consentimentoFe: marcado(MENSAGEM_SEM_CONSENTIMENTO_DE_FE_NA_ENTRADA),
  // Só a conta que ainda não declarou a idade precisa mandar.
  faixaEtaria: faixaEtaria.optional(),
  responsavelCiente: z.boolean().default(false),
}

const MENSAGEM_DO_BANCO: Record<string, [string, number, string]> = {
  UJ003: ['ja_participa', 409, 'Você já participa desta comunidade.'],
  UJ004: ['sessao_invalida', 401, 'Sua sessão terminou. Entre de novo.'],
  UJ083: [
    'nao_encontrado',
    404,
    'Não encontramos esta comunidade. Confira o código com quem passou para você.',
  ],
  UJ084: [
    'limite_de_pedidos',
    409,
    `Você já tem ${LIMITES_DE_PEDIDOS.pendentesPorConta} pedidos de entrada esperando resposta. Espere uma resposta ou desista de um deles em "Meus pedidos".`,
  ],
  UJ085: [
    'pedido_recusado_recentemente',
    409,
    `Seu pedido para esta comunidade não foi aprovado há pouco tempo. Você pode pedir de novo ${LIMITES_DE_PEDIDOS.diasDepoisDeRecusa} dias depois da resposta.`,
  ],
  UJ086: [
    'faixa_etaria_necessaria',
    422,
    'Antes de entrar na comunidade, informe a sua faixa de idade.',
  ],
  UJ087: ['responsavel_necessario', 422, MENSAGEM_SEM_RESPONSAVEL],
  UJ088: [
    'vinculo_desativado',
    409,
    'Sua participação nesta comunidade está pausada pela liderança. Fale com ela para voltar.',
  ],
  UJ089: [
    'so_por_convite',
    409,
    'Esta comunidade só recebe pessoas por convite. Peça um convite à liderança dela.',
  ],
  UJ082: ['pedido_ja_respondido', 409, 'Este pedido já foi respondido.'],
  UJ090: [
    'email_nao_confirmado',
    403,
    'Para criar uma comunidade, confirme primeiro o seu e-mail.',
  ],
  UJ091: [
    'limite_de_comunidades_novas',
    409,
    'Você já tem uma comunidade esperando verificação. Quando ela for verificada, você poderá criar outra.',
  ],
  UJ092: ['limite_de_comunidades', 409, 'Você já criou 3 comunidades, o limite por pessoa.'],
  UJ093: [
    'idade_para_criar',
    403,
    'Para criar uma comunidade é preciso ter 18 anos ou mais. A partir dos 16 você já pode participar de comunidades. Se ainda não informou a sua idade, informe no Perfil.',
  ],
  P0002: ['nao_encontrado', 404, 'Não encontramos o que você procurou.'],
}

/** Erros das funções de abertura em linguagem de gente; o resto segue o padrão. */
function traduzir(e: unknown): never {
  if (e instanceof ErroHttp) throw e
  const codigo = (e as { code?: string }).code
  const m = codigo ? MENSAGEM_DO_BANCO[codigo] : undefined
  if (m) throw new ErroHttp(m[0], m[1], m[2])
  traduzirErroDoBanco(e)
}

/** Forma do consentimento: a plataforma da sessão que pediu. */
async function formaDaSessao(c: pg.PoolClient, sessaoId: string): Promise<string> {
  const { rows } = await c.query<{ plataforma: string | null }>(
    'select plataforma from uj.sessoes where id = $1',
    [sessaoId],
  )
  return rows[0]?.plataforma ?? 'web'
}

function idPublicoDoCaminho(pedido: FastifyRequest): string {
  const valor = (pedido.params as { idPublico?: string }).idPublico ?? ''
  if (!ID_PUBLICO.test(valor)) throw NAO_ENCONTRADO()
  return valor
}

interface ResultadoDaEntrada {
  resultado: 'membro' | 'pedido_pendente'
  comunidade_id: string
  comunidade_nome: string
}

/** `{ resultado, comunidade }`: o id só para quem já virou membro. */
function respostaDaEntrada(r: ResultadoDaEntrada) {
  return {
    resultado: r.resultado,
    comunidade:
      r.resultado === 'membro'
        ? { id: r.comunidade_id, nome: r.comunidade_nome }
        : { nome: r.comunidade_nome },
  }
}

export function registrarRotasDeAbertura(
  app: FastifyInstance,
  d: DependenciasComunidades & { fatorDeLimitePorIp?: number },
): void {
  const { api, config } = d
  const fatorIp = d.fatorDeLimitePorIp ?? 1
  const min = 60_000
  const lim = {
    criar: new Limitador(5, 60 * min),
    buscaConta: new Limitador(60, 15 * min),
    buscaIp: new Limitador(120 * fatorIp, 15 * min),
    entradaIp: new Limitador(20 * fatorIp, 15 * min),
    previaIp: new Limitador(20 * fatorIp, 15 * min),
    entradaConta: new Limitador(20, 60 * min),
    pedidoConta: new Limitador(20, 60 * min),
    denunciaConta: new Limitador(10, 60 * min),
  }
  const limitar = (l: Limitador, chave: string, resposta: FastifyReply) => {
    if (l.tentar(chave)) return
    resposta.header('Retry-After', String(l.segundosParaLiberar(chave)))
    throw new ErroHttp(
      'muitas_tentativas',
      429,
      'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    )
  }
  const daConta = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    emTransacao(api, { contaId: pedido.sessao!.contaId, comunidadeId: null }, trabalho)
  const sessao = { preHandler: app.exigirSessao }

  // ================================================================ criar comunidade

  app.post('/api/v1/comunidades', sessao, async (pedido, resposta) => {
    const corpo = validar(
      z.object({
        nome: z.string().trim().min(2).max(80),
        cor,
        cidade: cidade.nullish(),
        fuso: fusoValido.optional(),
        aceiteDoTermoDoAdmin: marcado(MENSAGEM_SEM_TERMO_DO_ADMIN),
        // TC-03.v3 na forma de criação: quem cria também participa.
        consentimentoFe: marcado(MENSAGEM_SEM_CONSENTIMENTO_DE_FE_NA_ENTRADA),
      }),
      pedido.body,
    )
    // Constante única (ADR 0004): com `somente_criador`, a conta comum não cria.
    if (!podeCriarComunidade(POLITICAS.comunidade, { criador: false, emailConfirmado: true })) {
      throw new ErroHttp(
        'criacao_nao_habilitada',
        403,
        'A criação de comunidades está fechada no momento.',
      )
    }
    limitar(lim.criar, pedido.sessao!.contaId, resposta)
    const codigo = sortearCodigo(config.CONVITE_SEGREDO)
    const criada = await daConta(pedido, async (c) => {
      try {
        // Decisão do dono (15/11/2026, D48): criar exige 18 anos ou mais; o
        // banco confere de novo (UJ093). Entrar continua a partir de 16 (D27).
        const idade = await c.query<{ faixa: string | null }>(
          'select faixa_etaria as faixa from uj.contas where id = $1',
          [pedido.sessao!.contaId],
        )
        if (idade.rows[0]?.faixa !== '18_mais') traduzir({ code: 'UJ093' })
        const { rows } = await c.query<{ id: string }>(
          'select uj.criar_comunidade_aberta($1, $2, $3, $4, $5, $6, $7, $8, $9) as id',
          [
            corpo.nome,
            corpo.cor,
            corpo.cidade ?? null,
            corpo.fuso ?? FUSO_PADRAO,
            codigo.semente,
            codigo.hmac,
            VERSAO_DO_TEXTO['TC-16'],
            VERSAO_DO_TEXTO['TC-03'],
            await formaDaSessao(c, pedido.sessao!.sessaoId),
          ],
        )
        const id = rows[0]!.id
        await c.query("select set_config('app.comunidade_id', $1, true)", [id])
        await auditar(
          c,
          pedido,
          'comunidade.criada',
          { tipo: 'comunidade', id },
          { verificacao: 'nova' },
          id,
        )
        return id
      } catch (e) {
        traduzir(e)
      }
    })
    return {
      id: criada,
      nome: corpo.nome,
      cor: corpo.cor,
      cidade: corpo.cidade ?? null,
      verificacao: 'nova',
      modoEntrada: MODO_DE_ENTRADA_PADRAO,
      encontravel: false,
      codigo: codigo.codigo,
      link: linkDoCodigo(config.URL_PUBLICA, codigo.codigo),
    }
  })

  // ================================================================ busca

  app.get('/api/v1/comunidades/busca', sessao, async (pedido, resposta) => {
    const q = validar(
      z.object({
        q: z.string().trim().max(80).optional(),
        cidade: z.string().trim().max(80).optional(),
      }),
      pedido.query ?? {},
    )
    const termo = q.q || null
    const naCidade = q.cidade || null
    const curto = (t: string | null) => t !== null && t.length < LIMITES_DA_BUSCA.minimoDeLetras
    if ((termo === null && naCidade === null) || curto(termo) || curto(naCidade)) {
      throw new ErroHttp(
        'busca_curta',
        400,
        `Digite pelo menos ${LIMITES_DA_BUSCA.minimoDeLetras} letras do nome ou da cidade.`,
      )
    }
    limitar(lim.buscaIp, truncarIp(pedido.ip), resposta)
    limitar(lim.buscaConta, pedido.sessao!.contaId, resposta)
    return daConta(pedido, async (c) => {
      const { rows } = await c.query(
        `select id_publico as "idPublico", nome, cidade, cor, tem_logo as "temLogo",
                logo_versao as "logoVersao", verificada, modo_entrada as "modoEntrada"
           from uj.buscar_comunidades($1, $2)`,
        [termo, naCidade],
      )
      return rows.slice(0, LIMITES_DA_BUSCA.maximoDeResultados)
    })
  })

  // ================================================================ prévia do código (D66)

  /**
   * "Tenho um código", antes de entrar: o que quem tem o código vê. Pública
   * (serve a quem ainda não tem conta) e POST (o código não vai para a URL nem
   * para o log de acesso). Só o estritamente necessário, e só o que o próprio
   * `entrar_por_codigo` já revelaria: nome, cor, se tem logotipo, quantas pessoas,
   * o modo de entrada e o próximo encontro PÚBLICO. Código desconhecido,
   * trocado, de formato errado ou de comunidade que não recebe por código: o
   * mesmo 404, sem pista de qual foi. Limite por IP igual ao da entrada: adivinhar
   * custa caro. Não grava nada e não registra o código em lugar nenhum.
   */
  app.post('/api/auth/codigo/previa', async (pedido, resposta) => {
    const corpo = validar(
      z.object({ codigo: z.string({ error: 'Digite o código.' }).max(40) }),
      pedido.body,
    )
    limitar(lim.previaIp, truncarIp(pedido.ip), resposta)
    const codigo = normalizarCodigoDaComunidade(corpo.codigo)
    if (!ehCodigoDaComunidade(codigo)) traduzir({ code: 'UJ083' })
    const { rows } = await api.query<{
      nome: string
      cor: string
      tem_logo: boolean
      pessoas: number
      modo_entrada: 'codigo_com_aprovacao' | 'codigo_direto'
      proximo_titulo: string | null
      proximo_inicio: Date | null
      proximo_fuso: string | null
    }>('select * from uj.previa_do_codigo($1)', [hmacDoCodigo(codigo, config.CONVITE_SEGREDO)])
    const r = rows[0]
    if (!r) traduzir({ code: 'UJ083' })
    return {
      comunidade: {
        nome: r.nome,
        cor: r.cor,
        temLogo: r.tem_logo,
        pessoas: r.pessoas,
        modoEntrada: r.modo_entrada,
        proximoEncontro:
          r.proximo_titulo && r.proximo_inicio
            ? { titulo: r.proximo_titulo, inicio: r.proximo_inicio, fuso: r.proximo_fuso }
            : null,
      },
    }
  })

  // ================================================================ entrar e pedir

  app.post('/api/v1/entrada', sessao, async (pedido, resposta) => {
    const corpo = validar(
      z.object({ codigo: z.string({ error: 'Digite o código.' }).max(40), ...corpoDaEntrada }),
      pedido.body,
    )
    // Código desconhecido responde 404 com limite por IP (ADR 0007): adivinhar
    // custa caro mesmo trocando de conta.
    limitar(lim.entradaIp, truncarIp(pedido.ip), resposta)
    limitar(lim.entradaConta, pedido.sessao!.contaId, resposta)
    if (corpo.faixaEtaria === 'menos_16') throw MENOR_DE_16()
    const codigo = normalizarCodigoDaComunidade(corpo.codigo)
    if (!ehCodigoDaComunidade(codigo)) traduzir({ code: 'UJ083' })
    const r = await daConta(pedido, async (c) => {
      try {
        const { rows } = await c.query<ResultadoDaEntrada>(
          'select * from uj.entrar_por_codigo($1, $2, $3, $4, $5, $6, $7)',
          [
            hmacDoCodigo(codigo, config.CONVITE_SEGREDO),
            corpo.mensagem || null,
            corpo.faixaEtaria ?? null,
            corpo.responsavelCiente,
            VERSAO_DO_TEXTO['TC-01'],
            VERSAO_DO_TEXTO['TC-03'],
            await formaDaSessao(c, pedido.sessao!.sessaoId),
          ],
        )
        return rows[0]!
      } catch (e) {
        traduzir(e)
      }
    })
    return respostaDaEntrada(r)
  })

  app.post('/api/v1/comunidades/:idPublico/pedidos', sessao, async (pedido, resposta) => {
    const idPublico = idPublicoDoCaminho(pedido)
    const corpo = validar(z.object(corpoDaEntrada), pedido.body ?? {})
    limitar(lim.pedidoConta, pedido.sessao!.contaId, resposta)
    if (corpo.faixaEtaria === 'menos_16') throw MENOR_DE_16()
    const r = await daConta(pedido, async (c) => {
      try {
        const { rows } = await c.query<ResultadoDaEntrada>(
          'select * from uj.pedir_entrada_pela_busca($1, $2, $3, $4, $5, $6, $7)',
          [
            idPublico,
            corpo.mensagem || null,
            corpo.faixaEtaria ?? null,
            corpo.responsavelCiente,
            VERSAO_DO_TEXTO['TC-01'],
            VERSAO_DO_TEXTO['TC-03'],
            await formaDaSessao(c, pedido.sessao!.sessaoId),
          ],
        )
        return rows[0]!
      } catch (e) {
        traduzir(e)
      }
    })
    return respostaDaEntrada(r)
  })

  // Quem pediu vê "Pendente", "Aceito" ou "Não aprovado", nunca quem decidiu.
  app.get('/api/v1/eu/pedidos', sessao, async (pedido) =>
    daConta(pedido, async (c) => {
      const { rows } = await c.query<{
        id: string
        comunidade_id: string | null
        comunidade_nome: string
        comunidade_cor: string
        estado: 'pendente' | 'aceito' | 'recusado'
        criado_em: Date
        decidido_em: Date | null
      }>('select * from uj.meus_pedidos()')
      return {
        pedidos: rows.map((p) => ({
          id: p.id,
          comunidade: {
            ...(p.comunidade_id ? { id: p.comunidade_id } : {}),
            nome: p.comunidade_nome,
            cor: p.comunidade_cor,
          },
          estado: p.estado === 'recusado' ? 'nao_aprovado' : p.estado,
          criadoEm: p.criado_em,
          respondidoEm: p.decidido_em,
        })),
      }
    }),
  )

  app.delete('/api/v1/eu/pedidos/:pedidoId', sessao, async (pedido) => {
    const pedidoId = idDoCaminho(pedido, 'pedidoId')
    const cancelado = await daConta(pedido, async (c) => {
      const { rows } = await c.query<{ ok: boolean }>('select uj.cancelar_meu_pedido($1) as ok', [
        pedidoId,
      ])
      return rows[0]?.ok === true
    })
    if (!cancelado) throw NAO_ENCONTRADO()
    return { ok: true }
  })

  // ================================================================ denúncia de comunidade

  app.post('/api/v1/comunidades/:idPublico/denuncias', sessao, async (pedido, resposta) => {
    const idPublico = idPublicoDoCaminho(pedido)
    const corpo = validar(
      z.object({
        motivo: z.enum(
          ['menor_de_16', 'risco_a_menor', 'falsa', 'golpe', 'ofensiva', 'spam', 'outro'],
          {
            error: 'Escolha o motivo da denúncia.',
          },
        ),
        detalhe: z.string().trim().max(500).nullish(),
      }),
      pedido.body,
    )
    limitar(lim.denunciaConta, pedido.sessao!.contaId, resposta)
    const id = await daConta(pedido, async (c) => {
      try {
        const { rows } = await c.query<{ id: string }>(
          'select uj.denunciar_comunidade($1, $2, $3) as id',
          [idPublico, corpo.motivo, corpo.detalhe || null],
        )
        return rows[0]!.id
      } catch (e) {
        traduzir(e)
      }
    })
    return { id, mensagem: 'Recebemos sua denúncia. A equipe do Uni Jovem vai analisar.' }
  })

  // ================================================================ código da comunidade (admin)

  const naCom = { preHandler: app.comComunidade }

  app.get('/api/v1/c/:comunidadeId/codigo', naCom, async (pedido) => {
    exigir(pedido, 'comunidade', 'ver_codigo')
    const novo = sortearCodigo(config.CONVITE_SEGREDO)
    return naComunidade(api, pedido, async (c) => {
      try {
        let linha = (
          await c.query<{ semente: Buffer | null; modo: string }>(
            'select codigo_semente as semente, modo_entrada as modo from uj.comunidades where id = $1',
            [pedido.comunidade!.id],
          )
        ).rows[0]
        if (!linha) throw NAO_ENCONTRADO()
        if (!linha.semente) {
          // Comunidade sem código (criada pela Plataforma): nasce no primeiro pedido.
          linha = (
            await c.query<{ semente: Buffer; modo: string }>(
              `update uj.comunidades
                  set codigo_semente = $2, codigo_hmac = $3, codigo_gerado_em = now()
                where id = $1 and codigo_semente is null
                returning codigo_semente as semente, modo_entrada as modo`,
              [pedido.comunidade!.id, novo.semente, novo.hmac],
            )
          ).rows[0]
          if (!linha?.semente) throw NAO_ENCONTRADO()
        }
        const codigo = codigoDaSemente(linha.semente!, config.CONVITE_SEGREDO)
        return { codigo, link: linkDoCodigo(config.URL_PUBLICA, codigo), modoEntrada: linha.modo }
      } catch (e) {
        traduzir(e)
      }
    })
  })

  app.post('/api/v1/c/:comunidadeId/codigo/trocar', naCom, async (pedido) => {
    exigir(pedido, 'comunidade', 'trocar_codigo')
    const novo = sortearCodigo(config.CONVITE_SEGREDO)
    return naComunidade(api, pedido, async (c) => {
      try {
        const r = await c.query(
          `update uj.comunidades
              set codigo_semente = $2, codigo_hmac = $3, codigo_gerado_em = now()
            where id = $1`,
          [pedido.comunidade!.id, novo.semente, novo.hmac],
        )
        if (!r.rowCount) throw NAO_ENCONTRADO()
        await auditar(c, pedido, 'comunidade.codigo_trocado', {
          tipo: 'comunidade',
          id: pedido.comunidade!.id,
        })
        return { codigo: novo.codigo, link: linkDoCodigo(config.URL_PUBLICA, novo.codigo) }
      } catch (e) {
        traduzir(e)
      }
    })
  })

  // ================================================================ termo do administrador

  // TC-16 depois da criação: admin promovido depois e a cada versão nova do
  // termo. O detalhe da comunidade diz quando pedir (`precisaAceitarTermoDoAdmin`).
  app.post('/api/v1/c/:comunidadeId/termo-do-admin', naCom, async (pedido) => {
    exigir(pedido, 'comunidade', 'aceitar_termo_do_admin')
    validar(z.object({ aceite: marcado(MENSAGEM_SEM_TERMO_DO_ADMIN) }), pedido.body)
    return naComunidade(api, pedido, async (c) => {
      try {
        const { rows } = await c.query<{ novo: boolean }>(
          'select uj.aceitar_termo_do_admin($1, $2) as novo',
          [VERSAO_DO_TEXTO['TC-16'], await formaDaSessao(c, pedido.sessao!.sessaoId)],
        )
        return { ok: true, versao: VERSAO_DO_TEXTO['TC-16'], registrado: rows[0]?.novo === true }
      } catch (e) {
        traduzir(e)
      }
    })
  })

  // ================================================================ pedidos da comunidade

  app.get('/api/v1/c/:comunidadeId/pedidos', naCom, async (pedido) => {
    exigir(pedido, 'pedido_entrada', 'ler')
    const q = validar(
      z.object({
        estado: z.enum(['pendente', 'aceito', 'recusado', 'todos']).default('pendente'),
      }),
      pedido.query ?? {},
    )
    return naComunidade(api, pedido, async (c) => {
      const { rows } = await c.query(
        `select id, nome, mensagem, origem, estado, criado_em as "criadoEm",
                decidido_em as "decididoEm"
           from uj.pedidos_da_comunidade($1)`,
        [q.estado === 'todos' ? null : q.estado],
      )
      return { pedidos: rows }
    })
  })

  for (const decisao of ['aceitar', 'recusar'] as const) {
    app.post(
      `/api/v1/c/:comunidadeId/pedidos/:pedidoDeEntradaId/${decisao}`,
      naCom,
      async (pedido) => {
        exigir(pedido, 'pedido_entrada', 'decidir')
        const pedidoId = idDoCaminho(pedido, 'pedidoDeEntradaId')
        return naComunidade(api, pedido, async (c) => {
          try {
            const { rows } = await c.query<{ estado: string; vinculo_id: string | null }>(
              'select estado, vinculo_id from uj.decidir_pedido($1, $2)',
              [pedidoId, decisao === 'aceitar'],
            )
            const r = rows[0]!
            await auditar(c, pedido, `pedido_entrada.${r.estado}`, {
              tipo: 'pedido_de_entrada',
              id: pedidoId,
            })
            return decisao === 'aceitar'
              ? { estado: r.estado, vinculoId: r.vinculo_id }
              : { estado: r.estado }
          } catch (e) {
            traduzir(e)
          }
        })
      },
    )
  }
}
