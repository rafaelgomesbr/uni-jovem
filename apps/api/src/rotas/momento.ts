import type { FastifyRequest } from 'fastify'
import type pg from 'pg'
import {
  ehConvocacaoDeLouvor,
  estadoDoMomento,
  resumoDaBanda,
  type EstadoDoMomento,
  type SituacaoDoAoVivo,
} from '@uj/dominio'

/**
 * Cartão do momento do Início (app v3, D66): tudo que o cartão precisa para
 * escolher a etiqueta ("EM 5 DIAS", "AMANHÃ", "ACONTECENDO AGORA"), a linha
 * "Sua parte", o botão certo e, para a organização, "9 de 11 responderam, faltam
 * Bruno e Camila, falta: bateria".
 *
 * Vai como campo novo `momento` do `GET /inicio`; os campos de antes não mudam.
 * Só contagens, identificadores, títulos e nomes que a própria pessoa já lê no
 * encontro (a organização vê quem está convocado). Nenhum texto de oração,
 * nome de música ou cifra.
 */

/** Quantos nomes de quem falta responder vão no cartão (o resto vira "e mais N"). */
const NOMES_NO_CARTAO = 4

/** Quantos encontros do mesmo dia a lista "Hoje: 3 encontros" traz, no máximo. */
const ENCONTROS_NO_DIA = 20

/** Encontro entre ontem e hoje que o cartão ainda lembra ("Obrigado por servir ontem"). */
const HORAS_DE_RECEM_TERMINADO = 24

interface LinhaDoEvento {
  id: string
  titulo: string
  categoria: string
  inicio: Date
  duracaoMin: number
  fuso: string
  status: string
  visibilidade: string
  capacidade: number | null
  inscricaoAte: Date | null
  situacaoAoVivo: SituacaoDoAoVivo
  localNome: string | null
  localTipo: string | null
  endereco: string | null
  latitude: number | null
  longitude: number | null
  referencia: string | null
}

/** Um encontro do mesmo dia do cartão: o que a lista "Hoje: 3 encontros" precisa (D79). */
export interface EncontroDoDia {
  id: string
  titulo: string
  inicio: Date
  fim: Date
  duracaoMin: number
  fuso: string
  status: string
  /** `terminou`, `agora` ou `adiante`: o relógio do encontro (o mesmo `estadoDoMomento` do cartão). */
  situacao: 'terminou' | 'agora' | 'adiante'
  localNome: string | null
  /** As convocações da própria pessoa neste encontro (a recusada vai junto: o app decide). */
  suaParte: { funcao: string; etapaTitulo: string | null; estado: string }[]
}

type LinhaDoDia = Pick<
  LinhaDoEvento,
  'id' | 'titulo' | 'inicio' | 'duracaoMin' | 'fuso' | 'status' | 'situacaoAoVivo' | 'localNome'
>

export type SituacaoDaInscricao = 'inscrito' | 'espera' | 'aberta' | 'fechada' | 'nao_se_aplica'

export interface Momento {
  agora: string
  evento: Record<string, unknown> | null
  estado: EstadoDoMomento | null
  minutosParaInicio: number | null
  suaParte: { atribuicaoId: string; funcao: string; etapaTitulo: string | null; estado: string }[]
  inscricao: {
    situacao: SituacaoDaInscricao
    /** Total de inscritos: só a organização o vê (a RLS mostra ao membro apenas a inscrição dele); membro recebe nulo. */
    inscritos: number | null
    capacidade: number | null
  } | null
  lider: Record<string, unknown> | null
  recemTerminado: Record<string, unknown> | null
  proximoAMarcar: boolean | null
  /**
   * Todos os encontros do MESMO DIA do encontro do cartão (no fuso dele), por horário, com o do
   * cartão entre eles. Vazio sem cartão. O app só mostra o bloco "Hoje: 3 encontros" com 2 ou mais.
   */
  doDia: EncontroDoDia[]
}

export async function montarMomento(
  c: pg.PoolClient,
  pedido: FastifyRequest,
  agora = new Date(),
): Promise<Momento> {
  const comunidadeId = pedido.comunidade!.id
  const organizacao = pedido.comunidade!.papel !== 'membro'

  // O que está acontecendo ou o próximo (rascunho só aparece para a organização: RLS).
  // Quem está acontecendo vem primeiro; um encontro cujo ao vivo foi encerrado já terminou.
  const evento = (
    await c.query<LinhaDoEvento>(
      `select e.id, e.titulo, e.categoria, e.inicio, e.duracao_min as "duracaoMin", e.fuso, e.status,
              e.visibilidade, e.capacidade, e.inscricao_ate as "inscricaoAte",
              coalesce(an.situacao, 'nao_iniciado') as "situacaoAoVivo",
              l.nome as "localNome", l.tipo as "localTipo", l.endereco, l.latitude, l.longitude,
              l.referencia
         from uj.eventos e
         left join uj.locais l on l.id = e.local_id
         left join uj.andamentos an on an.evento_id = e.id
        where e.comunidade_id = $1 and e.status in ('publicado', 'adiado', 'rascunho')
          and coalesce(an.situacao, 'nao_iniciado') <> 'encerrado'
          and (e.inicio + make_interval(mins => e.duracao_min) > now()
               or an.situacao in ('em_andamento', 'pausado'))
        order by (e.inicio <= now()) desc, e.inicio
        limit 1`,
      [comunidadeId],
    )
  ).rows[0]

  const recemTerminado = (
    await c.query<{
      id: string
      titulo: string
      inicio: Date
      fuso: string
      fim: Date
      presentes: number | null
      euServi: boolean
    }>(
      `select e.id, e.titulo, e.inicio, e.fuso, fim.quando as fim,
              case when $3::boolean then (select count(*)::int from uj.presencas p where p.evento_id = e.id) end
                as presentes,
              exists (select 1 from uj.atribuicoes a
                       where a.evento_id = e.id
                         and a.vinculo_id = (select uj.vinculo_da_conta_no_contexto())
                         and a.estado = 'confirmada') as "euServi"
         from uj.eventos e
         left join uj.andamentos an on an.evento_id = e.id
         cross join lateral (
           select case when an.situacao = 'encerrado'
                       then coalesce(an.encerrado_em, e.inicio + make_interval(mins => e.duracao_min))
                       else e.inicio + make_interval(mins => e.duracao_min) end as quando) fim
        where e.comunidade_id = $1 and e.status in ('publicado', 'encerrado')
          and fim.quando <= now() and fim.quando > now() - make_interval(hours => $2)
          and coalesce(an.situacao, 'nao_iniciado') not in ('em_andamento', 'pausado')
        order by fim.quando desc
        limit 1`,
      [comunidadeId, HORAS_DE_RECEM_TERMINADO, organizacao],
    )
  ).rows[0]

  // "Marcar o próximo sábado": nada marcado depois do encontro do cartão (ou, sem cartão, nada à frente).
  const semProximo = organizacao
    ? !(
        await c.query<{ existe: boolean }>(
          `select exists (select 1 from uj.eventos e
                           where e.comunidade_id = $1 and e.status in ('publicado', 'adiado', 'rascunho')
                             and e.inicio > coalesce($2::timestamptz, now())
                             and e.id is distinct from $3::uuid) as existe`,
          [comunidadeId, evento?.inicio ?? null, evento?.id ?? null],
        )
      ).rows[0]!.existe
    : null

  const base: Momento = {
    agora: agora.toISOString(),
    evento: null,
    estado: null,
    minutosParaInicio: null,
    suaParte: [],
    inscricao: null,
    lider: null,
    recemTerminado: recemTerminado
      ? {
          id: recemTerminado.id,
          titulo: recemTerminado.titulo,
          inicio: recemTerminado.inicio,
          fim: recemTerminado.fim,
          fuso: recemTerminado.fuso,
          // Contagem de presença é da organização; membro recebe nulo.
          presentes: organizacao ? recemTerminado.presentes : null,
          euServi: recemTerminado.euServi,
        }
      : null,
    proximoAMarcar: semProximo,
    doDia: [],
  }
  if (!evento) return base

  const estado = estadoDoMomento({
    agora,
    inicio: evento.inicio,
    duracaoMin: evento.duracaoMin,
    fuso: evento.fuso,
    situacaoAoVivo: evento.situacaoAoVivo,
  })

  const suaParte = (
    await c.query<{
      atribuicaoId: string
      funcao: string
      etapaTitulo: string | null
      estado: string
    }>(
      `select a.id as "atribuicaoId", a.funcao, t.titulo as "etapaTitulo", a.estado
         from uj.atribuicoes a left join uj.etapas t on t.id = a.etapa_id
        where a.evento_id = $1 and a.comunidade_id = $2
          and a.vinculo_id = (select uj.vinculo_da_conta_no_contexto())
        order by (a.estado = 'pendente') desc, t.ordem nulls first, a.criado_em`,
      [evento.id, comunidadeId],
    )
  ).rows

  // Quantas músicas o repertório tem: qualquer pessoa da comunidade vê o repertório do encontro
  // (D73), então o cartão pode oferecer "Ver o repertório". Só a contagem, nunca título nem cifra.
  const musicas = (
    await c.query<{ n: number }>(
      'select count(*)::int as n from uj.repertorio_itens where evento_id = $1 and comunidade_id = $2',
      [evento.id, comunidadeId],
    )
  ).rows[0]!.n

  // Inscrição: "Inscrições abertas" só onde faz sentido (encontro público ou com vagas contadas).
  const inscritos = (
    await c.query<{ n: number }>(
      `select count(*)::int as n from uj.inscricoes
        where evento_id = $1 and estado in ('confirmada', 'espera')`,
      [evento.id],
    )
  ).rows[0]!.n
  const minha = (
    await c.query<{ estado: string }>(
      `select estado from uj.inscricoes
        where evento_id = $1 and vinculo_id = (select uj.vinculo_da_conta_no_contexto())
          and estado in ('confirmada', 'espera')
        limit 1`,
      [evento.id],
    )
  ).rows[0]
  const comInscricao = evento.visibilidade === 'publica' || evento.capacidade !== null
  const aberta =
    evento.status === 'publicado' &&
    evento.inicio.getTime() > agora.getTime() &&
    (evento.inscricaoAte === null || evento.inscricaoAte.getTime() > agora.getTime())
  const situacao: SituacaoDaInscricao = minha
    ? minha.estado === 'espera'
      ? 'espera'
      : 'inscrito'
    : !comInscricao
      ? 'nao_se_aplica'
      : aberta
        ? 'aberta'
        : 'fechada'

  let lider: Record<string, unknown> | null = null
  if (organizacao) lider = await montarLider(c, comunidadeId, evento, inscritos, estado)
  const doDia = await montarDoDia(c, comunidadeId, evento, agora)

  return {
    ...base,
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      categoria: evento.categoria,
      inicio: evento.inicio,
      fim: new Date(evento.inicio.getTime() + evento.duracaoMin * 60_000),
      duracaoMin: evento.duracaoMin,
      fuso: evento.fuso,
      status: evento.status,
      visibilidade: evento.visibilidade,
      musicas,
      local:
        evento.localNome === null
          ? null
          : {
              nome: evento.localNome,
              tipo: evento.localTipo,
              endereco: evento.endereco,
              latitude: evento.latitude,
              longitude: evento.longitude,
              referencia: evento.referencia,
            },
    },
    estado,
    minutosParaInicio: Math.round((evento.inicio.getTime() - agora.getTime()) / 60_000),
    suaParte,
    inscricao: {
      situacao: evento.status === 'rascunho' ? 'nao_se_aplica' : situacao,
      inscritos: organizacao ? inscritos : null,
      capacidade: evento.capacidade,
    },
    lider,
    doDia,
  }
}

/**
 * Os encontros do dia do encontro do cartão (D79): "Hoje: 3 encontros". O dia é o do fuso do
 * encontro do cartão. Cancelado não entra (não vai acontecer); rascunho só chega à organização
 * (RLS). As partes da pessoa vêm do mesmo vínculo do contexto, nunca de outra pessoa.
 */
async function montarDoDia(
  c: pg.PoolClient,
  comunidadeId: string,
  cartao: LinhaDoEvento,
  agora: Date,
): Promise<EncontroDoDia[]> {
  const linhas = (
    await c.query<LinhaDoDia>(
      `select e.id, e.titulo, e.inicio, e.duracao_min as "duracaoMin", e.fuso, e.status,
              coalesce(an.situacao, 'nao_iniciado') as "situacaoAoVivo", l.nome as "localNome"
         from uj.eventos e
         left join uj.locais l on l.id = e.local_id
         left join uj.andamentos an on an.evento_id = e.id
        where e.comunidade_id = $1 and e.status in ('publicado', 'adiado', 'rascunho', 'encerrado')
          and (e.inicio at time zone $2)::date = ($3::timestamptz at time zone $2)::date
        order by e.inicio, e.id
        limit ${ENCONTROS_NO_DIA}`,
      [comunidadeId, cartao.fuso, cartao.inicio],
    )
  ).rows
  if (linhas.length === 0) return []
  const partes = (
    await c.query<{
      eventoId: string
      funcao: string
      etapaTitulo: string | null
      estado: string
    }>(
      `select a.evento_id as "eventoId", a.funcao, t.titulo as "etapaTitulo", a.estado
         from uj.atribuicoes a left join uj.etapas t on t.id = a.etapa_id
        where a.evento_id = any ($1::uuid[]) and a.comunidade_id = $2
          and a.vinculo_id = (select uj.vinculo_da_conta_no_contexto())
        order by (a.estado = 'pendente') desc, t.ordem nulls first, a.criado_em`,
      [linhas.map((l) => l.id), comunidadeId],
    )
  ).rows
  return linhas.map((l) => {
    const estado = estadoDoMomento({
      agora,
      inicio: l.inicio,
      duracaoMin: l.duracaoMin,
      fuso: l.fuso,
      situacaoAoVivo: l.situacaoAoVivo,
    })
    return {
      id: l.id,
      titulo: l.titulo,
      inicio: l.inicio,
      fim: new Date(l.inicio.getTime() + l.duracaoMin * 60_000),
      duracaoMin: l.duracaoMin,
      fuso: l.fuso,
      status: l.status,
      situacao:
        l.status === 'encerrado' || estado === 'terminou'
          ? ('terminou' as const)
          : estado === 'acontecendo'
            ? ('agora' as const)
            : ('adiante' as const),
      localNome: l.localNome,
      suaParte: partes
        .filter((p) => p.eventoId === l.id)
        .map(({ funcao, etapaTitulo, estado: e }) => ({ funcao, etapaTitulo, estado: e })),
    }
  })
}

async function montarLider(
  c: pg.PoolClient,
  comunidadeId: string,
  evento: LinhaDoEvento,
  inscritos: number,
  estado: EstadoDoMomento,
): Promise<Record<string, unknown>> {
  const convocacoes = (
    await c.query<{
      vinculoId: string
      funcao: string
      estado: 'pendente' | 'confirmada' | 'recusada' | 'substituicao_pedida'
      etapaTitulo: string | null
      etapaComRepertorio: boolean
    }>(
      `select a.vinculo_id as "vinculoId", a.funcao, a.estado, t.titulo as "etapaTitulo",
              (a.etapa_id is not null and exists (
                 select 1 from uj.repertorio_itens r
                  where r.evento_id = a.evento_id and r.etapa_id = a.etapa_id)) as "etapaComRepertorio"
         from uj.atribuicoes a left join uj.etapas t on t.id = a.etapa_id
        where a.evento_id = $1 and a.comunidade_id = $2
          and a.vinculo_id in (select vinculo_id from uj.pessoas_da_comunidade() where estado = 'ativo')
        order by a.criado_em`,
      [evento.id, comunidadeId],
    )
  ).rows
  const nomes = new Map(
    (
      await c.query<{ vinculo_id: string; nome: string }>(
        'select vinculo_id, nome from uj.pessoas_da_comunidade()',
      )
    ).rows.map((p) => [p.vinculo_id, p.nome]),
  )
  const pessoas = new Set(convocacoes.map((a) => a.vinculoId))
  const pendentes = new Set(
    convocacoes.filter((a) => a.estado === 'pendente').map((a) => a.vinculoId),
  )
  const confirmados = new Set(
    convocacoes.filter((a) => a.estado === 'confirmada').map((a) => a.vinculoId),
  )
  const recusaram = new Set(
    convocacoes.filter((a) => a.estado === 'recusada').map((a) => a.vinculoId),
  )
  const faltamResponder = [...pendentes].map((vinculoId) => ({
    vinculoId,
    nome: nomes.get(vinculoId) ?? 'Pessoa removida',
    funcoes: convocacoes
      .filter((a) => a.vinculoId === vinculoId && a.estado === 'pendente')
      .map((a) => a.funcao),
  }))
  const banda = resumoDaBanda(convocacoes.filter((a) => ehConvocacaoDeLouvor(a)))
  const contagens = (
    await c.query<{ musicas: number; presentes: number }>(
      `select (select count(*)::int from uj.repertorio_itens where evento_id = $1) as musicas,
              (select count(*)::int from uj.presencas where evento_id = $1) as presentes`,
      [evento.id],
    )
  ).rows[0]!

  // O mesmo número que "Lembrar" vai usar (já sem quem foi lembrado nas últimas 24 h).
  let lembraveis = 0
  if (
    estado !== 'terminou' &&
    pendentes.size > 0 &&
    (evento.status === 'publicado' || evento.status === 'adiado')
  ) {
    lembraveis = (
      await c.query<{ lembraveis: number }>(
        'select lembraveis from uj.lembrar_pendentes($1, true)',
        [evento.id],
      )
    ).rows[0]!.lembraveis
  }

  return {
    convocados: pessoas.size,
    confirmados: confirmados.size,
    recusaram: recusaram.size,
    pendentes: pendentes.size,
    // "9 de 11 responderam": quem não tem convocação pendente.
    responderam: pessoas.size - pendentes.size,
    faltamResponder: faltamResponder.slice(0, NOMES_NO_CARTAO),
    faltamResponderTotal: faltamResponder.length,
    // "Falta: bateria". Só funções já convocadas e sem ninguém que aceitou.
    faltaFuncao: banda.faltam,
    musicas: contagens.musicas,
    inscritos,
    presentes: contagens.presentes,
    // "Lembrar os 2": quantas pessoas o lembrete alcançaria agora.
    lembraveis,
    // "Publicar e avisar 11 pessoas": quem será avisado ao publicar o rascunho.
    avisariaAoPublicar: pessoas.size,
  }
}
