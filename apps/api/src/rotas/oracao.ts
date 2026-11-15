import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import {
  podeVerPedidoDeOracao,
  QUEM_VE_O_PEDIDO,
  VISIBILIDADE_PADRAO_DE_ORACAO,
  VISIBILIDADES_DE_ORACAO,
  type VisibilidadeDeOracao,
} from '@uj/dominio'
import { cifrar, decifrar } from '../autenticacao/cripto.ts'
import type { Config } from '../config.ts'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import {
  auditar,
  exigir,
  idDoCaminho,
  naComunidade,
  comLimiteDeEscrita,
  ESCRITAS_POR_HORA,
} from './contexto.ts'

/**
 * Pedidos de oração (F15).
 *
 * Garantias (plano, seção 9):
 * - O texto é cifrado aqui (AES-256-GCM, ORACAO_CHAVE, dado autenticado
 *   `oracao:<id>`) e nunca chega em claro ao banco, à auditoria, ao log de
 *   mudanças nem ao log do servidor. Nada nesta rota registra o corpo.
 * - Quem lê é decidido pela RLS de `uj.pedidos_oracao` e, de novo aqui, por
 *   `podeVerPedidoDeOracao`. Ser admin ou Criador não abre pedido de ninguém.
 * - Sem armazenamento offline e sem notificação com conteúdo.
 *
 * Limite honesto (L02): não é ponta a ponta; quem opera o servidor e tem a
 * chave consegue decifrar.
 */

const visibilidade = z.enum(VISIBILIDADES_DE_ORACAO)
const textoDoPedido = z
  .string()
  .trim()
  .min(1, 'Escreva o seu pedido.')
  .max(2000, 'O pedido pode ter até 2.000 caracteres.')

interface LinhaDoPedido {
  id: string
  autorContaId: string
  textoCifrado: Buffer
  visibilidade: VisibilidadeDeOracao
  autorNome: string | null
  respondidoEm: Date | null
  criadoEm: Date
  atualizadoEm: Date
  versao: number
  orandoTotal: number
  euEstouOrando: boolean
  orando: string[]
}

// Nomes saem de pessoas_da_comunidade (uj_api não lê `contas` de terceiros).
const CONSULTA = `
  with pessoas as materialized (
    select conta_id, nome from uj.pessoas_da_comunidade() where estado = 'ativo'
  )
  select p.id, p.autor_conta_id as "autorContaId", p.texto_cifrado as "textoCifrado",
         p.visibilidade, a.nome as "autorNome", p.respondido_em as "respondidoEm",
         p.criado_em as "criadoEm", p.atualizado_em as "atualizadoEm", p.versao,
         (select count(*)::int from uj.intercessoes i where i.pedido_id = p.id) as "orandoTotal",
         exists (select 1 from uj.intercessoes i where i.pedido_id = p.id and i.conta_id = $2)
           as "euEstouOrando",
         coalesce((select array_agg(x.nome order by x.nome)
                     from uj.intercessoes i join pessoas x on x.conta_id = i.conta_id
                    where i.pedido_id = p.id), '{}') as orando
    from uj.pedidos_oracao p
    left join pessoas a on a.conta_id = p.autor_conta_id
   where p.comunidade_id = $1`

function conflito(atual: unknown): ErroHttp & { atual?: unknown } {
  const e = new ErroHttp(
    'conflito',
    409,
    'Este pedido mudou enquanto você editava. Confira a versão atual antes de salvar de novo.',
  ) as ErroHttp & { atual?: unknown }
  e.atual = atual
  return e
}

export function registrarRotasDeOracao(
  app: FastifyInstance,
  d: { api: pg.Pool; config: Config },
): void {
  const { api } = d
  const chave = Buffer.from(d.config.ORACAO_CHAVE, 'base64')
  const naCom = { preHandler: app.comComunidade }
  const escrita = comLimiteDeEscrita(app, ESCRITAS_POR_HORA.oracao)
  const base = '/api/v1/c/:comunidadeId/oracao'
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })

  /** Segunda camada: mesmo que a RLS falhasse, a regra do domínio filtra de novo. */
  function visivel(pedido: FastifyRequest, linha: LinhaDoPedido): boolean {
    const c = pedido.comunidade!
    return podeVerPedidoDeOracao(
      { autorContaId: linha.autorContaId, visibilidade: linha.visibilidade },
      { contaId: pedido.sessao!.contaId, papel: c.papel, designacoes: c.designacoes },
    )
  }

  function apresentar(pedido: FastifyRequest, linha: LinhaDoPedido) {
    let texto: string | null
    try {
      texto = decifrar(chave, linha.textoCifrado, `oracao:${linha.id}`)
    } catch {
      // Texto adulterado ou chave trocada: o pedido aparece sem o texto, sem derrubar a lista.
      texto = null
    }
    const minha = linha.autorContaId === pedido.sessao!.contaId
    return {
      id: linha.id,
      texto,
      visibilidade: linha.visibilidade,
      quemVe: QUEM_VE_O_PEDIDO[linha.visibilidade],
      minha,
      autorNome: linha.autorNome,
      respondidoEm: linha.respondidoEm,
      criadoEm: linha.criadoEm,
      atualizadoEm: linha.atualizadoEm,
      versao: linha.versao,
      orando: {
        total: linha.orandoTotal,
        euEstouOrando: linha.euEstouOrando,
        pessoas: linha.orando,
      },
    }
  }

  async function lerPedido(c: pg.PoolClient, pedido: FastifyRequest, pedidoId: string) {
    const { rows } = await c.query<LinhaDoPedido>(`${CONSULTA} and p.id = $3`, [
      pedido.comunidade!.id,
      pedido.sessao!.contaId,
      pedidoId,
    ])
    const linha = rows[0]
    if (!linha || !visivel(pedido, linha)) throw NAO_ENCONTRADO()
    return linha
  }

  /** O pedido é visível (senão 404) e é da própria pessoa (senão 403 da matriz). */
  async function lerMeuPedido(
    c: pg.PoolClient,
    pedido: FastifyRequest,
    pedidoId: string,
    acao: 'editar' | 'excluir' | 'mudar_visibilidade' | 'marcar_respondido',
  ) {
    const linha = await lerPedido(c, pedido, pedidoId)
    exigir(pedido, 'pedido_oracao', acao, {
      proprio: linha.autorContaId === pedido.sessao!.contaId,
    })
    return linha
  }

  app.get(base, naCom, async (pedido) => {
    exigir(pedido, 'comunidade', 'ler')
    const q = validar(
      z.object({
        filtro: z.enum(['todos', 'meus', 'outros']).default('todos'),
        respondidos: z.enum(['incluir', 'ocultar', 'somente']).default('incluir'),
      }),
      pedido.query,
    )
    return tx(pedido, async (c) => {
      const { rows } = await c.query<LinhaDoPedido>(
        `${CONSULTA}
           and ($3 = 'todos' or ($3 = 'meus') = (p.autor_conta_id = $2))
           and ($4 = 'incluir' or ($4 = 'somente') = (p.respondido_em is not null))
         order by p.respondido_em is not null, p.criado_em desc
         limit 200`,
        [pedido.comunidade!.id, pedido.sessao!.contaId, q.filtro, q.respondidos],
      )
      return {
        pedidos: rows.filter((r) => visivel(pedido, r)).map((r) => apresentar(pedido, r)),
      }
    })
  })

  app.post(base, escrita, async (pedido) => {
    exigir(pedido, 'pedido_oracao', 'criar')
    const p = validar(
      z.object({
        texto: textoDoPedido,
        visibilidade: visibilidade.default(VISIBILIDADE_PADRAO_DE_ORACAO),
      }),
      pedido.body,
    )
    const id = randomUUID()
    return tx(pedido, async (c) => {
      const { rows } = await c.query<{ versao: number; criadoEm: Date }>(
        `insert into uj.pedidos_oracao (id, comunidade_id, texto_cifrado, visibilidade)
         values ($1, $2, $3, $4) returning versao, criado_em as "criadoEm"`,
        [id, pedido.comunidade!.id, cifrar(chave, p.texto, `oracao:${id}`), p.visibilidade],
      )
      await auditar(
        c,
        pedido,
        'oracao.criado',
        { tipo: 'pedido_oracao', id },
        { visibilidade: p.visibilidade },
      )
      return {
        id,
        visibilidade: p.visibilidade,
        quemVe: QUEM_VE_O_PEDIDO[p.visibilidade],
        versao: rows[0]!.versao,
        criadoEm: rows[0]!.criadoEm,
      }
    })
  })

  app.get(`${base}/:pedidoId`, naCom, async (pedido) => {
    exigir(pedido, 'comunidade', 'ler')
    const pedidoId = idDoCaminho(pedido, 'pedidoId')
    return tx(pedido, async (c) => apresentar(pedido, await lerPedido(c, pedido, pedidoId)))
  })

  /** Editar o texto. A visibilidade muda só pela rota própria, de forma explícita. */
  app.patch(`${base}/:pedidoId`, escrita, async (pedido) => {
    const pedidoId = idDoCaminho(pedido, 'pedidoId')
    const p = validar(
      z.object({ texto: textoDoPedido, versao: z.number().int().min(1).optional() }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const atual = await lerMeuPedido(c, pedido, pedidoId, 'editar')
      if (p.versao !== undefined && p.versao !== atual.versao) {
        throw conflito({ versao: atual.versao })
      }
      const { rows } = await c.query<{ versao: number }>(
        `update uj.pedidos_oracao set texto_cifrado = $3
          where id = $1 and comunidade_id = $2 and versao = $4 returning versao`,
        [
          pedidoId,
          pedido.comunidade!.id,
          cifrar(chave, p.texto, `oracao:${pedidoId}`),
          atual.versao,
        ],
      )
      if (!rows[0]) throw conflito({ versao: atual.versao })
      await auditar(c, pedido, 'oracao.editado', { tipo: 'pedido_oracao', id: pedidoId })
      return { id: pedidoId, versao: rows[0].versao }
    })
  })

  /**
   * Mudança explícita de público: o app manda o público que a pessoa VIU (`de`)
   * e o novo (`para`). Se outra tela já tinha mudado, 409 em vez de mudar às cegas.
   */
  app.put(`${base}/:pedidoId/visibilidade`, escrita, async (pedido) => {
    const pedidoId = idDoCaminho(pedido, 'pedidoId')
    const p = validar(z.object({ de: visibilidade, para: visibilidade }), pedido.body)
    return tx(pedido, async (c) => {
      const atual = await lerMeuPedido(c, pedido, pedidoId, 'mudar_visibilidade')
      if (atual.visibilidade !== p.de) {
        const e = new ErroHttp(
          'visibilidade_mudou',
          409,
          'Quem vê este pedido já tinha sido alterado. Confira antes de mudar de novo.',
        ) as ErroHttp & { atual?: unknown }
        e.atual = { visibilidade: atual.visibilidade, quemVe: QUEM_VE_O_PEDIDO[atual.visibilidade] }
        throw e
      }
      let versao = atual.versao
      if (p.de !== p.para) {
        const { rows } = await c.query<{ versao: number }>(
          `update uj.pedidos_oracao set visibilidade = $3
            where id = $1 and comunidade_id = $2 returning versao`,
          [pedidoId, pedido.comunidade!.id, p.para],
        )
        versao = rows[0]!.versao
        await auditar(
          c,
          pedido,
          'oracao.visibilidade_alterada',
          { tipo: 'pedido_oracao', id: pedidoId },
          { de: p.de, para: p.para },
        )
      }
      return { id: pedidoId, visibilidade: p.para, quemVe: QUEM_VE_O_PEDIDO[p.para], versao }
    })
  })

  app.post(`${base}/:pedidoId/respondido`, escrita, async (pedido) => {
    const pedidoId = idDoCaminho(pedido, 'pedidoId')
    const p = validar(z.object({ respondido: z.boolean() }), pedido.body)
    return tx(pedido, async (c) => {
      await lerMeuPedido(c, pedido, pedidoId, 'marcar_respondido')
      const { rows } = await c.query<{ respondidoEm: Date | null; versao: number }>(
        `update uj.pedidos_oracao
            set respondido_em = case when $3 then coalesce(respondido_em, now()) end
          where id = $1 and comunidade_id = $2
          returning respondido_em as "respondidoEm", versao`,
        [pedidoId, pedido.comunidade!.id, p.respondido],
      )
      await auditar(
        c,
        pedido,
        'oracao.respondido',
        { tipo: 'pedido_oracao', id: pedidoId },
        { respondido: p.respondido },
      )
      return { id: pedidoId, ...rows[0]! }
    })
  })

  async function contagem(c: pg.PoolClient, pedidoId: string) {
    const { rows } = await c.query<{ total: number }>(
      'select count(*)::int as total from uj.intercessoes where pedido_id = $1',
      [pedidoId],
    )
    return rows[0]!.total
  }

  app.post(`${base}/:pedidoId/orando`, escrita, async (pedido) => {
    exigir(pedido, 'pedido_oracao', 'orar')
    const pedidoId = idDoCaminho(pedido, 'pedidoId')
    return tx(pedido, async (c) => {
      await lerPedido(c, pedido, pedidoId)
      await c.query(
        `insert into uj.intercessoes (comunidade_id, pedido_id) values ($1, $2)
         on conflict (pedido_id, conta_id) do nothing`,
        [pedido.comunidade!.id, pedidoId],
      )
      return { euEstouOrando: true, total: await contagem(c, pedidoId) }
    })
  })

  app.delete(`${base}/:pedidoId/orando`, escrita, async (pedido) => {
    exigir(pedido, 'pedido_oracao', 'orar')
    const pedidoId = idDoCaminho(pedido, 'pedidoId')
    return tx(pedido, async (c) => {
      await lerPedido(c, pedido, pedidoId)
      await c.query(
        'delete from uj.intercessoes where pedido_id = $1 and comunidade_id = $2 and conta_id = $3',
        [pedidoId, pedido.comunidade!.id, pedido.sessao!.contaId],
      )
      return { euEstouOrando: false, total: await contagem(c, pedidoId) }
    })
  })

  app.delete(`${base}/:pedidoId`, escrita, async (pedido) => {
    const pedidoId = idDoCaminho(pedido, 'pedidoId')
    return tx(pedido, async (c) => {
      await lerMeuPedido(c, pedido, pedidoId, 'excluir')
      const r = await c.query(
        'delete from uj.pedidos_oracao where id = $1 and comunidade_id = $2',
        [pedidoId, pedido.comunidade!.id],
      )
      if (!r.rowCount) throw NAO_ENCONTRADO()
      await auditar(c, pedido, 'oracao.excluido', { tipo: 'pedido_oracao', id: pedidoId })
      return { ok: true }
    })
  })
}
