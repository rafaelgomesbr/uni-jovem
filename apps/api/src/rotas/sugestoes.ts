import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Sugestões (F15). Qualquer membro sugere; organizadores moderam e respondem.
 *
 * Anonimato: a autoria fica guardada no banco, mas a API não consegue nem
 * selecionar a coluna de autoria (privilégio de coluna). A leitura passa por
 * `uj.sugestoes_visiveis()`, que só devolve o nome quando a sugestão não é
 * anônima ou para a própria autora. A criação não vai para a auditoria (a
 * auditoria guarda quem agiu, o que desfaria o anonimato para o admin).
 */

export const STATUS_DA_SUGESTAO = ['recebida', 'em_analise', 'aceita', 'recusada'] as const

const CAMPOS = `id, anonima, titulo, texto, status, resposta, respondida_em as "respondidaEm",
  respondida_por_nome as "respondidaPorNome", autor_nome as "autorNome", minha,
  criado_em as "criadoEm", atualizado_em as "atualizadoEm", versao`

export function registrarRotasDeSugestoes(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId/sugestoes'
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })

  /** Membro recebe só as suas (a função filtra); organizadores, todas. */
  app.get(base, naCom, async (pedido) => {
    exigir(pedido, 'sugestao', 'ler', { proprio: true })
    const q = validar(z.object({ status: z.enum(STATUS_DA_SUGESTAO).optional() }), pedido.query)
    return tx(pedido, async (c) => ({
      sugestoes: (
        await c.query(
          `select ${CAMPOS} from uj.sugestoes_visiveis()
            where ($1::text is null or status = $1)
            order by case status when 'recebida' then 0 when 'em_analise' then 1 else 2 end,
                     criado_em desc
            limit 500`,
          [q.status ?? null],
        )
      ).rows,
    }))
  })

  app.post(base, naCom, async (pedido) => {
    exigir(pedido, 'sugestao', 'criar')
    const s = validar(
      z.object({
        titulo: z.string().trim().min(2, 'Dê um título à sugestão.').max(120),
        texto: z.string().trim().min(1, 'Escreva a sua sugestão.').max(4000),
        anonima: z.boolean().default(false),
      }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const { rows } = await c.query(
        `insert into uj.sugestoes (comunidade_id, titulo, texto, anonima) values ($1, $2, $3, $4)
         returning id, status, anonima, versao`,
        [pedido.comunidade!.id, s.titulo, s.texto, s.anonima],
      )
      return rows[0]
    })
  })

  app.get(`${base}/:sugestaoId`, naCom, async (pedido) => {
    exigir(pedido, 'sugestao', 'ler', { proprio: true })
    const sugestaoId = idDoCaminho(pedido, 'sugestaoId')
    return tx(pedido, async (c) => {
      const { rows } = await c.query(
        `select ${CAMPOS} from uj.sugestoes_visiveis() where id = $1`,
        [sugestaoId],
      )
      if (!rows[0]) throw NAO_ENCONTRADO()
      return rows[0]
    })
  })

  /** Moderação: mudar o status e responder. */
  app.patch(`${base}/:sugestaoId`, naCom, async (pedido) => {
    exigir(pedido, 'sugestao', 'moderar')
    const sugestaoId = idDoCaminho(pedido, 'sugestaoId')
    const m = validar(
      z
        .object({
          status: z.enum(STATUS_DA_SUGESTAO).optional(),
          resposta: z.string().trim().max(2000).nullish(),
          versao: z.number().int().min(1).optional(),
        })
        .refine(
          (o) => o.status !== undefined || o.resposta !== undefined,
          'Informe o novo status ou a resposta.',
        ),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const atual = (
        await c.query<{ status: string; versao: number }>(
          'select status, versao from uj.sugestoes where id = $1 and comunidade_id = $2',
          [sugestaoId, pedido.comunidade!.id],
        )
      ).rows[0]
      if (!atual) throw NAO_ENCONTRADO()
      const { rows } = await c.query(
        `update uj.sugestoes
            set status = coalesce($3, status),
                resposta = case when $4::boolean then nullif($5, '') else resposta end
          where id = $1 and comunidade_id = $2 and ($6::int is null or versao = $6)
          returning id, status, resposta, respondida_em as "respondidaEm", versao`,
        [
          sugestaoId,
          pedido.comunidade!.id,
          m.status ?? null,
          m.resposta !== undefined,
          m.resposta ?? null,
          m.versao ?? null,
        ],
      )
      if (!rows[0]) {
        const e = new ErroHttp(
          'conflito',
          409,
          'Outra pessoa respondeu a esta sugestão enquanto você escrevia. Confira antes de salvar.',
        ) as ErroHttp & { atual?: unknown }
        e.atual = { versao: atual.versao, status: atual.status }
        throw e
      }
      await auditar(
        c,
        pedido,
        'sugestao.moderada',
        { tipo: 'sugestao', id: sugestaoId },
        { status: { de: atual.status, para: rows[0].status }, respondeu: m.resposta !== undefined },
      )
      return rows[0]
    })
  })

  app.delete(`${base}/:sugestaoId`, naCom, async (pedido) => {
    exigir(pedido, 'sugestao', 'moderar')
    const sugestaoId = idDoCaminho(pedido, 'sugestaoId')
    return tx(pedido, async (c) => {
      const r = await c.query('delete from uj.sugestoes where id = $1 and comunidade_id = $2', [
        sugestaoId,
        pedido.comunidade!.id,
      ])
      if (!r.rowCount) throw NAO_ENCONTRADO()
      await auditar(c, pedido, 'sugestao.excluida', { tipo: 'sugestao', id: sugestaoId })
      return { ok: true }
    })
  })
}
