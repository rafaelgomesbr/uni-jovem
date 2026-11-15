import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { mascararTelefone } from '../publico/apoio.ts'
import { exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Inscrições e presença (F12), lado interno. Estados distintos: inscrição
 * confirmada, lista de espera, cancelada, e presença efetiva (outra tabela).
 */

const ERROS: Record<string, [string, number, string]> = {
  UJ030: ['inscricoes_encerradas', 409, 'As inscrições para este evento estão encerradas.'],
  UJ031: ['lotado', 409, 'As vagas acabaram.'],
  UJ033: ['nao_encontrado', 404, 'Não encontramos esta inscrição.'],
  UJ034: ['nao_encontrado', 404, 'Não encontramos este evento.'],
}

function traduzir(e: unknown): never {
  const codigo = (e as { code?: string }).code
  const t = codigo ? ERROS[codigo] : undefined
  if (t) throw new ErroHttp(t[0], t[1], t[2])
  if (e instanceof ErroHttp) throw e
  traduzirErroDoBanco(e)
}

export const dadosDaPresenca = z
  .object({
    chaveIdempotencia: z.uuid(),
    origem: z.enum(['qr', 'manual', 'offline']),
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[0-9A-F]{10}$/)
      .optional(),
    inscricaoId: z.uuid().optional(),
    vinculoId: z.uuid().optional(),
    nomeAvulso: z.string().trim().min(1).max(120).optional(),
    ocorridaEm: z.iso.datetime({ offset: true }).optional(),
  })
  .refine(
    (x) => [x.codigo, x.inscricaoId, x.vinculoId, x.nomeAvulso].filter(Boolean).length === 1,
    'Informe exatamente um: código, inscrição, pessoa ou nome.',
  )
export type DadosDaPresenca = z.infer<typeof dadosDaPresenca>

/**
 * Registra a presença na transação dada (contexto da comunidade). Usada pela
 * rota de check-in e pela sincronização offline (F13), com a mesma regra.
 */
export async function registrarPresenca(
  c: pg.PoolClient,
  comunidadeId: string,
  eventoId: string,
  p: DadosDaPresenca,
): Promise<{ id: string; jaRegistrada: boolean }> {
  const evento = await c.query('select id from uj.eventos where id = $1 and comunidade_id = $2', [
    eventoId,
    comunidadeId,
  ])
  if (!evento.rows[0]) throw NAO_ENCONTRADO()
  // Repetição do mesmo envio: devolve o que já foi gravado.
  const repetida = (
    await c.query('select id from uj.presencas where chave_idempotencia = $1 and evento_id = $2', [
      p.chaveIdempotencia,
      eventoId,
    ])
  ).rows[0]
  if (repetida) return { id: repetida.id as string, jaRegistrada: true }

  let inscricaoId = p.inscricaoId ?? null
  let vinculoId = p.vinculoId ?? null
  if (p.codigo || inscricaoId) {
    const i = (
      await c.query<{ id: string; vinculo_id: string | null; estado: string }>(
        `select id, vinculo_id, estado from uj.inscricoes
          where evento_id = $1 and (codigo_checkin = $2 or id = $3::uuid)`,
        [eventoId, p.codigo ?? null, inscricaoId],
      )
    ).rows[0]
    if (!i || i.estado === 'cancelada') {
      throw new ErroHttp('codigo_invalido', 404, 'Código não encontrado neste evento.')
    }
    inscricaoId = i.id
    vinculoId = i.vinculo_id
  }
  const ja = (
    await c.query(
      `select id from uj.presencas where evento_id = $1
         and ((inscricao_id = $2::uuid) or (vinculo_id = $3::uuid))`,
      [eventoId, inscricaoId, vinculoId],
    )
  ).rows[0]
  if (ja) return { id: ja.id as string, jaRegistrada: true }
  const { rows } = await c.query(
    `insert into uj.presencas (comunidade_id, evento_id, inscricao_id, vinculo_id, nome_avulso, origem,
       registrada_por, ocorrida_em, chave_idempotencia)
     values ($1, $2, $3, $4, $5, $6, (select uj.vinculo_da_conta_no_contexto()), coalesce($7::timestamptz, now()), $8)
     on conflict do nothing returning id`,
    [
      comunidadeId,
      eventoId,
      inscricaoId,
      vinculoId,
      p.nomeAvulso ?? null,
      p.origem,
      p.ocorridaEm ?? null,
      p.chaveIdempotencia,
    ],
  )
  if (rows[0]) return { id: rows[0].id as string, jaRegistrada: false }
  // Corrida com outro aparelho: alguém registrou entre a checagem e o insert.
  const vencedor = (
    await c.query(
      `select id from uj.presencas where chave_idempotencia = $1
          or (evento_id = $2 and (inscricao_id = $3::uuid or vinculo_id = $4::uuid))`,
      [p.chaveIdempotencia, eventoId, inscricaoId, vinculoId],
    )
  ).rows[0]
  return { id: vencedor?.id as string, jaRegistrada: true }
}

export function registrarRotasDeInscricoes(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const ev = '/api/v1/c/:comunidadeId/eventos/:eventoId'
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        traduzir(e)
      }
    })

  async function exigirEvento(c: pg.PoolClient, pedido: FastifyRequest, eventoId: string) {
    const { rows } = await c.query(
      'select id from uj.eventos where id = $1 and comunidade_id = $2',
      [eventoId, pedido.comunidade!.id],
    )
    if (!rows[0]) throw NAO_ENCONTRADO()
  }

  app.get(`${ev}/inscricoes`, naCom, async (pedido) => {
    exigir(pedido, 'inscricao', 'ler_lista')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(pedido, async (c) => {
      await exigirEvento(c, pedido, eventoId)
      const { rows } = await c.query<{ telefone: string | null }>(
        `select i.id, i.origem, i.nome, i.telefone, i.email, i.estado, i.codigo_checkin as "codigoCheckin",
                i.criado_em as "criadoEm", i.promovida_em as "promovidaEm",
                exists (select 1 from uj.presencas p where p.inscricao_id = i.id) as presente
           from uj.inscricoes i where i.evento_id = $1
          order by case i.estado when 'confirmada' then 0 when 'espera' then 1 else 2 end, i.criado_em`,
        [eventoId],
      )
      const contagem = {
        confirmadas: rows.filter(
          (r) => (r as unknown as { estado: string }).estado === 'confirmada',
        ).length,
        espera: rows.filter((r) => (r as unknown as { estado: string }).estado === 'espera').length,
        presentes: rows.filter((r) => (r as unknown as { presente: boolean }).presente).length,
      }
      return { contagem, inscricoes: rows }
    })
  })

  app.post(`${ev}/inscricoes/eu`, naCom, async (pedido) => {
    exigir(pedido, 'inscricao', 'inscrever_se', { proprio: true })
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(pedido, async (c) => {
      const { rows } = await c.query('select * from uj.inscrever_membro($1)', [eventoId])
      return rows[0]
    })
  })

  app.post('/api/v1/c/:comunidadeId/inscricoes/:inscricaoId/cancelar', naCom, async (pedido) => {
    exigir(pedido, 'inscricao', 'cancelar', { proprio: true })
    const inscricaoId = idDoCaminho(pedido, 'inscricaoId')
    return tx(pedido, async (c) => {
      await c.query('select uj.cancelar_inscricao($1)', [inscricaoId])
      return { ok: true }
    })
  })

  /** Lista de check-in (também é o pacote offline do evento, F13). */
  app.get(`${ev}/checkin`, naCom, async (pedido) => {
    exigir(pedido, 'presenca', 'registrar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(pedido, async (c) => {
      await exigirEvento(c, pedido, eventoId)
      const inscritos = (
        await c.query<{ telefone: string | null }>(
          `select i.id as "inscricaoId", i.vinculo_id as "vinculoId", i.nome, i.telefone,
                  i.codigo_checkin as "codigo", i.estado,
                  exists (select 1 from uj.presencas p where p.inscricao_id = i.id) as presente
             from uj.inscricoes i where i.evento_id = $1 and i.estado in ('confirmada', 'espera')
            order by i.nome`,
          [eventoId],
        )
      ).rows.map((r) => ({ ...r, telefone: mascararTelefone(r.telefone) }))
      const membros = (
        await c.query(
          `select p.vinculo_id as "vinculoId", p.nome,
                  exists (select 1 from uj.presencas x where x.evento_id = $1 and x.vinculo_id = p.vinculo_id) as presente
             from uj.pessoas_da_comunidade() p where p.estado = 'ativo' order by p.nome`,
          [eventoId],
        )
      ).rows
      return { inscritos, membros, geradoEm: new Date().toISOString() }
    })
  })

  app.get(`${ev}/presencas`, naCom, async (pedido) => {
    exigir(pedido, 'presenca', 'ler')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(pedido, async (c) => {
      await exigirEvento(c, pedido, eventoId)
      const { rows } = await c.query(
        `select p.id, p.origem, p.ocorrida_em as "ocorridaEm", p.inscricao_id as "inscricaoId",
                p.vinculo_id as "vinculoId", coalesce(i.nome, pc.nome, p.nome_avulso) as nome
           from uj.presencas p
           left join uj.inscricoes i on i.id = p.inscricao_id
           left join uj.pessoas_da_comunidade() pc on pc.vinculo_id = p.vinculo_id
          where p.evento_id = $1 order by p.ocorrida_em`,
        [eventoId],
      )
      return { total: rows.length, presencas: rows }
    })
  })

  /**
   * Check-in. Idempotente: a mesma `chaveIdempotencia` (fila offline repetindo)
   * ou a mesma pessoa no mesmo evento nunca vira duas presenças.
   */
  app.post(`${ev}/presencas`, naCom, async (pedido) => {
    exigir(pedido, 'presenca', 'registrar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const p = validar(dadosDaPresenca, pedido.body)
    return tx(pedido, (c) => registrarPresenca(c, pedido.comunidade!.id, eventoId, p))
  })

  app.delete(`${ev}/presencas/:presencaId`, naCom, async (pedido) => {
    exigir(pedido, 'presenca', 'registrar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const presencaId = idDoCaminho(pedido, 'presencaId')
    return tx(pedido, async (c) => {
      const r = await c.query(
        'delete from uj.presencas where id = $1 and evento_id = $2 and comunidade_id = $3',
        [presencaId, eventoId, pedido.comunidade!.id],
      )
      if (!r.rowCount) throw NAO_ENCONTRADO()
      return { ok: true }
    })
  })
}
