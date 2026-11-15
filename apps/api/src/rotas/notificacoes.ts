import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { TIPOS_DE_NOTIFICACAO, VERSICULO_PADRAO } from '@uj/dominio'
import { emTransacao } from '../banco/contexto.ts'
import { ErroHttp, traduzirErroDoBanco, validar } from '../http.ts'
import { exigir, naComunidade } from './contexto.ts'

/**
 * Notificações (F14), lado das preferências e do aparelho. O envio em si é a
 * fila do banco + trabalhador (0011_notificacoes.sql, src/notificacoes/).
 *
 * - O aparelho é registrado para a SESSÃO do pedido (a família, isto é, o
 *   aparelho): sair da conta ou revogar a sessão apaga o token no banco.
 * - Preferência por tipo e por comunidade fica numa rota de comunidade (a
 *   comunidade vem do caminho, nunca do corpo). A do versículo é da conta.
 */

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no formato HH:MM.')

const tipo = z.enum(TIPOS_DE_NOTIFICACAO)

export function registrarRotasDeNotificacoes(app: FastifyInstance, api: pg.Pool): void {
  const daConta = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    emTransacao(api, { contaId: pedido.sessao!.contaId, comunidadeId: null }, trabalho)
  const sessao = { preHandler: app.exigirSessao }

  // ---------------------------------------------------------------- conta

  app.get('/api/v1/eu/notificacoes', sessao, async (pedido) =>
    daConta(pedido, async (c) => {
      const pref = (
        await c.query<{ versiculo_ativo: boolean; versiculo_hora: string }>(
          'select versiculo_ativo, versiculo_hora from uj.preferencias_conta where conta_id = $1',
          [pedido.sessao!.contaId],
        )
      ).rows[0]
      const aparelho = (
        await c.query<{ plataforma: string; criado_em: Date }>(
          `select a.plataforma, a.criado_em from uj.aparelhos_push a
            where a.familia = (select familia from uj.sessoes where id = $1)`,
          [pedido.sessao!.sessaoId],
        )
      ).rows[0]
      return {
        versiculo: {
          ativo: pref?.versiculo_ativo ?? VERSICULO_PADRAO.ativo,
          hora: pref?.versiculo_hora ?? VERSICULO_PADRAO.hora,
        },
        aparelhoAtual: aparelho
          ? { registrado: true, plataforma: aparelho.plataforma, desde: aparelho.criado_em }
          : { registrado: false },
      }
    }),
  )

  app.put('/api/v1/eu/notificacoes', sessao, async (pedido) => {
    const corpo = validar(
      z
        .object({ versiculoAtivo: z.boolean().optional(), versiculoHora: hora.optional() })
        .refine((o) => Object.keys(o).length > 0, 'Nada para alterar.'),
      pedido.body,
    )
    return daConta(pedido, async (c) => {
      const { rows } = await c.query<{ versiculo_ativo: boolean; versiculo_hora: string }>(
        `insert into uj.preferencias_conta (conta_id, versiculo_ativo, versiculo_hora)
         values ($1, coalesce($2, true), coalesce($3, '07:00'))
         on conflict (conta_id) do update
           set versiculo_ativo = coalesce($2, uj.preferencias_conta.versiculo_ativo),
               versiculo_hora = coalesce($3, uj.preferencias_conta.versiculo_hora),
               atualizado_em = now()
         returning versiculo_ativo, versiculo_hora`,
        [pedido.sessao!.contaId, corpo.versiculoAtivo ?? null, corpo.versiculoHora ?? null],
      )
      return { versiculo: { ativo: rows[0]!.versiculo_ativo, hora: rows[0]!.versiculo_hora } }
    })
  })

  // Token nativo do aparelho (APNs ou FCM), sem serviço intermediário.
  app.put('/api/v1/eu/notificacoes/aparelho', sessao, async (pedido) => {
    const corpo = validar(
      z.discriminatedUnion('plataforma', [
        z.object({
          plataforma: z.literal('ios'),
          token: z
            .string()
            .trim()
            .regex(/^[0-9a-fA-F]{32,200}$/, 'Token do APNs inválido.'),
          ambienteApns: z.enum(['producao', 'sandbox']).default('producao'),
        }),
        z.object({
          plataforma: z.literal('android'),
          token: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9:_.-]{16,4096}$/, 'Token do FCM inválido.'),
        }),
      ]),
      pedido.body,
    )
    return daConta(pedido, async (c) => {
      try {
        await c.query('select uj.registrar_aparelho_push($1, $2, $3, $4)', [
          pedido.sessao!.sessaoId,
          corpo.token,
          corpo.plataforma,
          corpo.plataforma === 'ios' ? corpo.ambienteApns : null,
        ])
      } catch (e) {
        if ((e as { code?: string }).code === '42501') {
          throw new ErroHttp('sessao_invalida', 401, 'Sua sessão terminou. Entre de novo.')
        }
        traduzirErroDoBanco(e)
      }
      return { ok: true }
    })
  })

  app.delete('/api/v1/eu/notificacoes/aparelho', sessao, async (pedido) =>
    daConta(pedido, async (c) => {
      await c.query(
        'delete from uj.aparelhos_push where familia = (select familia from uj.sessoes where id = $1)',
        [pedido.sessao!.sessaoId],
      )
      return { ok: true }
    }),
  )

  // ---------------------------------------------------------------- comunidade

  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId/notificacoes'

  async function lerPreferencias(c: pg.PoolClient, comunidadeId: string, contaId: string) {
    const { rows } = await c.query<{ tipo: string; ativo: boolean }>(
      'select tipo, ativo from uj.preferencias_notificacao where comunidade_id = $1 and conta_id = $2',
      [comunidadeId, contaId],
    )
    const mapa = new Map(rows.map((r) => [r.tipo, r.ativo]))
    return {
      todas: mapa.get('todos') ?? true,
      tipos: TIPOS_DE_NOTIFICACAO.map((t) => ({ tipo: t, ativo: mapa.get(t) ?? true })),
    }
  }

  app.get(`${base}/preferencias`, naCom, async (pedido) => {
    exigir(pedido, 'notificacao', 'configurar_proprias')
    return naComunidade(api, pedido, (c) =>
      lerPreferencias(c, pedido.comunidade!.id, pedido.sessao!.contaId),
    )
  })

  app.put(`${base}/preferencias`, naCom, async (pedido) => {
    exigir(pedido, 'notificacao', 'configurar_proprias')
    const corpo = validar(
      z
        .object({
          todas: z.boolean().optional(),
          tipos: z.partialRecord(tipo, z.boolean()).optional(),
        })
        .refine((o) => o.todas !== undefined || o.tipos !== undefined, 'Nada para alterar.'),
      pedido.body,
    )
    const mudancas: [string, boolean][] = [
      ...(corpo.todas === undefined ? [] : [['todos', corpo.todas] as [string, boolean]]),
      ...Object.entries(corpo.tipos ?? {}).filter(
        (x): x is [string, boolean] => typeof x[1] === 'boolean',
      ),
    ]
    return naComunidade(api, pedido, async (c) => {
      for (const [t, ativo] of mudancas) {
        await c.query(
          `insert into uj.preferencias_notificacao (comunidade_id, conta_id, tipo, ativo)
           values ($1, $2, $3, $4)
           on conflict (comunidade_id, conta_id, tipo)
             do update set ativo = excluded.ativo, atualizado_em = now()`,
          [pedido.comunidade!.id, pedido.sessao!.contaId, t, ativo],
        )
      }
      return lerPreferencias(c, pedido.comunidade!.id, pedido.sessao!.contaId)
    })
  })

  /** As notificações recentes da própria pessoa nesta comunidade (central no app). */
  app.get(base, naCom, async (pedido) => {
    exigir(pedido, 'notificacao', 'configurar_proprias')
    return naComunidade(api, pedido, async (c) => {
      const { rows } = await c.query(
        `select id, tipo, recurso_tipo as "recursoTipo", recurso_id as "recursoId", titulo, corpo,
                criado_em as "criadoEm"
           from uj.notificacoes where comunidade_id = $1
          order by criado_em desc limit 50`,
        [pedido.comunidade!.id],
      )
      return { notificacoes: rows }
    })
  })
}
