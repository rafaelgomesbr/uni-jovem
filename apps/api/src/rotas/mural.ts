import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { permite } from '@uj/dominio'
import { atorDoPedido, exigir, naComunidade } from './contexto.ts'

/**
 * Mural da aba Comunidade (app v3, D66): o que está acontecendo, numa chamada
 * só e sem texto de pessoa.
 *
 * - `avisos`: quantos há no ar e o aviso à vista (o fixado, ou o mais recente),
 *   só com id, título e data. O texto do aviso continua em `GET /avisos/:id`.
 * - `oracao.novos`: pedidos de oração de OUTRAS pessoas, que a pessoa já pode
 *   ver, ainda não respondidos, dos últimos 7 dias, e em que ela ainda não
 *   marcou "Estou orando". Só a CONTAGEM: o texto de pedido nunca sai daqui.
 *   Quem decide o que ela vê é a RLS de `uj.pedidos_oracao` (visibilidade,
 *   bloqueios, equipe de oração); a autoria nem é lida (D55).
 * - `pessoas.total`: vínculos ativos.
 * - `organizacao`: só para quem decide pedidos de entrada (organizador e
 *   administrador); para os demais é nulo.
 */

/** "Novo" no selo de pedidos de oração: criado nos últimos 7 dias. */
export const DIAS_DE_PEDIDO_NOVO = 7

export function registrarRotaDeMural(app: FastifyInstance, api: pg.Pool): void {
  app.get('/api/v1/c/:comunidadeId/mural', { preHandler: app.comComunidade }, async (pedido) => {
    exigir(pedido, 'aviso', 'ler')
    const veOrganizacao = permite(atorDoPedido(pedido), 'pedido_entrada', 'ler')
    const comunidadeId = pedido.comunidade!.id
    const contaId = pedido.sessao!.contaId
    return naComunidade(api, pedido, async (c) => {
      const avisos = (
        await c.query<{ id: string; titulo: string; fixado: boolean; publicadoEm: Date }>(
          `select id, titulo, fixado, publicado_em as "publicadoEm"
             from uj.avisos
            where comunidade_id = $1 and estado = 'publicado'
              and (visivel_ate is null or visivel_ate > now())
            order by fixado desc, publicado_em desc`,
          [comunidadeId],
        )
      ).rows
      const novos = (
        await c.query<{ n: number }>(
          `select count(*)::int as n
             from uj.pedidos_oracao p
            where p.comunidade_id = $1 and p.respondido_em is null
              and p.criado_em > now() - make_interval(days => $3)
              and p.id <> all (array(select uj.meus_pedidos_de_oracao()))
              and not exists (select 1 from uj.intercessoes i
                               where i.pedido_id = p.id and i.conta_id = $2)`,
          [comunidadeId, contaId, DIAS_DE_PEDIDO_NOVO],
        )
      ).rows[0]!.n
      const pessoas = (
        await c.query<{ n: number }>(
          `select count(*)::int as n from uj.pessoas_da_comunidade() where estado = 'ativo'`,
        )
      ).rows[0]!.n
      let organizacao: { pedidosDeEntrada: number } | null = null
      if (veOrganizacao) {
        const r = await c.query<{ n: number }>(
          `select count(*)::int as n from uj.pedidos_da_comunidade('pendente')`,
        )
        organizacao = { pedidosDeEntrada: r.rows[0]!.n }
      }
      const destaque = avisos[0] ?? null
      return {
        avisos: {
          total: avisos.length,
          destaque: destaque
            ? {
                id: destaque.id,
                titulo: destaque.titulo,
                fixado: destaque.fixado,
                publicadoEm: destaque.publicadoEm,
              }
            : null,
        },
        oracao: { novos },
        pessoas: { total: pessoas },
        organizacao,
      }
    })
  })
}
