import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import {
  dataNoFuso,
  dataValida,
  gerarDatas,
  instanteNoFuso,
  JANELA_DE_MATERIALIZACAO_DIAS,
  MODELOS_EMBUTIDOS,
  type RegraDeRecorrencia,
} from '@uj/dominio'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Séries recorrentes (F8). Escopos de edição, sempre explícitos:
 *  - "esta ocorrência": PATCH do próprio evento (marca editado_individualmente);
 *  - "esta e as futuras": `escopo: 'a_partir_de'` divide a série na data;
 *  - "toda a série": `escopo: 'serie'`, aplicado às ocorrências futuras não
 *    editadas individualmente.
 * Mudar regra ou horário RECRIA as ocorrências futuras não editadas; se alguma
 * delas tiver escala, a API pede confirmação (`confirmarRecriacao`).
 */

const dataLocal = z.string().refine(dataValida, 'Data no formato AAAA-MM-DD.')
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no formato HH:MM.')
const dia = z.number().int().min(0).max(6)

export const regraDeRecorrencia: z.ZodType<RegraDeRecorrencia> = z.union([
  z.object({
    frequencia: z.literal('semanal'),
    intervaloSemanas: z.number().int().min(1).max(4),
    diasDaSemana: z.array(dia).min(1).max(7),
  }),
  z.object({
    frequencia: z.literal('mensal'),
    modo: z.literal('dia_do_mes'),
    dia: z.number().int().min(1).max(31),
  }),
  z.object({
    frequencia: z.literal('mensal'),
    modo: z.literal('semana_do_mes'),
    semana: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]),
    diaDaSemana: dia,
  }),
]) as z.ZodType<RegraDeRecorrencia>

interface Serie {
  id: string
  comunidade_id: string
  regra: RegraDeRecorrencia
  hora_local: string
  fuso: string
  duracao_min: number
  inicio_em: string
  fim_em: string | null
  materializado_ate: string | null
  titulo: string
  descricao: string | null
  categoria: string
  local_id: string | null
  visibilidade: string
  capacidade: number | null
  informacoes_uteis: string | null
  status_das_ocorrencias: string
  etapas: { titulo: string; duracaoMin: number; descricao?: string | null }[]
  checklist: { tipo: string; texto: string }[]
  versao: number
}

const COLUNAS_DA_SERIE = `id, comunidade_id, regra, hora_local, fuso, duracao_min,
  to_char(inicio_em, 'YYYY-MM-DD') as inicio_em, to_char(fim_em, 'YYYY-MM-DD') as fim_em,
  to_char(materializado_ate, 'YYYY-MM-DD') as materializado_ate, titulo, descricao, categoria,
  local_id, visibilidade, capacidade, informacoes_uteis, status_das_ocorrencias, etapas, checklist, versao`

function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

async function lerSerie(c: pg.PoolClient, comunidadeId: string, serieId: string): Promise<Serie> {
  const { rows } = await c.query<Serie>(
    `select ${COLUNAS_DA_SERIE} from uj.series where id = $1 and comunidade_id = $2`,
    [serieId, comunidadeId],
  )
  if (!rows[0]) throw NAO_ENCONTRADO()
  return rows[0]
}

/**
 * Cria as ocorrências que faltam até `ate` (exclusive). Nunca duplica (índice
 * único por série + data original) e nunca recria ocorrência cancelada.
 */
export async function materializar(c: pg.PoolClient, serie: Serie, ate: string): Promise<number> {
  const desde = serie.materializado_ate ? somarDias(serie.materializado_ate, 1) : serie.inicio_em
  const datas = gerarDatas(
    serie.regra,
    desde < serie.inicio_em ? serie.inicio_em : desde,
    ate,
    serie.fim_em,
  )
  let criadas = 0
  for (const data of datas) {
    const inicio = instanteNoFuso(data, serie.hora_local, serie.fuso)
    const { rows } = await c.query<{ id: string }>(
      `insert into uj.eventos (comunidade_id, serie_id, ocorrencia_original, titulo, descricao, categoria,
         inicio, duracao_min, fuso, status, visibilidade, local_id, capacidade, informacoes_uteis)
       values ($1, $2, $3, $4, $5, $6, $3, $7, $8, $9, $10, $11, $12, $13)
       on conflict (serie_id, ocorrencia_original) where serie_id is not null do nothing
       returning id`,
      [
        serie.comunidade_id,
        serie.id,
        inicio,
        serie.titulo,
        serie.descricao,
        serie.categoria,
        serie.duracao_min,
        serie.fuso,
        serie.status_das_ocorrencias,
        serie.visibilidade,
        serie.local_id,
        serie.capacidade,
        serie.informacoes_uteis,
      ],
    )
    const id = rows[0]?.id
    if (!id) continue
    criadas++
    for (const [i, e] of serie.etapas.entries()) {
      await c.query(
        `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min, descricao)
         values ($1, $2, $3, $4, $5, $6)`,
        [serie.comunidade_id, id, i, e.titulo, e.duracaoMin, e.descricao ?? null],
      )
    }
    for (const [i, item] of serie.checklist.entries()) {
      await c.query(
        `insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto, ordem)
         values ($1, $2, $3, $4, $5)`,
        [serie.comunidade_id, id, item.tipo, item.texto, i],
      )
    }
  }
  await c.query('update uj.series set materializado_ate = $2 where id = $1', [
    serie.id,
    somarDias(ate, -1),
  ])
  return criadas
}

function limiteDaJanela(fuso: string): string {
  const hoje = dataNoFuso(new Date(), fuso)
  return somarDias(hoje, JANELA_DE_MATERIALIZACAO_DIAS)
}

/** Ocorrências futuras, não editadas, não canceladas, de uma série (a partir de um instante). */
async function futurasNaoEditadas(c: pg.PoolClient, serieId: string, aPartirDe: Date) {
  return (
    await c.query<{ id: string; tem_escala: boolean }>(
      `select e.id, exists (select 1 from uj.atribuicoes a where a.evento_id = e.id) as tem_escala
         from uj.eventos e
        where e.serie_id = $1 and e.ocorrencia_original >= $2
          and not e.editado_individualmente and e.status in ('rascunho', 'publicado')`,
      [serieId, aPartirDe],
    )
  ).rows
}

export function registrarRotasDeSeries(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId/series'

  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        if (e instanceof ErroHttp) throw e
        traduzirErroDoBanco(e)
      }
    })

  app.post(base, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'criar')
    const s = validar(
      z.object({
        regra: regraDeRecorrencia,
        horaLocal: hora,
        inicioEm: dataLocal,
        fimEm: dataLocal.nullish(),
        duracaoMin: z.number().int().min(5).max(1440).optional(),
        titulo: z.string().trim().min(2).max(120),
        categoria: z.string().trim().min(2).max(60),
        descricao: z.string().trim().max(5000).nullish(),
        localId: z.uuid().nullish(),
        visibilidade: z.enum(['interna', 'publica']).optional(),
        capacidade: z.number().int().min(1).max(100000).nullish(),
        informacoesUteis: z.string().trim().max(5000).nullish(),
        modelo: z.union([z.literal('sabado_padrao'), z.uuid()]).optional(),
        publicar: z.boolean().default(false),
      }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      let etapas: Serie['etapas'] = []
      let checklist: Serie['checklist'] = []
      if (s.modelo) {
        const embutido = MODELOS_EMBUTIDOS.find((m) => m.chave === s.modelo)
        if (embutido) {
          etapas = [...embutido.etapas]
          checklist = [...embutido.checklist]
        } else {
          const m = (
            await c.query<{ etapas: Serie['etapas']; checklist: Serie['checklist'] }>(
              'select etapas, checklist from uj.modelos where id = $1 and comunidade_id = $2',
              [s.modelo, comunidadeId],
            )
          ).rows[0]
          if (!m) throw NAO_ENCONTRADO()
          ;({ etapas, checklist } = m)
        }
      }
      const fuso = (
        await c.query<{ fuso: string }>('select fuso from uj.comunidades where id = $1', [
          comunidadeId,
        ])
      ).rows[0]!.fuso
      const duracao = s.duracaoMin ?? (etapas.reduce((t, e) => t + e.duracaoMin, 0) || 60)
      const { rows } = await c.query<{ id: string }>(
        `insert into uj.series (comunidade_id, regra, hora_local, fuso, duracao_min, inicio_em, fim_em,
           titulo, descricao, categoria, local_id, visibilidade, capacidade, informacoes_uteis,
           status_das_ocorrencias, etapas, checklist)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,coalesce($12,'interna'),$13,$14,$15,$16,$17) returning id`,
        [
          comunidadeId,
          JSON.stringify(s.regra),
          s.horaLocal,
          fuso,
          duracao,
          s.inicioEm,
          s.fimEm ?? null,
          s.titulo,
          s.descricao ?? null,
          s.categoria,
          s.localId ?? null,
          s.visibilidade ?? null,
          s.capacidade ?? null,
          s.informacoesUteis ?? null,
          s.publicar ? 'publicado' : 'rascunho',
          JSON.stringify(etapas),
          JSON.stringify(checklist),
        ],
      )
      const serie = await lerSerie(c, comunidadeId, rows[0]!.id)
      const ocorrencias = await materializar(c, serie, limiteDaJanela(fuso))
      await auditar(c, pedido, 'serie.criada', { tipo: 'serie', id: serie.id }, { ocorrencias })
      return { id: serie.id, ocorrencias }
    })
  })

  app.get(`${base}/:serieId`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'editar')
    const serieId = idDoCaminho(pedido, 'serieId')
    return tx(pedido, async (c) => {
      const serie = await lerSerie(c, pedido.comunidade!.id, serieId)
      const ocorrencias = (
        await c.query(
          `select id, inicio, status, editado_individualmente as "editadoIndividualmente"
             from uj.eventos where serie_id = $1 and inicio >= now() - interval '1 day'
            order by inicio limit 60`,
          [serieId],
        )
      ).rows
      return { ...serie, ocorrencias }
    })
  })

  app.patch(`${base}/:serieId`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'editar')
    const serieId = idDoCaminho(pedido, 'serieId')
    const p = validar(
      z.object({
        versao: z.number().int().min(1),
        escopo: z.enum(['serie', 'a_partir_de']),
        aPartirDoEvento: z.uuid().optional(),
        confirmarRecriacao: z.boolean().default(false),
        mudancas: z
          .object({
            titulo: z.string().trim().min(2).max(120).optional(),
            descricao: z.string().trim().max(5000).nullish(),
            categoria: z.string().trim().min(2).max(60).optional(),
            localId: z.uuid().nullish(),
            duracaoMin: z.number().int().min(5).max(1440).optional(),
            horaLocal: hora.optional(),
            regra: regraDeRecorrencia.optional(),
            fimEm: dataLocal.nullish(),
          })
          .refine((m) => Object.keys(m).length > 0, 'Nada para alterar.'),
      }),
      pedido.body,
    )
    if (p.escopo === 'a_partir_de' && !p.aPartirDoEvento) {
      throw new ErroHttp('dados_invalidos', 400, 'Escolha a ocorrência a partir da qual mudar.')
    }
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      const atual = await lerSerie(c, comunidadeId, serieId)
      if (atual.versao !== p.versao) {
        const e = new ErroHttp(
          'conflito',
          409,
          'Outra pessoa alterou esta série. Confira antes de salvar.',
        ) as ErroHttp & { atual?: unknown }
        e.atual = { versao: atual.versao }
        throw e
      }
      const m = p.mudancas
      const recria = m.horaLocal !== undefined || m.regra !== undefined

      // Ponto de corte: agora (série toda) ou a ocorrência escolhida.
      let corte = new Date()
      let serieAlvo = atual
      if (p.escopo === 'a_partir_de') {
        const ocorrencia = (
          await c.query<{ ocorrencia_original: Date }>(
            'select ocorrencia_original from uj.eventos where id = $1 and serie_id = $2',
            [p.aPartirDoEvento, serieId],
          )
        ).rows[0]
        if (!ocorrencia) throw NAO_ENCONTRADO()
        corte = ocorrencia.ocorrencia_original
      }
      const afetadas = await futurasNaoEditadas(c, serieId, corte)
      if (recria && afetadas.some((a) => a.tem_escala) && !p.confirmarRecriacao) {
        throw new ErroHttp(
          'confirmar_recriacao',
          409,
          `Mudar dia ou horário recria ${afetadas.length} ocorrência(s), e algumas já têm escala, que será perdida. Confirme para continuar.`,
        )
      }

      if (p.escopo === 'a_partir_de') {
        // Divide: a série atual termina na véspera; uma nova começa na data da ocorrência.
        const dataDoCorte = dataNoFuso(corte, atual.fuso)
        // Primeiro a nova (com o fim ORIGINAL), depois encurta a antiga.
        const { rows } = await c.query<{ id: string }>(
          `insert into uj.series (comunidade_id, regra, hora_local, fuso, duracao_min, inicio_em, fim_em,
             titulo, descricao, categoria, local_id, visibilidade, capacidade, informacoes_uteis,
             status_das_ocorrencias, etapas, checklist, materializado_ate)
           select comunidade_id, regra, hora_local, fuso, duracao_min, $2, $3::date, titulo, descricao,
                  categoria, local_id, visibilidade, capacidade, informacoes_uteis, status_das_ocorrencias,
                  etapas, checklist, materializado_ate
             from uj.series where id = $1 returning id`,
          [serieId, dataDoCorte, atual.fim_em],
        )
        await c.query('update uj.series set fim_em = $2 where id = $1', [
          serieId,
          somarDias(dataDoCorte, -1),
        ])
        await c.query('update uj.eventos set serie_id = $2 where id = any($1::uuid[])', [
          afetadas.map((a) => a.id),
          rows[0]!.id,
        ])
        serieAlvo = await lerSerie(c, comunidadeId, rows[0]!.id)
      }

      await c.query(
        `update uj.series set titulo = coalesce($2, titulo), categoria = coalesce($3, categoria),
            descricao = case when $4::boolean then $5 else descricao end,
            local_id = case when $6::boolean then $7::uuid else local_id end,
            duracao_min = coalesce($8, duracao_min), hora_local = coalesce($9, hora_local),
            regra = coalesce($10::jsonb, regra),
            fim_em = case when $11::boolean then $12::date else fim_em end
          where id = $1`,
        [
          serieAlvo.id,
          m.titulo ?? null,
          m.categoria ?? null,
          m.descricao !== undefined,
          m.descricao ?? null,
          m.localId !== undefined,
          m.localId ?? null,
          m.duracaoMin ?? null,
          m.horaLocal ?? null,
          m.regra ? JSON.stringify(m.regra) : null,
          m.fimEm !== undefined,
          m.fimEm ?? null,
        ],
      )

      const ids = (await futurasNaoEditadas(c, serieAlvo.id, corte)).map((a) => a.id)
      let recriadas = 0
      if (recria) {
        await c.query('delete from uj.eventos where id = any($1::uuid[])', [ids])
        const atualizada = await lerSerie(c, comunidadeId, serieAlvo.id)
        atualizada.materializado_ate = somarDias(dataNoFuso(corte, atualizada.fuso), -1)
        recriadas = await materializar(c, atualizada, limiteDaJanela(atualizada.fuso))
      } else {
        await c.query(
          `update uj.eventos set titulo = coalesce($2, titulo), categoria = coalesce($3, categoria),
              descricao = case when $4::boolean then $5 else descricao end,
              local_id = case when $6::boolean then $7::uuid else local_id end,
              duracao_min = coalesce($8, duracao_min)
            where id = any($1::uuid[])`,
          [
            ids,
            m.titulo ?? null,
            m.categoria ?? null,
            m.descricao !== undefined,
            m.descricao ?? null,
            m.localId !== undefined,
            m.localId ?? null,
            m.duracaoMin ?? null,
          ],
        )
        // Fim antecipado: ocorrências depois do novo fim deixam de existir.
        if (m.fimEm) {
          await c.query(
            `delete from uj.eventos where id = any($1::uuid[]) and inicio >= ($2::date + 1)::timestamp at time zone $3`,
            [ids, m.fimEm, serieAlvo.fuso],
          )
        }
      }
      await auditar(
        c,
        pedido,
        'serie.alterada',
        { tipo: 'serie', id: serieAlvo.id },
        {
          escopo: p.escopo,
          campos: Object.keys(m),
          recriadas,
        },
      )
      return { serieId: serieAlvo.id, afetadas: ids.length, recriadas }
    })
  })

  /** Encerra a série a partir de uma data: rascunhos somem, publicados são cancelados com motivo. */
  app.post(`${base}/:serieId/encerrar`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'cancelar_ou_adiar')
    const serieId = idDoCaminho(pedido, 'serieId')
    const p = validar(
      z.object({ aPartirDe: dataLocal, motivo: z.string().trim().min(3).max(500) }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const serie = await lerSerie(c, pedido.comunidade!.id, serieId)
      await c.query('update uj.series set fim_em = $2 where id = $1', [
        serieId,
        somarDias(p.aPartirDe, -1),
      ])
      const limite = instanteNoFuso(p.aPartirDe, '00:00', serie.fuso)
      const apagados = await c.query(
        "delete from uj.eventos where serie_id = $1 and inicio >= $2 and status = 'rascunho'",
        [serieId, limite],
      )
      const cancelados = await c.query(
        `update uj.eventos set status = 'cancelado', motivo_status = $3
          where serie_id = $1 and inicio >= $2 and status in ('publicado', 'adiado')`,
        [serieId, limite, p.motivo],
      )
      await auditar(
        c,
        pedido,
        'serie.encerrada',
        { tipo: 'serie', id: serieId },
        {
          aPartirDe: p.aPartirDe,
          cancelados: cancelados.rowCount,
        },
      )
      return { apagados: apagados.rowCount, cancelados: cancelados.rowCount }
    })
  })
}

/**
 * Job diário: estende a janela de todas as séries ativas. Roda com a conexão
 * do DONO do banco (job do servidor, sem usuário), fora das rotas.
 */
export async function materializarTodas(dono: pg.Pool): Promise<number> {
  const c = await dono.connect()
  try {
    const { rows } = await c.query<Serie>(
      `select ${COLUNAS_DA_SERIE} from uj.series s
        where (fim_em is null or fim_em >= current_date)
          and exists (select 1 from uj.comunidades m where m.id = s.comunidade_id and m.estado = 'ativa')`,
    )
    let total = 0
    for (const serie of rows) {
      await c.query('begin')
      try {
        total += await materializar(c, serie, limiteDaJanela(serie.fuso))
        await c.query('commit')
      } catch (e) {
        await c.query('rollback')
        throw e
      }
    }
    return total
  } finally {
    c.release()
  }
}
