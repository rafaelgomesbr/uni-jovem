import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { dataValida } from '@uj/dominio'
import { ErroHttp, traduzirErroDoBanco, validar } from '../http.ts'
import { exigir, idDoCaminho, naComunidade } from './contexto.ts'

/** Escalas, substituições e disponibilidade (F9). */

const ERROS: Record<string, [string, number, string]> = {
  UJ020: ['nao_encontrado', 404, 'Não encontramos esta escala entre as suas.'],
  UJ021: [
    'substituicao_em_aberto',
    409,
    'Há um pedido de substituição em aberto. Cancele-o antes de responder.',
  ],
  UJ022: [
    'substituicao_indisponivel',
    409,
    'Este pedido de substituição não está mais disponível para você.',
  ],
  UJ023: ['propria_escala', 409, 'Você não pode assumir a sua própria escala.'],
  UJ024: ['nao_encontrado', 404, 'Não encontramos este pedido de substituição.'],
}

function traduzir(e: unknown): never {
  const codigo = (e as { code?: string }).code
  const t = codigo ? ERROS[codigo] : undefined
  if (t) throw new ErroHttp(t[0], t[1], t[2])
  if (e instanceof ErroHttp) throw e
  traduzirErroDoBanco(e)
}

const dataLocal = z.string().refine(dataValida, 'Data no formato AAAA-MM-DD.')

export function registrarRotasDeEscalas(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId'
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        traduzir(e)
      }
    })

  app.get(`${base}/minhas-escalas`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'ler')
    return tx(pedido, async (c) => ({
      escalas: (
        await c.query(
          `select a.id, a.funcao, a.estado, e.id as "eventoId", e.titulo as "eventoTitulo",
                  e.inicio as "eventoInicio", e.status as "eventoStatus",
                  t.titulo as "etapaTitulo",
                  (select s.id from uj.substituicoes s where s.atribuicao_id = a.id and s.estado = 'aberta')
                    as "substituicaoAberta"
             from uj.atribuicoes a
             join uj.eventos e on e.id = a.evento_id
             left join uj.etapas t on t.id = a.etapa_id
            where a.vinculo_id = (select uj.vinculo_da_conta_no_contexto())
              and e.inicio >= now() - interval '1 day'
            order by e.inicio, t.ordem nulls first`,
        )
      ).rows,
    }))
  })

  for (const [acao, resposta] of [
    ['confirmar', 'confirmada'],
    ['recusar', 'recusada'],
  ] as const) {
    app.post(`${base}/atribuicoes/:atribuicaoId/${acao}`, naCom, async (pedido) => {
      exigir(pedido, 'escala', 'confirmar', { proprio: true })
      const atribuicaoId = idDoCaminho(pedido, 'atribuicaoId')
      return tx(pedido, async (c) => {
        await c.query('select uj.responder_atribuicao($1, $2)', [atribuicaoId, resposta])
        return { estado: resposta }
      })
    })
  }

  app.post(`${base}/atribuicoes/:atribuicaoId/substituicao`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'pedir_substituicao', { proprio: true })
    const atribuicaoId = idDoCaminho(pedido, 'atribuicaoId')
    const p = validar(
      z.object({ motivo: z.string().trim().max(500).nullish(), paraVinculoId: z.uuid().nullish() }),
      pedido.body ?? {},
    )
    return tx(pedido, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        'select uj.pedir_substituicao($1, $2, $3) as id',
        [atribuicaoId, p.motivo ?? null, p.paraVinculoId ?? null],
      )
      // Aviso a quem pode assumir: F14 (notificações) lê a auditoria.
      return { substituicaoId: rows[0]!.id }
    })
  })

  app.get(`${base}/substituicoes`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'ler')
    return tx(pedido, async (c) => {
      const nomes = new Map(
        (
          await c.query<{ vinculo_id: string; nome: string }>(
            'select vinculo_id, nome from uj.pessoas_da_comunidade()',
          )
        ).rows.map((p) => [p.vinculo_id, p.nome]),
      )
      const eu = (
        await c.query<{ v: string | null }>('select uj.vinculo_da_conta_no_contexto() as v')
      ).rows[0]?.v
      const { rows } = await c.query<{
        id: string
        pedida_por: string
        para_vinculo_id: string | null
        motivo: string | null
        evento_id: string
        evento_titulo: string
        evento_inicio: Date
        etapa_titulo: string | null
        funcao: string
      }>(
        `select s.id, s.pedida_por, s.para_vinculo_id, s.motivo, e.id as evento_id,
                e.titulo as evento_titulo, e.inicio as evento_inicio, t.titulo as etapa_titulo, a.funcao
           from uj.substituicoes s
           join uj.atribuicoes a on a.id = s.atribuicao_id
           join uj.eventos e on e.id = a.evento_id
           left join uj.etapas t on t.id = a.etapa_id
          where s.estado = 'aberta' and e.inicio >= now()
          order by e.inicio`,
      )
      return {
        substituicoes: rows.map((s) => ({
          id: s.id,
          pedidaPor: nomes.get(s.pedida_por) ?? 'Pessoa removida',
          minha: s.pedida_por === eu,
          possoAssumir:
            s.pedida_por !== eu && (s.para_vinculo_id === null || s.para_vinculo_id === eu),
          dirigida: s.para_vinculo_id !== null,
          motivo: s.motivo,
          funcao: s.funcao,
          evento: { id: s.evento_id, titulo: s.evento_titulo, inicio: s.evento_inicio },
          etapa: s.etapa_titulo,
        })),
      }
    })
  })

  app.post(`${base}/substituicoes/:substituicaoId/assumir`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'assumir_substituicao')
    const id = idDoCaminho(pedido, 'substituicaoId')
    return tx(pedido, async (c) => {
      const { rows } = await c.query<{ a: string }>('select uj.assumir_substituicao($1) as a', [id])
      return { atribuicaoId: rows[0]!.a }
    })
  })

  app.post(`${base}/substituicoes/:substituicaoId/cancelar`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'pedir_substituicao', { proprio: true })
    const id = idDoCaminho(pedido, 'substituicaoId')
    return tx(pedido, async (c) => {
      await c.query('select uj.cancelar_substituicao($1)', [id])
      return { ok: true }
    })
  })

  app.get(`${base}/disponibilidade`, naCom, async (pedido) => {
    exigir(pedido, 'disponibilidade', 'ler', { proprio: true })
    const q = validar(z.object({ de: dataLocal, ate: dataLocal }), pedido.query)
    return tx(pedido, async (c) => {
      const nomes = new Map(
        (
          await c.query<{ vinculo_id: string; nome: string }>(
            'select vinculo_id, nome from uj.pessoas_da_comunidade()',
          )
        ).rows.map((p) => [p.vinculo_id, p.nome]),
      )
      // A RLS já limita: membro vê só a própria; organizador vê a de todos.
      const { rows } = await c.query<{ vinculo_id: string }>(
        `select vinculo_id, to_char(data, 'YYYY-MM-DD') as data, disponivel, observacao
           from uj.disponibilidades where comunidade_id = $1 and data between $2 and $3
          order by data`,
        [pedido.comunidade!.id, q.de, q.ate],
      )
      return { disponibilidade: rows.map((r) => ({ ...r, nome: nomes.get(r.vinculo_id) ?? null })) }
    })
  })

  app.put(`${base}/disponibilidade/:data`, naCom, async (pedido) => {
    exigir(pedido, 'disponibilidade', 'informar', { proprio: true })
    const data = (pedido.params as { data?: string }).data ?? ''
    if (!dataValida(data)) throw new ErroHttp('dados_invalidos', 400, 'Data no formato AAAA-MM-DD.')
    const p = validar(
      z.object({ disponivel: z.boolean(), observacao: z.string().trim().max(300).nullish() }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      await c.query(
        `insert into uj.disponibilidades (comunidade_id, vinculo_id, data, disponivel, observacao)
         values ($1, (select uj.vinculo_da_conta_no_contexto()), $2, $3, $4)
         on conflict (vinculo_id, data) do update set disponivel = excluded.disponivel,
            observacao = excluded.observacao`,
        [pedido.comunidade!.id, data, p.disponivel, p.observacao ?? null],
      )
      return { ok: true }
    })
  })
}
