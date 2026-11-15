import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { TIPOS_DE_NOTIFICACAO, VERSICULO_PADRAO } from '@uj/dominio'
import { emTransacao } from '../banco/contexto.ts'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Notificações (F14), lado das preferências e do aparelho. O envio em si é a
 * fila do banco + trabalhador (0011_notificacoes.sql, src/notificacoes/).
 *
 * - O aparelho é registrado para a SESSÃO do pedido (a família, isto é, o
 *   aparelho): sair da conta ou revogar a sessão apaga o token no banco.
 * - Preferência por tipo e por comunidade fica numa rota de comunidade (a
 *   comunidade vem do caminho, nunca do corpo). A do versículo é da conta.
 * - A caixa de entrada do sino (D42) é da conta: junta as comunidades com
 *   vínculo ativo, pagina por cursor opaco e marca como lida (0020).
 */

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no formato HH:MM.')

const tipo = z.enum(TIPOS_DE_NOTIFICACAO)

/** Tamanho da página da caixa de entrada. */
export const PAGINA_DA_CAIXA = 20

interface LinhaDaCaixa {
  id: string
  tipo: string
  recurso_tipo: string
  titulo: string
  corpo: string
  lida_em: Date | null
  criado_em: Date
  micros: string
  comunidade_id: string
  comunidade_nome: string
  alvo: string | null
}

/** A tela que a notificação abre no app. Nulo quando o alvo não existe mais. */
export type DestinoDaNotificacao =
  | { tela: 'aviso'; avisoId: string }
  | { tela: 'avisos' }
  | { tela: 'evento'; eventoId: string }
  | { tela: 'escalas' }
  | null

function destinoDe(recursoTipo: string, alvo: string | null): DestinoDaNotificacao {
  switch (recursoTipo) {
    case 'aviso':
      return alvo ? { tela: 'aviso', avisoId: alvo } : { tela: 'avisos' }
    case 'evento':
    case 'inscricao':
      return alvo ? { tela: 'evento', eventoId: alvo } : null
    case 'atribuicao':
    case 'substituicao':
      return { tela: 'escalas' }
    default:
      return null
  }
}

/**
 * Título e texto são os mesmos da notificação do aparelho, gravados pelos
 * gatilhos (0011): genéricos, sem título de evento ou aviso e nunca com
 * pedido de oração. A caixa só acrescenta o nome da comunidade.
 */
function itemDaCaixa(l: LinhaDaCaixa) {
  return {
    id: l.id,
    tipo: l.tipo,
    titulo: l.titulo,
    texto: l.corpo,
    comunidade: { id: l.comunidade_id, nome: l.comunidade_nome },
    destino: destinoDe(l.recurso_tipo, l.alvo),
    lida: l.lida_em !== null,
    lidaEm: l.lida_em,
    criadoEm: l.criado_em,
  }
}

/**
 * Cursor opaco (D41, D42): o instante em microssegundos e o id da última
 * linha, em base64url. Microssegundos porque o `Date` do JavaScript corta em
 * milissegundos e duas notificações do mesmo gatilho caem no mesmo milésimo.
 */
function escreverCursor(micros: string, id: string): string {
  return Buffer.from(`${micros}:${id}`, 'utf8').toString('base64url')
}

function lerCursor(cursor: string): { micros: string; id: string } {
  const texto = Buffer.from(cursor, 'base64url').toString('utf8')
  const partes = /^(\d{1,19}):([0-9a-f-]{36})$/.exec(texto)
  if (!partes || !z.uuid().safeParse(partes[2]).success) {
    throw new ErroHttp('cursor_invalido', 400, 'A lista mudou. Abra as notificações de novo.')
  }
  return { micros: partes[1]!, id: partes[2]! }
}

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

  // ---------------------------------------------------------------- caixa de entrada (D42)

  const caixa = '/api/v1/eu/notificacoes/caixa'

  // Todas as comunidades com vínculo ativo de uma vez: a RLS (0020) entrega só
  // as da conta, e só das comunidades em que ela continua.
  app.get(caixa, sessao, async (pedido) => {
    const { cursor } = validar(
      z.object({ cursor: z.string().max(120).optional() }),
      pedido.query ?? {},
    )
    const depois = cursor === undefined ? null : lerCursor(cursor)
    return daConta(pedido, async (c) => {
      const { rows } = await c.query<LinhaDaCaixa>(
        `select n.id, n.tipo, n.recurso_tipo, n.titulo, n.corpo, n.lida_em, n.criado_em,
                (extract(epoch from n.criado_em) * 1000000)::bigint::text as micros,
                c.id as comunidade_id, c.nome as comunidade_nome,
                uj.alvo_da_notificacao(n.id) as alvo
           from uj.notificacoes n
           join uj.comunidades c on c.id = n.comunidade_id
          where $1::bigint is null
             or (n.criado_em, n.id) < (timestamptz 'epoch' + $1::bigint * interval '1 microsecond',
                                       $2::uuid)
          order by n.criado_em desc, n.id desc
          limit $3`,
        [depois?.micros ?? null, depois?.id ?? null, PAGINA_DA_CAIXA + 1],
      )
      const pagina = rows.slice(0, PAGINA_DA_CAIXA)
      const ultima = pagina.at(-1)
      return {
        notificacoes: pagina.map(itemDaCaixa),
        proximoCursor:
          rows.length > PAGINA_DA_CAIXA && ultima ? escreverCursor(ultima.micros, ultima.id) : null,
      }
    })
  })

  app.get(`${caixa}/nao-lidas`, sessao, async (pedido) =>
    daConta(pedido, async (c) => {
      const { rows } = await c.query<{ n: number }>(
        'select count(*)::int as n from uj.notificacoes where lida_em is null',
      )
      return { naoLidas: rows[0]?.n ?? 0 }
    }),
  )

  app.post(`${caixa}/:notificacaoId/lida`, sessao, async (pedido) => {
    const notificacaoId = idDoCaminho(pedido, 'notificacaoId')
    return daConta(pedido, async (c) => {
      // De outra conta, de comunidade que a pessoa deixou ou inexistente: 404, igual.
      const { rowCount } = await c.query(
        'update uj.notificacoes set lida_em = coalesce(lida_em, now()) where id = $1',
        [notificacaoId],
      )
      if (!rowCount) throw NAO_ENCONTRADO()
      return { ok: true }
    })
  })

  app.post(`${caixa}/lidas`, sessao, async (pedido) =>
    daConta(pedido, async (c) => {
      const { rowCount } = await c.query(
        'update uj.notificacoes set lida_em = now() where lida_em is null',
      )
      return { marcadas: rowCount ?? 0 }
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
