import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import {
  dataNoFuso,
  dataValida,
  horaNoFuso,
  instanteNoFuso,
  mesmaFuncao,
  proximaDataParaCopiar,
  sugerirParaFuncao,
} from '@uj/dominio'
import { ErroHttp, NAO_ENCONTRADO, traduzirErroDoBanco, validar } from '../http.ts'
import { auditar, exigir, idDoCaminho, naComunidade } from './contexto.ts'

/**
 * Montar o sábado em poucos toques (app v3, D66):
 *
 * - "Igual ao último sábado": `GET .../eventos/anteriores-para-copiar` lista de
 *   onde copiar e `POST .../eventos/:eventoId/copiar` cria o RASCUNHO com o
 *   roteiro e a equipe como "aguardando resposta". Ninguém é avisado: a
 *   notificação de convocação só sai quando o encontro é publicado (gatilhos
 *   `notificar_atribuicao` e `notificar_evento`, que exigem encontro no ar).
 * - Convocar várias pessoas de uma vez e sugestões de quem convocar por função.
 * - "Lembrar os N": `POST .../eventos/:eventoId/lembrar-pendentes`, com as
 *   regras (uma por pessoa e por encontro a cada 24 h, texto genérico) na função
 *   `uj.lembrar_pendentes` do banco.
 *
 * Tudo é da organização (matriz: `evento.criar`, `escala.atribuir`). A auditoria
 * leva só ids e contagens, nunca título, nome ou função.
 */

const uuid = z.uuid()
const dataLocal = z.string().refine(dataValida, 'Data no formato AAAA-MM-DD.')
const horaLocal = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no formato HH:MM.')

const ERROS_DO_BANCO: Record<string, [string, number, string]> = {
  UJ101: ['nao_encontrado', 404, 'Não encontramos este encontro.'],
  UJ102: [
    'encontro_fora_do_ar',
    409,
    'Só dá para lembrar de um encontro publicado que ainda não terminou. Publique o encontro antes.',
  ],
}

function traduzir(e: unknown): never {
  if (e instanceof ErroHttp) throw e
  const codigo = (e as { code?: string }).code
  const t = codigo ? ERROS_DO_BANCO[codigo] : undefined
  if (t) throw new ErroHttp(t[0], t[1], t[2])
  traduzirErroDoBanco(e)
}

/** Datas (no fuso) dos encontros com este título que ainda contam: não cancelados, de ontem em diante. */
async function datasOcupadas(
  c: pg.PoolClient,
  comunidadeId: string,
  titulo: string,
): Promise<Set<string>> {
  const { rows } = await c.query<{ inicio: Date; fuso: string }>(
    `select inicio, fuso from uj.eventos
      where comunidade_id = $1 and status <> 'cancelado'
        and lower(btrim(titulo)) = lower(btrim($2)) and inicio > now() - interval '2 days'`,
    [comunidadeId, titulo],
  )
  return new Set(rows.map((r) => dataNoFuso(r.inicio, r.fuso)))
}

interface Origem {
  id: string
  titulo: string
  inicio: Date
  duracao_min: number
  fuso: string
}

export function registrarRotasDeMontarEncontro(app: FastifyInstance, api: pg.Pool): void {
  const naCom = { preHandler: app.comComunidade }
  const base = '/api/v1/c/:comunidadeId'
  const ev = `${base}/eventos/:eventoId`
  const tx = <T>(pedido: FastifyRequest, trabalho: (c: pg.PoolClient) => Promise<T>) =>
    naComunidade(api, pedido, async (c) => {
      try {
        return await trabalho(c)
      } catch (e) {
        traduzir(e)
      }
    })

  async function exigirEvento(c: pg.PoolClient, comunidadeId: string, eventoId: string) {
    const { rows } = await c.query<Origem>(
      `select id, titulo, inicio, duracao_min, fuso from uj.eventos
        where id = $1 and comunidade_id = $2`,
      [eventoId, comunidadeId],
    )
    if (!rows[0]) throw NAO_ENCONTRADO()
    return rows[0]
  }

  // ---------------------------------------------------------------- de onde copiar

  /**
   * Até 3 encontros já realizados para copiar, um por título (o mais recente de
   * cada), com a data sugerida e o que seria copiado. O mais recente vem
   * primeiro: é o pré-marcado na tela.
   */
  app.get(`${base}/eventos/anteriores-para-copiar`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'criar')
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      const { rows } = await c.query<
        Origem & { etapas: number; convocados: number; musicas: number }
      >(
        `select * from (
           select distinct on (lower(btrim(e.titulo)))
                  e.id, e.titulo, e.inicio, e.duracao_min, e.fuso,
                  (select count(*)::int from uj.etapas t where t.evento_id = e.id) as etapas,
                  (select count(distinct a.vinculo_id)::int from uj.atribuicoes a
                    where a.evento_id = e.id
                      and a.vinculo_id in (select vinculo_id from uj.pessoas_da_comunidade()
                                            where estado = 'ativo')) as convocados,
                  (select count(*)::int from uj.repertorio_itens r where r.evento_id = e.id) as musicas
             from uj.eventos e
            where e.comunidade_id = $1 and e.status in ('publicado', 'encerrado')
              and e.inicio + make_interval(mins => e.duracao_min) <= now()
            order by lower(btrim(e.titulo)), e.inicio desc) por_titulo
          order by inicio desc limit 3`,
        [comunidadeId],
      )
      const agora = new Date()
      const opcoes = []
      for (const o of rows) {
        const ocupadas = await datasOcupadas(c, comunidadeId, o.titulo)
        const data = proximaDataParaCopiar({
          dataDaOrigem: dataNoFuso(o.inicio, o.fuso),
          hoje: dataNoFuso(agora, o.fuso),
          ocupadas,
        })
        const hora = horaNoFuso(o.inicio, o.fuso)
        opcoes.push({
          eventoId: o.id,
          titulo: o.titulo,
          inicio: o.inicio,
          fuso: o.fuso,
          duracaoMin: o.duracao_min,
          etapas: o.etapas,
          convocados: o.convocados,
          musicas: o.musicas,
          dataSugerida: data,
          horaSugerida: hora,
          inicioSugerido: instanteNoFuso(data, hora, o.fuso),
        })
      }
      return { opcoes }
    })
  })

  // ---------------------------------------------------------------- copiar

  app.post(`${ev}/copiar`, naCom, async (pedido) => {
    exigir(pedido, 'evento', 'criar')
    exigir(pedido, 'escala', 'atribuir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const corpo = validar(
      z.object({
        data: dataLocal.optional(),
        hora: horaLocal.optional(),
        incluirMusicas: z.boolean().default(false),
      }),
      pedido.body ?? {},
    )
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      const origem = await exigirEvento(c, comunidadeId, eventoId)
      const agora = new Date()
      const hora = corpo.hora ?? horaNoFuso(origem.inicio, origem.fuso)
      const data =
        corpo.data ??
        proximaDataParaCopiar({
          dataDaOrigem: dataNoFuso(origem.inicio, origem.fuso),
          hoje: dataNoFuso(agora, origem.fuso),
          ocupadas: await datasOcupadas(c, comunidadeId, origem.titulo),
        })
      const inicio = instanteNoFuso(data, hora, origem.fuso)
      if (inicio.getTime() <= agora.getTime()) {
        throw new ErroHttp(
          'data_no_passado',
          400,
          'Escolha uma data e uma hora que ainda não passaram.',
        )
      }

      // O encontro novo: rascunho, mesmo título, local e regras de inscrição.
      const { rows } = await c.query<{ id: string; versao: number }>(
        `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
           local_id, capacidade, lista_de_espera, informacoes_uteis, visibilidade)
         select comunidade_id, titulo, descricao, categoria, $3, duracao_min, fuso, local_id, capacidade,
                lista_de_espera, informacoes_uteis, visibilidade
           from uj.eventos where id = $1 and comunidade_id = $2
         returning id, versao`,
        [eventoId, comunidadeId, inicio],
      )
      const novo = rows[0]!.id

      // Roteiro. A etapa nova é achada pela posição (ordem), que é igual nos dois encontros.
      await c.query(
        `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, descricao, duracao_min)
         select comunidade_id, $2, ordem, titulo, descricao, duracao_min from uj.etapas where evento_id = $1`,
        [eventoId, novo],
      )
      const etapas = (
        await c.query<{ id: string; titulo: string; duracao_min: number }>(
          'select id, titulo, duracao_min from uj.etapas where evento_id = $1 order by ordem',
          [novo],
        )
      ).rows
      const novaDaOrigem = `(select n.id from uj.etapas n join uj.etapas o on o.ordem = n.ordem
                             where n.evento_id = $2 and o.evento_id = $1 and o.id = X.etapa_id)`

      // Checklist (sem marcações), tarefas (sem prazo nem conclusão) e materiais (sem "providenciado").
      const checklist = await c.query(
        `insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto, ordem, responsavel_vinculo_id)
         select comunidade_id, $2, tipo, texto, ordem, responsavel_vinculo_id
           from uj.checklist_itens where evento_id = $1`,
        [eventoId, novo],
      )
      const tarefas = await c.query(
        `insert into uj.tarefas (comunidade_id, evento_id, titulo, descricao, responsavel_vinculo_id)
         select comunidade_id, $2, titulo, descricao, responsavel_vinculo_id from uj.tarefas where evento_id = $1`,
        [eventoId, novo],
      )
      const materiais = await c.query(
        `insert into uj.materiais (comunidade_id, evento_id, nome, quantidade, responsavel_vinculo_id)
         select comunidade_id, $2, nome, quantidade, responsavel_vinculo_id from uj.materiais where evento_id = $1`,
        [eventoId, novo],
      )

      // A equipe: tudo "aguardando resposta" (estado padrão), só quem ainda é da comunidade.
      const convocados = (
        await c.query<{
          id: string
          vinculoId: string
          funcao: string
          etapaId: string | null
        }>(
          `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao)
           select X.comunidade_id, $2, ${novaDaOrigem}, X.vinculo_id, X.funcao
             from uj.atribuicoes X
            where X.evento_id = $1 and X.comunidade_id = $3
              and X.vinculo_id in (select vinculo_id from uj.pessoas_da_comunidade() where estado = 'ativo')
           returning id, vinculo_id as "vinculoId", funcao, etapa_id as "etapaId"`,
          [eventoId, novo, comunidadeId],
        )
      ).rows
      const naOrigem = (
        await c.query<{ n: number }>(
          'select count(distinct vinculo_id)::int as n from uj.atribuicoes where evento_id = $1',
          [eventoId],
        )
      ).rows[0]!.n

      // As músicas só vão se a pessoa pediu (mudam toda semana). Arquivada não vai.
      const naOrigemMusicas = (
        await c.query<{ n: number }>(
          'select count(*)::int as n from uj.repertorio_itens where evento_id = $1',
          [eventoId],
        )
      ).rows[0]!.n
      let musicasCopiadas = 0
      if (corpo.incluirMusicas && naOrigemMusicas > 0) {
        const r = await c.query(
          `insert into uj.repertorio_itens (comunidade_id, evento_id, etapa_id, musica_id, ordem, tom_do_dia, nota)
           select X.comunidade_id, $2, ${novaDaOrigem}, X.musica_id,
                  row_number() over (order by X.ordem) - 1, X.tom_do_dia, X.nota
             from uj.repertorio_itens X join uj.musicas m on m.id = X.musica_id
            where X.evento_id = $1 and X.comunidade_id = $3 and not m.arquivada`,
          [eventoId, novo, comunidadeId],
        )
        musicasCopiadas = r.rowCount ?? 0
      }

      // Quem avisou que não pode neste dia (a disponibilidade que a pessoa informou).
      const nomes = new Map(
        (
          await c.query<{ vinculo_id: string; nome: string }>(
            'select vinculo_id, nome from uj.pessoas_da_comunidade()',
          )
        ).rows.map((p) => [p.vinculo_id, p.nome]),
      )
      const indisponiveisIds = new Set(
        (
          await c.query<{ vinculo_id: string }>(
            `select vinculo_id from uj.disponibilidades
              where comunidade_id = $1 and data = $2 and not disponivel`,
            [comunidadeId, data],
          )
        ).rows.map((r) => r.vinculo_id),
      )
      const tituloDaEtapa = new Map(etapas.map((e) => [e.id, e.titulo]))
      const itens = convocados.map((a) => ({
        atribuicaoId: a.id,
        vinculoId: a.vinculoId,
        nome: nomes.get(a.vinculoId) ?? 'Pessoa removida',
        funcao: a.funcao,
        etapaTitulo: a.etapaId ? (tituloDaEtapa.get(a.etapaId) ?? null) : null,
      }))
      const pessoas = new Set(convocados.map((a) => a.vinculoId))

      await auditar(
        c,
        pedido,
        'evento.copiado',
        { tipo: 'evento', id: novo },
        {
          origem: eventoId,
          convocacoes: convocados.length,
          musicas: musicasCopiadas,
        },
      )
      return {
        id: novo,
        versao: rows[0]!.versao,
        status: 'rascunho' as const,
        inicio,
        fuso: origem.fuso,
        resumo: {
          origem: { id: origem.id, titulo: origem.titulo, inicio: origem.inicio },
          etapas: etapas.length,
          duracaoTotalMin: etapas.reduce((s, e) => s + e.duracao_min, 0),
          checklist: checklist.rowCount ?? 0,
          tarefas: tarefas.rowCount ?? 0,
          materiais: materiais.rowCount ?? 0,
          convocados: { pessoas: pessoas.size, itens },
          // Gente que saiu da comunidade desde o último encontro: não é copiada.
          naoCopiados: Math.max(0, naOrigem - pessoas.size),
          indisponiveis: itens
            .filter((i) => indisponiveisIds.has(i.vinculoId))
            .map((i) => ({ vinculoId: i.vinculoId, nome: i.nome, funcao: i.funcao })),
          musicas: { copiadas: musicasCopiadas, naOrigem: naOrigemMusicas },
          // Quantas pessoas serão avisadas quando o encontro for publicado.
          avisariaAoPublicar: pessoas.size,
        },
      }
    })
  })

  // ---------------------------------------------------------------- convocar em lote

  app.post(`${ev}/atribuicoes/lote`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'atribuir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    const corpo = validar(
      z.object({
        funcao: z.string().trim().min(2).max(60),
        etapaId: uuid.nullish(),
        vinculoIds: z.array(uuid).min(1).max(30),
      }),
      pedido.body,
    )
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      await exigirEvento(c, comunidadeId, eventoId)
      const ids = [...new Set(corpo.vinculoIds)]
      // Pessoa de outra comunidade, inexistente ou que saiu: 404 para o lote inteiro, nada gravado.
      const ativos = (
        await c.query<{ vinculo_id: string }>(
          `select vinculo_id from uj.pessoas_da_comunidade()
            where estado = 'ativo' and vinculo_id = any ($1::uuid[])`,
          [ids],
        )
      ).rowCount
      if (ativos !== ids.length) throw NAO_ENCONTRADO()
      if (corpo.etapaId) {
        const etapa = await c.query('select 1 from uj.etapas where id = $1 and evento_id = $2', [
          corpo.etapaId,
          eventoId,
        ])
        if (!etapa.rowCount) throw NAO_ENCONTRADO()
      }
      const { rows } = await c.query<{ id: string; vinculoId: string; estado: string }>(
        `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao)
         select $1, $2, $3, v, $5 from unnest($4::uuid[]) as v
         on conflict (evento_id, (coalesce(etapa_id, '00000000-0000-0000-0000-000000000000'::uuid)),
                      vinculo_id, funcao) do nothing
         returning id, vinculo_id as "vinculoId", estado`,
        [comunidadeId, eventoId, corpo.etapaId ?? null, ids, corpo.funcao],
      )
      const criadas = new Set(rows.map((r) => r.vinculoId))
      const jaConvocadas = ids.filter((id) => !criadas.has(id))
      await auditar(
        c,
        pedido,
        'escala.convocadas_em_lote',
        { tipo: 'evento', id: eventoId },
        { convocadas: rows.length, jaConvocadas: jaConvocadas.length },
      )
      return { criadas: rows, jaConvocadas }
    })
  })

  // ---------------------------------------------------------------- sugestões por função

  /**
   * Quem convocar para uma função: quem serviu nela nos últimos 12 meses e quem
   * disse que pode neste dia, sem quem já está convocado nela. `indisponiveis`
   * são todas as pessoas que avisaram que NÃO podem neste dia (a folha mostra
   * com o motivo). Só a organização lê disponibilidade de outras pessoas.
   * O encontro é conferido antes da consulta: id de outra comunidade dá 404.
   */
  app.get(`${ev}/sugestoes-de-convocacao`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'atribuir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(pedido, async (c) => {
      const comunidadeId = pedido.comunidade!.id
      const evento = await exigirEvento(c, comunidadeId, eventoId)
      const { funcao } = validar(
        z.object({ funcao: z.string().trim().min(2).max(60) }),
        pedido.query ?? {},
      )
      const data = dataNoFuso(evento.inicio, evento.fuso)
      const nomes = new Map(
        (
          await c.query<{ vinculo_id: string; nome: string }>(
            `select vinculo_id, nome from uj.pessoas_da_comunidade() where estado = 'ativo'`,
          )
        ).rows.map((p) => [p.vinculo_id, p.nome]),
      )
      const historico = (
        await c.query<{ vinculoId: string; funcao: string; quando: Date }>(
          `select a.vinculo_id as "vinculoId", a.funcao, e.inicio as quando
             from uj.atribuicoes a join uj.eventos e on e.id = a.evento_id
            where a.comunidade_id = $1 and e.id <> $2 and e.status in ('publicado', 'encerrado')
              and e.inicio < now() and e.inicio > now() - interval '365 days'
              and a.estado <> 'recusada'
            order by e.inicio desc limit 3000`,
          [comunidadeId, eventoId],
        )
      ).rows.filter((h) => nomes.has(h.vinculoId))
      const disponibilidade = new Map(
        (
          await c.query<{ vinculo_id: string; disponivel: boolean }>(
            `select vinculo_id, disponivel from uj.disponibilidades
              where comunidade_id = $1 and data = $2`,
            [comunidadeId, data],
          )
        ).rows
          .filter((d) => nomes.has(d.vinculo_id))
          .map((d) => [d.vinculo_id, d.disponivel]),
      )
      const jaConvocadas = (
        await c.query<{ vinculoId: string; funcao: string }>(
          `select vinculo_id as "vinculoId", funcao from uj.atribuicoes
            where evento_id = $1 and comunidade_id = $2`,
          [eventoId, comunidadeId],
        )
      ).rows.filter((a) => mesmaFuncao(a.funcao, funcao))
      const jaIds = new Set(jaConvocadas.map((a) => a.vinculoId))
      const { sugeridas } = sugerirParaFuncao({
        funcao,
        historico,
        disponibilidade,
        excluir: jaIds,
      })
      return {
        funcao,
        data,
        sugeridas: sugeridas.map((s) => ({
          vinculoId: s.vinculoId,
          nome: nomes.get(s.vinculoId) ?? 'Pessoa removida',
          vezes: s.vezes,
          ultimaVez: s.ultimaVez,
          disponivelNoDia: s.disponivelNoDia,
        })),
        indisponiveis: [...disponibilidade]
          .filter(([, disponivel]) => !disponivel)
          .map(([vinculoId]) => ({ vinculoId, nome: nomes.get(vinculoId) ?? 'Pessoa removida' })),
        jaConvocadas: [...jaIds],
      }
    })
  })

  // ---------------------------------------------------------------- lembrar quem não respondeu

  app.post(`${ev}/lembrar-pendentes`, naCom, async (pedido) => {
    exigir(pedido, 'escala', 'atribuir')
    const eventoId = idDoCaminho(pedido, 'eventoId')
    return tx(pedido, async (c) => {
      const { rows } = await c.query<{ pendentes: number; lembraveis: number; lembradas: number }>(
        'select * from uj.lembrar_pendentes($1, false)',
        [eventoId],
      )
      const r = rows[0]!
      await auditar(
        c,
        pedido,
        'convocacao.lembrete_enviado',
        { tipo: 'evento', id: eventoId },
        { pendentes: r.pendentes, lembradas: r.lembradas },
      )
      return {
        pendentes: r.pendentes,
        lembradas: r.lembradas,
        // Já lembradas nas últimas 24 h: esperam.
        jaLembradas: r.pendentes - r.lembraveis,
      }
    })
  })
}
