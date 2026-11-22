import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import {
  calcularHorarios,
  MODELOS_EMBUTIDOS,
  podeMudarStatus,
  STATUS_DO_EVENTO,
  type StatusDoEvento,
} from '@uj/dominio'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Eventos e programação (F7). Toda rota está sob /api/v1/c/:comunidadeId,
 * passa pela matriz de permissões (exigir) e, de novo, pela RLS do banco.
 * Concorrência: edições de evento e etapa levam a `versao` lida; se outra
 * pessoa salvou antes, a resposta é 409 com a versão atual, e o app mostra o
 * conflito em vez de sobrescrever (ADR 0005).
 */

const uuid = z.uuid()
const dataHora = z.iso.datetime({ offset: true, message: 'Data e hora inválidas.' })
const texto = (max: number) => z.string().trim().max(max)

const campoEvento = {
  titulo: z.string().trim().min(2, 'Dê um título ao evento.').max(120),
  descricao: texto(5000).nullish(),
  categoria: z.string().trim().min(2).max(60),
  inicio: dataHora,
  duracaoMin: z.number().int().min(5).max(1440),
  localId: uuid.nullish(),
  capacidade: z.number().int().min(1).max(100000).nullish(),
  inscricaoAte: dataHora.nullish(),
  listaDeEspera: z.boolean().optional(),
  informacoesUteis: texto(5000).nullish(),
  visibilidade: z.enum(['interna', 'publica']).optional(),
}

const etapaNova = z.object({
  titulo: z.string().trim().min(1).max(120),
  duracaoMin: z.number().int().min(1).max(600),
  descricao: texto(2000).nullish(),
})

const itemDeChecklist = z.object({
  tipo: z.enum(['preparacao', 'encerramento']),
  texto: z.string().trim().min(1).max(300),
})

function conflito(atual: unknown): ErroHttp & { atual?: unknown } {
  const e = new ErroHttp(
    'conflito',
    409,
    'Outra pessoa alterou isto enquanto você editava. Confira a versão atual antes de salvar de novo.',
  ) as ErroHttp & { atual?: unknown }
  e.atual = atual
  return e
}

async function tx<T>(
  api: pg.Pool,
  pedido: FastifyRequest,
  trabalho: (c: pg.PoolClient) => Promise<T>,
) {
  return naComunidade(api, pedido, async (c) => {
    try {
      return await trabalho(c)
    } catch (e) {
      if (e instanceof ErroHttp) throw e
      traduzirErroDoBanco(e)
    }
  })
}

/** Mexer no conteúdo de uma ocorrência a separa da série ("esta ocorrência"). */
async function marcarEditado(c: pg.PoolClient, comunidadeId: string, eventoId: string) {
  await c.query(
    'update uj.eventos set editado_individualmente = true where id = $1 and comunidade_id = $2 and serie_id is not null',
    [eventoId, comunidadeId],
  )
}

async function exigirEvento(c: pg.PoolClient, comunidadeId: string, eventoId: string) {
  const { rows } = await c.query<{
    id: string
    status: StatusDoEvento
    inicio: Date
    versao: number
    fuso: string
  }>(
    'select id, status, inicio, versao, fuso from uj.eventos where id = $1 and comunidade_id = $2',
    [eventoId, comunidadeId],
  )
  if (!rows[0]) throw NAO_ENCONTRADO()
  return rows[0]
}

export function registrarRotasDeEventos(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId'
  const ev = `${base}/eventos/:eventoId`

  // ================================================================ locais

  app.get(`${base}/locais`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'ler')
    return tx(api, pedido, async (c) => ({
      locais: (
        await c.query(
          `select id, nome, tipo, endereco, latitude, longitude, referencia, arquivado, versao
             from uj.locais where comunidade_id = $1 order by arquivado, nome`,
          [pedido.comunidade!.id],
        )
      ).rows,
    }))
  })

  const corpoLocal = z
    .object({
      nome: z.string().trim().min(2).max(120),
      tipo: z.enum(['interno', 'externo']),
      endereco: texto(300).nullish(),
      latitude: z.number().min(-90).max(90).nullish(),
      longitude: z.number().min(-180).max(180).nullish(),
      referencia: texto(300).nullish(),
    })
    .refine((l) => l.tipo === 'interno' || !!l.endereco, 'Informe o endereço do local externo.')
    .refine(
      (l) =>
        (l.latitude === null || l.latitude === undefined) ===
        (l.longitude === null || l.longitude === undefined),
      'Informe latitude e longitude juntas.',
    )

  app.post(`${base}/locais`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'criar')
    const l = validar(corpoLocal, pedido.body)
    return tx(api, pedido, async (c) => {
      const { rows } = await c.query(
        `insert into uj.locais (comunidade_id, nome, tipo, endereco, latitude, longitude, referencia)
         values ($1, $2, $3, $4, $5, $6, $7) returning id, versao`,
        [
          pedido.comunidade!.id,
          l.nome,
          l.tipo,
          l.endereco ?? null,
          l.latitude ?? null,
          l.longitude ?? null,
          l.referencia ?? null,
        ],
      )
      return rows[0]
    })
  })

  app.patch(`${base}/locais/:localId`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'editar')
    const localId = idDoCaminho(pedido, 'localId')
    const l = validar(
      z.object({
        nome: z.string().trim().min(2).max(120).optional(),
        endereco: texto(300).nullish(),
        referencia: texto(300).nullish(),
        arquivado: z.boolean().optional(),
      }),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      const { rows } = await c.query(
        `update uj.locais set nome = coalesce($3, nome),
                endereco = case when $4::boolean then $5 else endereco end,
                referencia = case when $6::boolean then $7 else referencia end,
                arquivado = coalesce($8, arquivado)
          where id = $1 and comunidade_id = $2 returning id, versao`,
        [
          localId,
          pedido.comunidade!.id,
          l.nome ?? null,
          l.endereco !== undefined,
          l.endereco ?? null,
          l.referencia !== undefined,
          l.referencia ?? null,
          l.arquivado ?? null,
        ],
      )
      if (!rows[0]) throw NAO_ENCONTRADO()
      return rows[0]
    })
  })

  // ================================================================ modelos

  app.get(`${base}/modelos`, naCom, async (pedido) => {
    exigir(pedido, 'modelo', 'ler')
    return tx(api, pedido, async (c) => ({
      embutidos: MODELOS_EMBUTIDOS,
      daComunidade: (
        await c.query(
          `select id, nome, categoria, descricao, etapas, checklist from uj.modelos
            where comunidade_id = $1 order by nome`,
          [pedido.comunidade!.id],
        )
      ).rows,
    }))
  })

  app.post(`${base}/modelos`, naCom, async (pedido) => {
    exigir(pedido, 'modelo', 'gerenciar')
    const m = validar(
      z.union([
        z.object({ aPartirDoEvento: uuid, nome: z.string().trim().min(2).max(80) }),
        z.object({
          nome: z.string().trim().min(2).max(80),
          categoria: z.string().trim().min(2).max(60),
          descricao: texto(2000).nullish(),
          etapas: z.array(etapaNova).max(50),
          checklist: z.array(itemDeChecklist).max(100).default([]),
        }),
      ]),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      let dados: {
        nome: string
        categoria: string
        descricao: string | null
        etapas: unknown
        checklist: unknown
      }
      if ('aPartirDoEvento' in m) {
        const evento = (
          await c.query<{ categoria: string; descricao: string | null }>(
            'select categoria, descricao from uj.eventos where id = $1 and comunidade_id = $2',
            [m.aPartirDoEvento, comunidadeId],
          )
        ).rows[0]
        if (!evento) throw NAO_ENCONTRADO()
        const etapas = (
          await c.query(
            `select titulo, duracao_min as "duracaoMin", descricao from uj.etapas
              where evento_id = $1 order by ordem`,
            [m.aPartirDoEvento],
          )
        ).rows
        const checklist = (
          await c.query(
            'select tipo, texto from uj.checklist_itens where evento_id = $1 order by tipo, ordem',
            [m.aPartirDoEvento],
          )
        ).rows
        dados = {
          nome: m.nome,
          categoria: evento.categoria,
          descricao: evento.descricao,
          etapas,
          checklist,
        }
      } else {
        dados = {
          nome: m.nome,
          categoria: m.categoria,
          descricao: m.descricao ?? null,
          etapas: m.etapas,
          checklist: m.checklist,
        }
      }
      const { rows } = await c.query(
        `insert into uj.modelos (comunidade_id, nome, categoria, descricao, etapas, checklist)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [
          comunidadeId,
          dados.nome,
          dados.categoria,
          dados.descricao,
          JSON.stringify(dados.etapas),
          JSON.stringify(dados.checklist),
        ],
      )
      return rows[0]
    })
  })

  app.delete(`${base}/modelos/:modeloId`, naCom, async (pedido) => {
    exigir(pedido, 'modelo', 'gerenciar')
    const modeloId = idDoCaminho(pedido, 'modeloId')
    return tx(api, pedido, async (c) => {
      const r = await c.query('delete from uj.modelos where id = $1 and comunidade_id = $2', [
        modeloId,
        pedido.comunidade!.id,
      ])
      if (!r.rowCount) throw NAO_ENCONTRADO()
      return { ok: true }
    })
  })

  // ================================================================ eventos

  app.get(`${base}/eventos`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'ler')
    const q = validar(
      z.object({
        de: dataHora.optional(),
        ate: dataHora.optional(),
        limite: z.coerce.number().int().min(1).max(500).default(200),
      }),
      pedido.query,
    )
    return tx(api, pedido, async (c) => ({
      eventos: (
        await c.query(
          `select e.id, e.titulo, e.categoria, e.inicio, e.duracao_min as "duracaoMin", e.fuso,
                  e.status, e.visibilidade, e.serie_id as "serieId", e.versao,
                  l.nome as "localNome", l.tipo as "localTipo",
                  (select count(*)::int from uj.etapas t where t.evento_id = e.id) as "quantidadeDeEtapas"
             from uj.eventos e left join uj.locais l on l.id = e.local_id
            where e.comunidade_id = $1
              and ($2::timestamptz is null or e.inicio >= $2)
              and ($3::timestamptz is null or e.inicio < $3)
            order by e.inicio limit $4`,
          [pedido.comunidade!.id, q.de ?? null, q.ate ?? null, q.limite],
        )
      ).rows,
    }))
  })

  // ---------------------------------------------------------------- limpar os próximos encontros (D77)

  /** Os números da tela de confirmação (a função do banco confere o papel de novo). */
  async function resumoDosProximos(c: pg.PoolClient) {
    const { rows } = await c.query<{
      rascunhos: number
      publicados: number
      adiados: number
      cancelados: number
      encerrados: number
      pessoas_a_avisar: number
      repeticoes_ativas: number
    }>('select * from uj.resumo_dos_proximos_encontros()')
    const r = rows[0]
    if (!r) throw NAO_ENCONTRADO()
    return {
      total: r.rascunhos + r.publicados + r.adiados + r.cancelados + r.encerrados,
      rascunhos: r.rascunhos,
      publicados: r.publicados,
      adiados: r.adiados,
      cancelados: r.cancelados,
      encerrados: r.encerrados,
      // Quem receberia o aviso se os encontros publicados fossem cancelados (sem contar a própria pessoa).
      pessoasAAvisar: r.pessoas_a_avisar,
      repeticoesAtivas: r.repeticoes_ativas,
    }
  }

  app.get(`${base}/eventos/limpar-proximos`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'limpar_proximos')
    return tx(api, pedido, resumoDosProximos)
  })

  /**
   * Limpa de uma vez TODOS os encontros que ainda não começaram (rascunhos, publicados,
   * adiados e cancelados), útil para tirar dados de teste. Dois modos:
   * - `apagar`: apaga tudo e não avisa ninguém (o aviso nasce da MUDANÇA de status, no
   *   banco; apagar não muda status). É irreversível: some até o que as pessoas já viam;
   * - `cancelar_e_avisar`: rascunhos são apagados; publicados e adiados viram cancelados
   *   (quem participa é avisado pelo gatilho de sempre) e ficam na agenda como cancelados.
   * Reusa as regras que já existem (apagar rascunho, cancelar com motivo). `totalEsperado`
   * é o número que a pessoa viu: se a agenda mudou no meio do caminho, 409 e a tela
   * mostra os números novos. Sem nada a limpar, responde 200 com zeros (repetir é seguro).
   * A auditoria leva só o modo e as contagens, nunca títulos.
   */
  app.post(`${base}/eventos/limpar-proximos`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'limpar_proximos')
    const corpo = validar(
      z.object({
        modo: z.enum(['apagar', 'cancelar_e_avisar'], { error: 'Escolha o que fazer.' }),
        confirmo: z.literal(true, { error: 'Confirme a limpeza.' }),
        totalEsperado: z.number().int().min(0).max(100000),
        motivo: texto(500).optional(),
      }),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      const antes = await resumoDosProximos(c)
      if (antes.total === 0) {
        return { ok: true, modo: corpo.modo, apagados: 0, cancelados: 0, pessoasAvisadas: 0 }
      }
      if (antes.total !== corpo.totalEsperado) {
        throw new ErroHttp(
          'agenda_mudou',
          409,
          'A agenda mudou enquanto você decidia. Confira os números de novo.',
        )
      }
      const comunidadeId = pedido.comunidade!.id
      let apagados: number
      let cancelados = 0
      if (corpo.modo === 'apagar') {
        apagados =
          (
            await c.query('delete from uj.eventos where comunidade_id = $1 and inicio > now()', [
              comunidadeId,
            ])
          ).rowCount ?? 0
      } else {
        apagados =
          (
            await c.query(
              "delete from uj.eventos where comunidade_id = $1 and inicio > now() and status = 'rascunho'",
              [comunidadeId],
            )
          ).rowCount ?? 0
        cancelados =
          (
            await c.query(
              `update uj.eventos set status = 'cancelado', motivo_status = $2
                where comunidade_id = $1 and inicio > now() and status in ('publicado', 'adiado')`,
              [comunidadeId, corpo.motivo?.trim() || 'Agenda reorganizada pela liderança.'],
            )
          ).rowCount ?? 0
      }
      const pessoasAvisadas = corpo.modo === 'cancelar_e_avisar' ? antes.pessoasAAvisar : 0
      await auditar(
        c,
        pedido,
        'evento.proximos_limpos',
        { tipo: 'comunidade', id: comunidadeId },
        { modo: corpo.modo, apagados, cancelados, pessoasAvisadas },
      )
      return { ok: true, modo: corpo.modo, apagados, cancelados, pessoasAvisadas }
    })
  })

  app.post(`${base}/eventos`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'criar')
    const e = validar(
      z.object({
        ...campoEvento,
        duracaoMin: campoEvento.duracaoMin.optional(),
        modelo: z.union([z.literal('sabado_padrao'), uuid]).optional(),
      }),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      let etapas: { titulo: string; duracaoMin: number; descricao?: string | null }[] = []
      let checklist: { tipo: string; texto: string }[] = []
      if (e.modelo) {
        const embutido = MODELOS_EMBUTIDOS.find((m) => m.chave === e.modelo)
        if (embutido) {
          etapas = [...embutido.etapas]
          checklist = [...embutido.checklist]
        } else {
          const m = (
            await c.query<{ etapas: typeof etapas; checklist: typeof checklist }>(
              'select etapas, checklist from uj.modelos where id = $1 and comunidade_id = $2',
              [e.modelo, comunidadeId],
            )
          ).rows[0]
          if (!m) throw NAO_ENCONTRADO()
          etapas = m.etapas
          checklist = m.checklist
        }
      }
      const duracao = e.duracaoMin ?? (etapas.reduce((s, x) => s + x.duracaoMin, 0) || 60)
      const fuso = (
        await c.query<{ fuso: string }>('select fuso from uj.comunidades where id = $1', [
          comunidadeId,
        ])
      ).rows[0]!.fuso
      const { rows } = await c.query<{ id: string; versao: number }>(
        `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
           local_id, capacidade, inscricao_ate, lista_de_espera, informacoes_uteis, visibilidade)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce($11,false),$12,coalesce($13,'interna'))
         returning id, versao`,
        [
          comunidadeId,
          e.titulo,
          e.descricao ?? null,
          e.categoria,
          e.inicio,
          duracao,
          fuso,
          e.localId ?? null,
          e.capacidade ?? null,
          e.inscricaoAte ?? null,
          e.listaDeEspera ?? null,
          e.informacoesUteis ?? null,
          e.visibilidade ?? null,
        ],
      )
      const id = rows[0]!.id
      for (const [i, etapa] of etapas.entries()) {
        await c.query(
          `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min, descricao)
           values ($1, $2, $3, $4, $5, $6)`,
          [comunidadeId, id, i, etapa.titulo, etapa.duracaoMin, etapa.descricao ?? null],
        )
      }
      for (const [i, item] of checklist.entries()) {
        await c.query(
          `insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto, ordem)
           values ($1, $2, $3, $4, $5)`,
          [comunidadeId, id, item.tipo, item.texto, i],
        )
      }
      await auditar(c, pedido, 'evento.criado', { tipo: 'evento', id })
      return rows[0]
    })
  })

  app.get(ev, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'ler')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const organizador = pedido.comunidade!.papel !== 'membro'
    return tx(api, pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      const evento = (
        await c.query(
          `select e.id, e.titulo, e.descricao, e.categoria, e.inicio, e.duracao_min as "duracaoMin", e.fuso,
                  e.status, e.motivo_status as "motivoStatus", e.visibilidade, e.capacidade,
                  e.inscricao_ate as "inscricaoAte", e.lista_de_espera as "listaDeEspera",
                  e.informacoes_uteis as "informacoesUteis", e.serie_id as "serieId", e.versao,
                  e.id_publico as "idPublico",
                  case when l.id is null then null else json_build_object('id', l.id, 'nome', l.nome,
                    'tipo', l.tipo, 'endereco', l.endereco, 'latitude', l.latitude, 'longitude', l.longitude,
                    'referencia', l.referencia) end as local
             from uj.eventos e left join uj.locais l on l.id = e.local_id
            where e.id = $1 and e.comunidade_id = $2`,
          [eventoId, comunidadeId],
        )
      ).rows[0] as { inicio: Date } | undefined
      if (!evento) throw NAO_ENCONTRADO()
      const nomes = new Map(
        (
          await c.query<{ vinculo_id: string; nome: string }>(
            'select vinculo_id, nome from uj.pessoas_da_comunidade()',
          )
        ).rows.map((p) => [p.vinculo_id, p.nome]),
      )
      const etapas = (
        await c.query<{ id: string; duracaoMin: number }>(
          `select id, ordem, titulo, descricao, duracao_min as "duracaoMin", versao
             from uj.etapas where evento_id = $1 order by ordem`,
          [eventoId],
        )
      ).rows
      const horarios = calcularHorarios(new Date(evento.inicio), etapas)
      const atribuicoes = (
        await c.query<{ vinculoId: string }>(
          `select id, etapa_id as "etapaId", vinculo_id as "vinculoId", funcao, estado
             from uj.atribuicoes where evento_id = $1 order by criado_em`,
          [eventoId],
        )
      ).rows.map((a) => ({ ...a, nome: nomes.get(a.vinculoId) ?? 'Pessoa removida' }))
      const comNome = <T extends { responsavelVinculoId: string | null }>(l: T[]) =>
        l.map((x) => ({
          ...x,
          responsavelNome: x.responsavelVinculoId
            ? (nomes.get(x.responsavelVinculoId) ?? null)
            : null,
        }))
      const tarefas = comNome(
        (
          await c.query(
            `select id, titulo, descricao, responsavel_vinculo_id as "responsavelVinculoId", prazo,
                    concluida_em as "concluidaEm", versao
               from uj.tarefas where evento_id = $1 order by prazo nulls last, criado_em`,
            [eventoId],
          )
        ).rows,
      )
      const materiais = comNome(
        (
          await c.query(
            `select id, nome, quantidade, responsavel_vinculo_id as "responsavelVinculoId",
                    providenciado_em as "providenciadoEm", versao
               from uj.materiais where evento_id = $1 order by criado_em`,
            [eventoId],
          )
        ).rows,
      )
      const checklist = comNome(
        (
          await c.query(
            `select id, tipo, texto, ordem, responsavel_vinculo_id as "responsavelVinculoId",
                    marcado_em as "marcadoEm", versao
               from uj.checklist_itens where evento_id = $1 order by tipo, ordem`,
            [eventoId],
          )
        ).rows,
      )
      const anexos = (
        await c.query(
          'select id, tipo, titulo, url, criado_em as "criadoEm" from uj.anexos where evento_id = $1 order by criado_em',
          [eventoId],
        )
      ).rows
      const notas = organizador
        ? (
            await c.query(
              `select n.id, n.texto, n.criado_em as "criadoEm", n.autor_conta_id as "autorContaId"
                 from uj.notas_internas n where n.evento_id = $1 order by n.criado_em`,
              [eventoId],
            )
          ).rows
        : []
      return {
        ...evento,
        etapas: etapas.map((e, i) => ({
          ...e,
          inicioPrevisto: horarios[i]!.inicio,
          fimPrevisto: horarios[i]!.fim,
        })),
        atribuicoes,
        tarefas,
        materiais,
        checklist,
        anexos,
        notas,
      }
    })
  })

  app.patch(ev, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'editar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const m = validar(
      z
        .object({
          versao: z.number().int().min(1),
          titulo: campoEvento.titulo.optional(),
          descricao: campoEvento.descricao,
          categoria: campoEvento.categoria.optional(),
          inicio: campoEvento.inicio.optional(),
          duracaoMin: campoEvento.duracaoMin.optional(),
          localId: campoEvento.localId,
          capacidade: campoEvento.capacidade,
          inscricaoAte: campoEvento.inscricaoAte,
          listaDeEspera: campoEvento.listaDeEspera,
          informacoesUteis: campoEvento.informacoesUteis,
          visibilidade: campoEvento.visibilidade,
        })
        .strict(),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      const atual = await exigirEvento(c, pedido.comunidade!.id, eventoId)
      if (atual.versao !== m.versao) throw conflito({ versao: atual.versao })
      const enviado = (k: keyof typeof m) => (m[k] !== undefined ? 'true' : 'false')
      const { rows } = await c.query(
        `update uj.eventos set
            titulo = coalesce($3, titulo), categoria = coalesce($4, categoria),
            inicio = coalesce($5, inicio), duracao_min = coalesce($6, duracao_min),
            descricao = case when $7::boolean then $8 else descricao end,
            local_id = case when $9::boolean then $10::uuid else local_id end,
            capacidade = case when $11::boolean then $12::int else capacidade end,
            inscricao_ate = case when $13::boolean then $14::timestamptz else inscricao_ate end,
            lista_de_espera = coalesce($15, lista_de_espera),
            informacoes_uteis = case when $16::boolean then $17 else informacoes_uteis end,
            visibilidade = coalesce($18, visibilidade),
            editado_individualmente = editado_individualmente or serie_id is not null
          where id = $1 and comunidade_id = $2 and versao = $19
          returning id, versao`,
        [
          eventoId,
          pedido.comunidade!.id,
          m.titulo ?? null,
          m.categoria ?? null,
          m.inicio ?? null,
          m.duracaoMin ?? null,
          enviado('descricao'),
          m.descricao ?? null,
          enviado('localId'),
          m.localId ?? null,
          enviado('capacidade'),
          m.capacidade ?? null,
          enviado('inscricaoAte'),
          m.inscricaoAte ?? null,
          m.listaDeEspera ?? null,
          enviado('informacoesUteis'),
          m.informacoesUteis ?? null,
          m.visibilidade ?? null,
          m.versao,
        ],
      )
      if (!rows[0]) throw conflito({ versao: atual.versao })
      await auditar(
        c,
        pedido,
        'evento.editado',
        { tipo: 'evento', id: eventoId },
        {
          campos: Object.keys(m).filter((k) => k !== 'versao'),
        },
      )
      return rows[0]
    })
  })

  app.post(`${ev}/status`, naCom, async (pedido) => {
    const corpo = validar(
      z.object({
        status: z.enum(STATUS_DO_EVENTO),
        motivo: texto(500).nullish(),
        novoInicio: dataHora.nullish(),
      }),
      pedido.body,
    )
    exigir(pedido, 'evento', corpo.status === 'publicado' ? 'publicar' : 'cancelar_ou_adiar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(api, pedido, async (c) => {
      const atual = await exigirEvento(c, pedido.comunidade!.id, eventoId)
      if (!podeMudarStatus(atual.status, corpo.status)) {
        throw new ErroHttp(
          'transicao_invalida',
          409,
          `Um evento "${atual.status}" não pode passar para "${corpo.status}".`,
        )
      }
      if ((corpo.status === 'cancelado' || corpo.status === 'adiado') && !corpo.motivo) {
        throw new ErroHttp(
          'motivo_necessario',
          400,
          'Explique o motivo: ele vai para quem participa.',
        )
      }
      const { rows } = await c.query(
        `update uj.eventos set status = $3, motivo_status = $4, inicio = coalesce($5, inicio)
          where id = $1 and comunidade_id = $2 returning id, status, inicio, versao`,
        [
          eventoId,
          pedido.comunidade!.id,
          corpo.status,
          corpo.motivo ?? null,
          corpo.novoInicio ?? null,
        ],
      )
      // Aviso aos escalados e inscritos: F14 (notificações) lê esta auditoria.
      await auditar(
        c,
        pedido,
        `evento.${corpo.status}`,
        { tipo: 'evento', id: eventoId },
        {
          de: atual.status,
          ...(corpo.novoInicio ? { novoInicio: corpo.novoInicio } : {}),
        },
      )
      return rows[0]
    })
  })

  app.delete(ev, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'excluir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(api, pedido, async (c) => {
      const atual = await exigirEvento(c, pedido.comunidade!.id, eventoId)
      if (atual.status !== 'rascunho') {
        throw new ErroHttp(
          'so_rascunho',
          409,
          'Só rascunhos podem ser excluídos. Um evento publicado deve ser cancelado, para avisar quem participa.',
        )
      }
      await c.query('delete from uj.eventos where id = $1 and comunidade_id = $2', [
        eventoId,
        pedido.comunidade!.id,
      ])
      await auditar(c, pedido, 'evento.excluido', { tipo: 'evento', id: eventoId })
      return { ok: true }
    })
  })

  app.post(`${ev}/duplicar`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'criar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const corpo = validar(z.object({ inicio: dataHora }), pedido.body)
    return tx(api, pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      await exigirEvento(c, comunidadeId, eventoId)
      const { rows } = await c.query<{ id: string }>(
        `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
           local_id, capacidade, lista_de_espera, informacoes_uteis, visibilidade)
         select comunidade_id, titulo, descricao, categoria, $3, duracao_min, fuso, local_id, capacidade,
                lista_de_espera, informacoes_uteis, visibilidade
           from uj.eventos where id = $1 and comunidade_id = $2
         returning id`,
        [eventoId, comunidadeId, corpo.inicio],
      )
      const novo = rows[0]!.id
      await c.query(
        `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, descricao, duracao_min)
         select comunidade_id, $2, ordem, titulo, descricao, duracao_min from uj.etapas where evento_id = $1`,
        [eventoId, novo],
      )
      await c.query(
        `insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto, ordem, responsavel_vinculo_id)
         select comunidade_id, $2, tipo, texto, ordem, responsavel_vinculo_id from uj.checklist_itens where evento_id = $1`,
        [eventoId, novo],
      )
      await c.query(
        `insert into uj.tarefas (comunidade_id, evento_id, titulo, descricao, responsavel_vinculo_id)
         select comunidade_id, $2, titulo, descricao, responsavel_vinculo_id from uj.tarefas where evento_id = $1`,
        [eventoId, novo],
      )
      await c.query(
        `insert into uj.materiais (comunidade_id, evento_id, nome, quantidade, responsavel_vinculo_id)
         select comunidade_id, $2, nome, quantidade, responsavel_vinculo_id from uj.materiais where evento_id = $1`,
        [eventoId, novo],
      )
      await auditar(
        c,
        pedido,
        'evento.duplicado',
        { tipo: 'evento', id: novo },
        { origem: eventoId },
      )
      return { id: novo }
    })
  })

  // ================================================================ etapas

  app.post(`${ev}/etapas`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const e = validar(etapaNova, pedido.body)
    return tx(api, pedido, async (c) => {
      await marcarEditado(c, pedido.comunidade!.id, eventoId)
      await exigirEvento(c, pedido.comunidade!.id, eventoId)
      const { rows } = await c.query(
        `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min, descricao)
         values ($1, $2, (select coalesce(max(ordem) + 1, 0) from uj.etapas where evento_id = $2), $3, $4, $5)
         returning id, ordem, versao`,
        [pedido.comunidade!.id, eventoId, e.titulo, e.duracaoMin, e.descricao ?? null],
      )
      return rows[0]
    })
  })

  app.patch(`${ev}/etapas/:etapaId`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const etapaId = idDoCaminho(pedido, 'etapaId')
    const e = validar(
      z.object({
        versao: z.number().int().min(1).optional(),
        titulo: etapaNova.shape.titulo.optional(),
        duracaoMin: etapaNova.shape.duracaoMin.optional(),
        descricao: etapaNova.shape.descricao,
      }),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      await marcarEditado(c, pedido.comunidade!.id, eventoId)
      const { rows } = await c.query(
        `update uj.etapas set titulo = coalesce($4, titulo), duracao_min = coalesce($5, duracao_min),
                descricao = case when $6::boolean then $7 else descricao end
          where id = $1 and evento_id = $2 and comunidade_id = $3 and ($8::int is null or versao = $8)
          returning id, versao`,
        [
          etapaId,
          eventoId,
          pedido.comunidade!.id,
          e.titulo ?? null,
          e.duracaoMin ?? null,
          e.descricao !== undefined,
          e.descricao ?? null,
          e.versao ?? null,
        ],
      )
      if (!rows[0]) {
        const existe = await c.query(
          'select versao from uj.etapas where id = $1 and evento_id = $2',
          [etapaId, eventoId],
        )
        if (existe.rows[0]) throw conflito(existe.rows[0])
        throw NAO_ENCONTRADO()
      }
      return rows[0]
    })
  })

  app.delete(`${ev}/etapas/:etapaId`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const etapaId = idDoCaminho(pedido, 'etapaId')
    return tx(api, pedido, async (c) => {
      await marcarEditado(c, pedido.comunidade!.id, eventoId)
      const r = await c.query(
        'delete from uj.etapas where id = $1 and evento_id = $2 and comunidade_id = $3 returning ordem',
        [etapaId, eventoId, pedido.comunidade!.id],
      )
      if (!r.rowCount) throw NAO_ENCONTRADO()
      // Fecha o buraco na ordem.
      await c.query('update uj.etapas set ordem = ordem - 1 where evento_id = $1 and ordem > $2', [
        eventoId,
        r.rows[0].ordem,
      ])
      return { ok: true }
    })
  })

  /** Reordenar: a lista nova precisa ter exatamente as etapas atuais. */
  app.put(`${ev}/etapas/ordem`, naCom, async (pedido) => {
    exigir(pedido, 'etapa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const { ids } = validar(z.object({ ids: z.array(uuid).min(1).max(100) }), pedido.body)
    return tx(api, pedido, async (c) => {
      await marcarEditado(c, pedido.comunidade!.id, eventoId)
      await exigirEvento(c, pedido.comunidade!.id, eventoId)
      const atuais = (
        await c.query<{ id: string }>('select id from uj.etapas where evento_id = $1 for update', [
          eventoId,
        ])
      ).rows.map((r) => r.id)
      if (
        atuais.length !== ids.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((i) => atuais.includes(i))
      ) {
        throw conflito({ etapas: atuais })
      }
      for (const [ordem, id] of ids.entries()) {
        await c.query('update uj.etapas set ordem = $3 where id = $1 and evento_id = $2', [
          id,
          eventoId,
          ordem,
        ])
      }
      return { ok: true }
    })
  })

  // ================================================================ atribuições (responsáveis e integrantes)

  app.post(`${ev}/atribuicoes`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'atribuir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const a = validar(
      z.object({
        vinculoId: uuid,
        etapaId: uuid.nullish(),
        funcao: z.string().trim().min(2).max(60).default('integrante'),
      }),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      await exigirEvento(c, pedido.comunidade!.id, eventoId)
      const { rows } = await c.query(
        `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao)
         values ($1, $2, $3, $4, $5) returning id, estado`,
        [pedido.comunidade!.id, eventoId, a.etapaId ?? null, a.vinculoId, a.funcao],
      )
      return rows[0]
    })
  })

  app.delete(`${ev}/atribuicoes/:atribuicaoId`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'atribuir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const atribuicaoId = idDoCaminho(pedido, 'atribuicaoId')
    return tx(api, pedido, async (c) => {
      const r = await c.query(
        'delete from uj.atribuicoes where id = $1 and evento_id = $2 and comunidade_id = $3',
        [atribuicaoId, eventoId, pedido.comunidade!.id],
      )
      if (!r.rowCount) throw NAO_ENCONTRADO()
      return { ok: true }
    })
  })

  // ================================================================ tarefas, materiais, checklist

  app.post(`${ev}/tarefas`, naCom, async (pedido) => {
    exigir(pedido, 'tarefa', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const t = validar(
      z.object({
        titulo: z.string().trim().min(2).max(200),
        descricao: texto(2000).nullish(),
        responsavelVinculoId: uuid.nullish(),
        prazo: dataHora.nullish(),
      }),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      await exigirEvento(c, pedido.comunidade!.id, eventoId)
      const { rows } = await c.query(
        `insert into uj.tarefas (comunidade_id, evento_id, titulo, descricao, responsavel_vinculo_id, prazo)
         values ($1, $2, $3, $4, $5, $6) returning id, versao`,
        [
          pedido.comunidade!.id,
          eventoId,
          t.titulo,
          t.descricao ?? null,
          t.responsavelVinculoId ?? null,
          t.prazo ?? null,
        ],
      )
      return rows[0]
    })
  })

  app.patch(`${ev}/tarefas/:tarefaId`, naCom, async (pedido) => {
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const tarefaId = idDoCaminho(pedido, 'tarefaId')
    const t = validar(
      z.object({
        titulo: z.string().trim().min(2).max(200).optional(),
        descricao: texto(2000).nullish(),
        responsavelVinculoId: uuid.nullish(),
        prazo: dataHora.nullish(),
        concluida: z.boolean().optional(),
      }),
      pedido.body,
    )
    const soConcluir = Object.keys(t).every((k) => k === 'concluida')
    // Concluir a própria tarefa é ação de membro; o banco confere que é dele.
    if (soConcluir) exigir(pedido, 'tarefa', 'concluir', { proprio: true })
    else exigir(pedido, 'tarefa', 'gerenciar')
    return tx(api, pedido, async (c) => {
      const { rows } = await c.query(
        `update uj.tarefas set
            titulo = coalesce($4, titulo),
            descricao = case when $5::boolean then $6 else descricao end,
            responsavel_vinculo_id = case when $7::boolean then $8::uuid else responsavel_vinculo_id end,
            prazo = case when $9::boolean then $10::timestamptz else prazo end,
            concluida_em = case when $11::boolean is null then concluida_em
                                when $11 then coalesce(concluida_em, now()) else null end
          where id = $1 and evento_id = $2 and comunidade_id = $3 returning id, concluida_em as "concluidaEm", versao`,
        [
          tarefaId,
          eventoId,
          pedido.comunidade!.id,
          t.titulo ?? null,
          t.descricao !== undefined,
          t.descricao ?? null,
          t.responsavelVinculoId !== undefined,
          t.responsavelVinculoId ?? null,
          t.prazo !== undefined,
          t.prazo ?? null,
          t.concluida ?? null,
        ],
      )
      if (!rows[0]) throw NAO_ENCONTRADO()
      return rows[0]
    })
  })

  app.delete(`${ev}/tarefas/:tarefaId`, naCom, async (pedido) => {
    exigir(pedido, 'tarefa', 'gerenciar')
    return apagarFilho(api, pedido, 'tarefas', 'tarefaId')
  })

  app.post(`${ev}/materiais`, naCom, async (pedido) => {
    exigir(pedido, 'material', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const m = validar(
      z.object({
        nome: z.string().trim().min(1).max(200),
        quantidade: texto(60).nullish(),
        responsavelVinculoId: uuid.nullish(),
      }),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      await exigirEvento(c, pedido.comunidade!.id, eventoId)
      const { rows } = await c.query(
        `insert into uj.materiais (comunidade_id, evento_id, nome, quantidade, responsavel_vinculo_id)
         values ($1, $2, $3, $4, $5) returning id, versao`,
        [
          pedido.comunidade!.id,
          eventoId,
          m.nome,
          m.quantidade ?? null,
          m.responsavelVinculoId ?? null,
        ],
      )
      return rows[0]
    })
  })

  app.patch(`${ev}/materiais/:materialId`, naCom, async (pedido) => {
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const materialId = idDoCaminho(pedido, 'materialId')
    const m = validar(
      z.object({
        nome: z.string().trim().min(1).max(200).optional(),
        quantidade: texto(60).nullish(),
        responsavelVinculoId: uuid.nullish(),
        providenciado: z.boolean().optional(),
      }),
      pedido.body,
    )
    const soMarcar = Object.keys(m).every((k) => k === 'providenciado')
    if (soMarcar) exigir(pedido, 'material', 'ler')
    else exigir(pedido, 'material', 'gerenciar')
    return tx(api, pedido, async (c) => {
      const { rows } = await c.query(
        `update uj.materiais set nome = coalesce($4, nome),
            quantidade = case when $5::boolean then $6 else quantidade end,
            responsavel_vinculo_id = case when $7::boolean then $8::uuid else responsavel_vinculo_id end,
            providenciado_em = case when $9::boolean is null then providenciado_em
                                    when $9 then coalesce(providenciado_em, now()) else null end
          where id = $1 and evento_id = $2 and comunidade_id = $3 returning id, versao`,
        [
          materialId,
          eventoId,
          pedido.comunidade!.id,
          m.nome ?? null,
          m.quantidade !== undefined,
          m.quantidade ?? null,
          m.responsavelVinculoId !== undefined,
          m.responsavelVinculoId ?? null,
          m.providenciado ?? null,
        ],
      )
      if (!rows[0]) throw NAO_ENCONTRADO()
      return rows[0]
    })
  })

  app.delete(`${ev}/materiais/:materialId`, naCom, async (pedido) => {
    exigir(pedido, 'material', 'gerenciar')
    return apagarFilho(api, pedido, 'materiais', 'materialId')
  })

  app.post(`${ev}/checklist`, naCom, async (pedido) => {
    exigir(pedido, 'checklist', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const i = validar(itemDeChecklist.extend({ responsavelVinculoId: uuid.nullish() }), pedido.body)
    return tx(api, pedido, async (c) => {
      await exigirEvento(c, pedido.comunidade!.id, eventoId)
      const { rows } = await c.query(
        `insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto, ordem, responsavel_vinculo_id)
         values ($1, $2, $3, $4,
                 (select coalesce(max(ordem) + 1, 0) from uj.checklist_itens where evento_id = $2 and tipo = $3), $5)
         returning id, versao`,
        [pedido.comunidade!.id, eventoId, i.tipo, i.texto, i.responsavelVinculoId ?? null],
      )
      return rows[0]
    })
  })

  app.patch(`${ev}/checklist/:itemId`, naCom, async (pedido) => {
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const itemId = idDoCaminho(pedido, 'itemId')
    const i = validar(
      z.object({
        texto: z.string().trim().min(1).max(300).optional(),
        marcado: z.boolean().optional(),
      }),
      pedido.body,
    )
    const soMarcar = Object.keys(i).every((k) => k === 'marcado')
    if (soMarcar) exigir(pedido, 'checklist', 'marcar', { proprio: true })
    else exigir(pedido, 'checklist', 'gerenciar')
    return tx(api, pedido, async (c) => {
      const { rows } = await c.query(
        `update uj.checklist_itens set texto = coalesce($4, texto),
            marcado_em = case when $5::boolean is null then marcado_em
                              when $5 then coalesce(marcado_em, now()) else null end
          where id = $1 and evento_id = $2 and comunidade_id = $3 returning id, marcado_em as "marcadoEm", versao`,
        [itemId, eventoId, pedido.comunidade!.id, i.texto ?? null, i.marcado ?? null],
      )
      if (!rows[0]) throw NAO_ENCONTRADO()
      return rows[0]
    })
  })

  app.delete(`${ev}/checklist/:itemId`, naCom, async (pedido) => {
    exigir(pedido, 'checklist', 'gerenciar')
    return apagarFilho(api, pedido, 'checklist_itens', 'itemId')
  })

  // ================================================================ notas e anexos

  app.post(`${ev}/notas`, naCom, async (pedido) => {
    exigir(pedido, 'nota_interna', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const n = validar(z.object({ texto: z.string().trim().min(1).max(5000) }), pedido.body)
    return tx(api, pedido, async (c) => {
      await exigirEvento(c, pedido.comunidade!.id, eventoId)
      const { rows } = await c.query(
        'insert into uj.notas_internas (comunidade_id, evento_id, texto) values ($1, $2, $3) returning id',
        [pedido.comunidade!.id, eventoId, n.texto],
      )
      return rows[0]
    })
  })

  app.delete(`${ev}/notas/:notaId`, naCom, async (pedido) => {
    exigir(pedido, 'nota_interna', 'gerenciar')
    return apagarFilho(api, pedido, 'notas_internas', 'notaId')
  })

  app.post(`${ev}/anexos`, naCom, async (pedido) => {
    exigir(pedido, 'anexo', 'gerenciar')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const a = validar(
      z.object({
        titulo: z.string().trim().min(1).max(120),
        url: z
          .url({ protocol: /^https$/, message: 'Use um link que comece com https://.' })
          .max(2000),
      }),
      pedido.body,
    )
    return tx(api, pedido, async (c) => {
      await exigirEvento(c, pedido.comunidade!.id, eventoId)
      const { rows } = await c.query(
        `insert into uj.anexos (comunidade_id, evento_id, tipo, titulo, url)
         values ($1, $2, 'link', $3, $4) returning id`,
        [pedido.comunidade!.id, eventoId, a.titulo, a.url],
      )
      return rows[0]
    })
  })

  app.delete(`${ev}/anexos/:anexoId`, naCom, async (pedido) => {
    exigir(pedido, 'anexo', 'gerenciar')
    return apagarFilho(api, pedido, 'anexos', 'anexoId')
  })
}

const TABELAS_FILHAS = new Set([
  'tarefas',
  'materiais',
  'checklist_itens',
  'notas_internas',
  'anexos',
])

async function apagarFilho(
  api: pg.Pool,
  pedido: FastifyRequest,
  tabela: string,
  parametro: string,
) {
  if (!TABELAS_FILHAS.has(tabela)) throw new Error('tabela não permitida')
  const eventoId = idDoCaminho(pedido, 'eventoId')
  const id = idDoCaminho(pedido, parametro)
  return tx(api, pedido, async (c) => {
    const r = await c.query(
      `delete from uj.${tabela} where id = $1 and evento_id = $2 and comunidade_id = $3`,
      [id, eventoId, pedido.comunidade!.id],
    )
    if (!r.rowCount) throw NAO_ENCONTRADO()
    return { ok: true }
  })
}
