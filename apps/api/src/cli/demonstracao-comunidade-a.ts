import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { dataNoFuso, instanteNoFuso } from '@uj/dominio'
import { cifrar, decifrar } from '../autenticacao/cripto.ts'
import { registrarPresenca } from '../rotas/inscricoes.ts'
import {
  dataPorExtenso,
  planoDaComunidadeA,
  type ChaveEmA,
  type EventoDoPlano,
  type HorarioLocal,
  type PlanoDaComunidadeA,
} from './demonstracao-plano.ts'

/**
 * Grava o plano da comunidade de demonstração (A) numa transação do DONO do
 * banco, criando só o que falta. Cada peça tem uma chave natural:
 *
 * - local pelo nome; evento pelo título e pelo dia (ou, no evento especial,
 *   pelo título entre os eventos futuros); etapa pelo título dentro do evento
 *   (etapas só nascem em evento sem nenhuma); escala pelo par etapa e função;
 *   tarefa e item de checklist pelo texto; inscrição e presença pela pessoa;
 * - aviso, sugestão, música e dinâmica pelo título; palestrante pelo nome;
 * - pedido de oração pela autora e pelo TEXTO, conferido decifrando o que já
 *   está gravado (o banco só tem bytes cifrados); intercessão pelo par pedido
 *   e conta; disponibilidade pelo par pessoa e dia.
 *
 * Nada que já existe é alterado: o estado desejado (confirmada, concluída,
 * marcado) só vale para a peça criada agora.
 *
 * O dono não passa pela RLS, mas passa pelos gatilhos (log de mudanças,
 * notificações, guardas de comunidade). Onde a API usa uma função do banco ou
 * um serviço, a semente usa o mesmo caminho, no contexto da pessoa: confirmar
 * escala e pedir substituição (`uj.responder_atribuicao`,
 * `uj.pedir_substituicao`), inscrever (`uj.inscrever_membro`), registrar
 * presença (`registrarPresenca`) e cifrar o pedido de oração (`cifrar`, com o
 * dado autenticado `oracao:<id>` da rota `/oracao`). A auditoria recebe as
 * mesmas ações que a API registraria.
 */

/** O que a semente fez, para o relatório da linha de comando (nunca texto de oração). */
export interface Registro {
  /** Uma linha por peça principal criada agora. */
  criadas: string[]
  /** Quantas peças de cada tipo foram criadas agora, inclusive as filhas. */
  contagem: Record<string, number>
  /** O que ficou de fora e por quê. */
  avisos: string[]
}

export function anotar(r: Registro, tipo: string, linha?: string): void {
  r.contagem[tipo] = (r.contagem[tipo] ?? 0) + 1
  if (linha) r.criadas.push(linha)
}

/** Autoria e RLS vêm do contexto da transação (as políticas leem estes GUCs). */
export async function noContexto(
  c: pg.PoolClient,
  contaId: string,
  comunidadeId: string,
): Promise<void> {
  await c.query(
    "select set_config('app.conta_id', $1, true), set_config('app.comunidade_id', $2, true)",
    [contaId, comunidadeId],
  )
}

export interface PessoaEmA {
  conta: string
  vinculo: string
}

export interface DadosDaComunidadeA {
  comunidade: string
  /** Só pessoas com conta ativa e vínculo ativo em A (as outras ficam de fora do plano). */
  pessoas: Partial<Record<ChaveEmA, PessoaEmA>>
  /** Chave de 32 bytes da API (ORACAO_CHAVE). Sem ela, os pedidos de oração ficam de fora. */
  chaveDeOracao: Buffer | null
  registro: Registro
}

interface Semeadura extends DadosDaComunidadeA {
  c: pg.PoolClient
  fuso: string
}

/** Quem cria e modera quando a pessoa do plano não está mais ativa. */
const QUEM_ORGANIZA: readonly ChaveEmA[] = ['admin', 'admin2', 'organizador', 'mateus']

function pessoa(s: Semeadura, chave: ChaveEmA): PessoaEmA | undefined {
  return s.pessoas[chave]
}

/** A pessoa do plano ou, se ela saiu, outra que organiza. */
function autora(s: Semeadura, chave: ChaveEmA): PessoaEmA | undefined {
  for (const k of [chave, ...QUEM_ORGANIZA]) {
    const p = s.pessoas[k]
    if (p) return p
  }
  return undefined
}

async function como(s: Semeadura, p: PessoaEmA): Promise<void> {
  await noContexto(s.c, p.conta, s.comunidade)
}

async function auditar(
  s: Semeadura,
  conta: string,
  acao: string,
  recurso: { tipo: string; id: string },
  detalhes: Record<string, unknown> = {},
): Promise<void> {
  await s.c.query(
    `insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
     values ($1, $2, $3, $4, $5, $6)`,
    [conta, s.comunidade, acao, recurso.tipo, recurso.id, JSON.stringify(detalhes)],
  )
}

const instante = (s: Semeadura, h: HorarioLocal) => instanteNoFuso(h.data, h.hora, s.fuso)

async function existe(s: Semeadura, sql: string, params: unknown[]): Promise<boolean> {
  return (await s.c.query(sql, params)).rows.length > 0
}

export async function semearComunidadeA(c: pg.PoolClient, d: DadosDaComunidadeA): Promise<void> {
  const com = (
    await c.query<{ fuso: string; estado: string }>(
      'select fuso, estado from uj.comunidades where id = $1',
      [d.comunidade],
    )
  ).rows[0]
  if (!com || com.estado !== 'ativa') {
    d.registro.avisos.push(
      'A comunidade de demonstração não está ativa; o conteúdo dela não foi semeado.',
    )
    return
  }
  const s: Semeadura = { ...d, c, fuso: com.fuso }
  if (!autora(s, 'admin')) {
    d.registro.avisos.push(
      'Ninguém organiza a comunidade de demonstração; o conteúdo dela não foi semeado.',
    )
    return
  }
  // Datas no fuso DA comunidade: "próximo sábado" é o sábado de quem está lá.
  const plano = planoDaComunidadeA(dataNoFuso(new Date(), s.fuso))

  const locais = {
    salao: await garantirLocal(s, plano, 'salao'),
    sitio: await garantirLocal(s, plano, 'sitio'),
  }
  for (const evento of plano.eventos) await garantirEvento(s, evento, locais[evento.local])
  await garantirDisponibilidades(s, plano)
  await garantirAvisos(s, plano)
  await garantirConteudos(s, plano)
  await garantirSugestoes(s, plano)
  await garantirPedidosDeOracao(s, plano)
}

// ---------------------------------------------------------------- locais e eventos

async function garantirLocal(
  s: Semeadura,
  plano: PlanoDaComunidadeA,
  chave: 'salao' | 'sitio',
): Promise<string> {
  const l = plano.locais[chave]
  const ja = await s.c.query<{ id: string }>(
    'select id from uj.locais where comunidade_id = $1 and nome = $2 order by criado_em limit 1',
    [s.comunidade, l.nome],
  )
  if (ja.rows[0]) return ja.rows[0].id
  const { rows } = await s.c.query<{ id: string }>(
    `insert into uj.locais (comunidade_id, nome, tipo, endereco, referencia)
     values ($1, $2, $3, $4, $5) returning id`,
    [s.comunidade, l.nome, l.tipo, l.endereco, l.referencia],
  )
  anotar(s.registro, 'locais', `local ${l.nome}`)
  return rows[0]!.id
}

interface EventoGravado {
  id: string
  inicio: Date
  fim: Date
}

async function garantirEvento(s: Semeadura, e: EventoDoPlano, localId: string): Promise<void> {
  const quem = autora(s, e.autor)!
  const ja =
    e.identidade === 'data'
      ? await s.c.query<{ id: string; inicio: Date; duracao_min: number }>(
          `select id, inicio, duracao_min from uj.eventos
            where comunidade_id = $1 and titulo = $2 and (inicio at time zone fuso)::date = $3::date
            order by criado_em limit 1`,
          [s.comunidade, e.titulo, e.inicio.data],
        )
      : await s.c.query<{ id: string; inicio: Date; duracao_min: number }>(
          `select id, inicio, duracao_min from uj.eventos
            where comunidade_id = $1 and titulo = $2 and inicio > now() and status <> 'cancelado'
            order by inicio limit 1`,
          [s.comunidade, e.titulo],
        )
  let ev: EventoGravado
  if (ja.rows[0]) {
    const r = ja.rows[0]
    ev = { id: r.id, inicio: r.inicio, fim: new Date(r.inicio.getTime() + r.duracao_min * 60_000) }
  } else {
    await como(s, quem)
    const inicio = instante(s, e.inicio)
    const { rows } = await s.c.query<{ id: string }>(
      `insert into uj.eventos (comunidade_id, titulo, descricao, categoria, inicio, duracao_min, fuso,
         status, visibilidade, local_id, capacidade, inscricao_ate, lista_de_espera,
         informacoes_uteis)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`,
      [
        s.comunidade,
        e.titulo,
        e.descricao,
        e.categoria,
        inicio,
        e.duracaoMin,
        s.fuso,
        e.status,
        e.visibilidade,
        localId,
        e.capacidade ?? null,
        e.inscricaoAte ? instante(s, e.inscricaoAte) : null,
        e.listaDeEspera ?? false,
        e.informacoesUteis ?? null,
      ],
    )
    ev = { id: rows[0]!.id, inicio, fim: new Date(inicio.getTime() + e.duracaoMin * 60_000) }
    await auditar(s, quem.conta, 'evento.criado', { tipo: 'evento', id: ev.id })
    anotar(s.registro, 'eventos', `evento ${e.titulo} em ${dataPorExtenso(e.inicio.data)}`)
  }

  const etapas = await garantirEtapas(s, ev, e)
  await garantirChecklist(s, ev, e, quem)
  await garantirTarefas(s, ev, e, quem)
  await garantirEscalas(s, ev, e, etapas, quem)
  await garantirInscricoes(s, ev, e)
  await garantirPresencas(s, ev, e, quem)
}

/** Etapas só nascem em evento sem nenhuma; nas que existem, vale o título. */
async function garantirEtapas(
  s: Semeadura,
  ev: EventoGravado,
  e: EventoDoPlano,
): Promise<Map<string, string>> {
  const atuais = await s.c.query<{ id: string; titulo: string }>(
    'select id, titulo from uj.etapas where evento_id = $1 order by ordem',
    [ev.id],
  )
  if (atuais.rows.length === 0) {
    for (const [ordem, etapa] of e.etapas.entries()) {
      const { rows } = await s.c.query<{ id: string; titulo: string }>(
        `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min, descricao)
         values ($1, $2, $3, $4, $5, $6) returning id, titulo`,
        [s.comunidade, ev.id, ordem, etapa.titulo, etapa.duracaoMin, etapa.descricao ?? null],
      )
      atuais.rows.push(rows[0]!)
      anotar(s.registro, 'etapas')
    }
  }
  const porTitulo = new Map<string, string>()
  for (const r of atuais.rows) if (!porTitulo.has(r.titulo)) porTitulo.set(r.titulo, r.id)
  return porTitulo
}

async function garantirChecklist(
  s: Semeadura,
  ev: EventoGravado,
  e: EventoDoPlano,
  quem: PessoaEmA,
): Promise<void> {
  for (const item of e.checklist) {
    const ja = await existe(
      s,
      'select 1 from uj.checklist_itens where evento_id = $1 and tipo = $2 and texto = $3',
      [ev.id, item.tipo, item.texto],
    )
    if (ja) continue
    const responsavel = item.responsavel ? pessoa(s, item.responsavel) : undefined
    // Marcado ao fim do evento, por quem cuidava do item (ou por quem organiza).
    const marcado = item.marcado ? { em: ev.fim, por: (responsavel ?? quem).conta } : null
    await s.c.query(
      `insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto, ordem,
         responsavel_vinculo_id, marcado_em, marcado_por)
       values ($1, $2, $3, $4,
         (select coalesce(max(ordem) + 1, 0) from uj.checklist_itens where evento_id = $2 and tipo = $3),
         $5, case when $6::timestamptz is not null then least(now(), $6::timestamptz) end, $7)`,
      [
        s.comunidade,
        ev.id,
        item.tipo,
        item.texto,
        responsavel?.vinculo ?? null,
        marcado?.em ?? null,
        marcado?.por ?? null,
      ],
    )
    anotar(s.registro, 'itens de checklist')
  }
}

async function garantirTarefas(
  s: Semeadura,
  ev: EventoGravado,
  e: EventoDoPlano,
  quem: PessoaEmA,
): Promise<void> {
  for (const t of e.tarefas) {
    const responsavel = pessoa(s, t.responsavel)
    if (!responsavel) continue
    const ja = await existe(s, 'select 1 from uj.tarefas where evento_id = $1 and titulo = $2', [
      ev.id,
      t.titulo,
    ])
    if (ja) continue
    await como(s, quem)
    // Tarefa concluída: na véspera do evento (ou agora, se a véspera ainda não chegou).
    await s.c.query(
      `insert into uj.tarefas (comunidade_id, evento_id, titulo, descricao, responsavel_vinculo_id,
         prazo, concluida_em, concluida_por)
       values ($1, $2, $3, $4, $5, $6,
         case when $7 then least(now(), $8::timestamptz - interval '1 day') end,
         case when $7 then $9::uuid end)`,
      [
        s.comunidade,
        ev.id,
        t.titulo,
        t.descricao ?? null,
        responsavel.vinculo,
        t.prazo ? instante(s, t.prazo) : null,
        t.concluida === true,
        ev.inicio,
        responsavel.conta,
      ],
    )
    anotar(s.registro, 'tarefas')
  }
}

async function garantirEscalas(
  s: Semeadura,
  ev: EventoGravado,
  e: EventoDoPlano,
  etapas: Map<string, string>,
  quem: PessoaEmA,
): Promise<void> {
  for (const esc of e.escalas) {
    const etapaId = esc.etapa === null ? null : etapas.get(esc.etapa)
    const p = pessoa(s, esc.pessoa)
    if (etapaId === undefined || !p) continue
    const ja = await existe(
      s,
      `select 1 from uj.atribuicoes
        where evento_id = $1 and etapa_id is not distinct from $2::uuid and vinculo_id = $3
          and funcao = $4`,
      [ev.id, etapaId, p.vinculo, esc.funcao],
    )
    if (ja) continue
    await como(s, quem)
    const { rows } = await s.c.query<{ id: string }>(
      `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao)
       values ($1, $2, $3, $4, $5) returning id`,
      [s.comunidade, ev.id, etapaId, p.vinculo, esc.funcao],
    )
    const id = rows[0]!.id
    anotar(s.registro, 'escalas')
    // A resposta e o pedido de troca são da própria pessoa: mesmas funções da API.
    if (esc.estado === 'confirmada' || esc.pedirSubstituicao) await como(s, p)
    if (esc.estado === 'confirmada') {
      await s.c.query("select uj.responder_atribuicao($1, 'confirmada')", [id])
    }
    if (esc.pedirSubstituicao) {
      await s.c.query('select uj.pedir_substituicao($1, $2, null)', [id, esc.pedirSubstituicao])
      anotar(s.registro, 'substituições')
    }
  }
}

async function garantirInscricoes(
  s: Semeadura,
  ev: EventoGravado,
  e: EventoDoPlano,
): Promise<void> {
  if (e.inscricoes.length === 0) return
  // Fora do prazo, a função recusaria (e a transação inteira cairia): só tenta com a inscrição aberta.
  const aberta = await existe(
    s,
    `select 1 from uj.eventos where id = $1 and status = 'publicado' and inicio > now()
        and (inscricao_ate is null or inscricao_ate > now())`,
    [ev.id],
  )
  if (!aberta) return
  for (const chave of e.inscricoes) {
    const p = pessoa(s, chave)
    if (!p) continue
    const ja = await existe(
      s,
      "select 1 from uj.inscricoes where evento_id = $1 and vinculo_id = $2 and estado <> 'cancelada'",
      [ev.id, p.vinculo],
    )
    if (ja) continue
    await como(s, p)
    await s.c.query('select * from uj.inscrever_membro($1)', [ev.id])
    anotar(s.registro, 'inscrições')
  }
}

async function garantirPresencas(
  s: Semeadura,
  ev: EventoGravado,
  e: EventoDoPlano,
  quem: PessoaEmA,
): Promise<void> {
  if ((e.presencas.length === 0 && e.visitantes.length === 0) || ev.inicio > new Date()) return
  // Quem registra é sempre o vínculo do contexto (como no check-in do app).
  await como(s, quem)
  const chegada = (i: number) => new Date(ev.inicio.getTime() + (i * 2 - 10) * 60_000).toISOString()
  for (const [i, chave] of e.presencas.entries()) {
    const p = pessoa(s, chave)
    if (!p) continue
    const r = await registrarPresenca(s.c, s.comunidade, ev.id, {
      chaveIdempotencia: randomUUID(),
      origem: 'qr',
      vinculoId: p.vinculo,
      ocorridaEm: chegada(i),
    })
    if (!r.jaRegistrada) anotar(s.registro, 'presenças')
  }
  for (const nome of e.visitantes) {
    const ja = await existe(
      s,
      'select 1 from uj.presencas where evento_id = $1 and nome_avulso = $2',
      [ev.id, nome],
    )
    if (ja) continue
    await registrarPresenca(s.c, s.comunidade, ev.id, {
      chaveIdempotencia: randomUUID(),
      origem: 'manual',
      nomeAvulso: nome,
      ocorridaEm: chegada(e.presencas.length),
    })
    anotar(s.registro, 'presenças')
  }
}

// ---------------------------------------------------------------- escalas: disponibilidade

async function garantirDisponibilidades(s: Semeadura, plano: PlanoDaComunidadeA): Promise<void> {
  for (const d of plano.disponibilidades) {
    const p = pessoa(s, d.pessoa)
    if (!p) continue
    await como(s, p)
    const { rows } = await s.c.query(
      `insert into uj.disponibilidades (comunidade_id, vinculo_id, data, disponivel, observacao)
       values ($1, $2, $3, $4, $5) on conflict (vinculo_id, data) do nothing returning id`,
      [s.comunidade, p.vinculo, d.data, d.disponivel, d.observacao],
    )
    if (rows[0]) anotar(s.registro, 'disponibilidades')
  }
}

// ---------------------------------------------------------------- avisos e conteúdos

async function garantirAvisos(s: Semeadura, plano: PlanoDaComunidadeA): Promise<void> {
  for (const a of plano.avisos) {
    const ja = await existe(s, 'select 1 from uj.avisos where comunidade_id = $1 and titulo = $2', [
      s.comunidade,
      a.titulo,
    ])
    if (ja) continue
    const quem = autora(s, a.autor)!
    await como(s, quem)
    // A data de publicação é do servidor (gatilho guardar_aviso); o gatilho de
    // notificação avisa os membros, como na publicação pelo app.
    const { rows } = await s.c.query<{ id: string }>(
      `insert into uj.avisos (comunidade_id, titulo, texto, estado, fixado)
       values ($1, $2, $3, 'publicado', $4) returning id`,
      [s.comunidade, a.titulo, a.texto, a.fixado],
    )
    await auditar(
      s,
      quem.conta,
      'aviso.criado',
      { tipo: 'aviso', id: rows[0]!.id },
      { estado: 'publicado' },
    )
    anotar(s.registro, 'avisos', `aviso ${a.titulo}`)
  }
}

async function garantirConteudos(s: Semeadura, plano: PlanoDaComunidadeA): Promise<void> {
  const criar = async (
    tabela: 'musicas' | 'palestrantes' | 'dinamicas',
    autor: ChaveEmA,
    chave: { coluna: 'titulo' | 'nome'; valor: string },
    insercao: string,
    params: unknown[],
    linha: string,
  ) => {
    const ja = await existe(
      s,
      `select 1 from uj.${tabela} where comunidade_id = $1 and ${chave.coluna} = $2`,
      [s.comunidade, chave.valor],
    )
    if (ja) return
    const quem = autora(s, autor)!
    await como(s, quem)
    const { rows } = await s.c.query<{ id: string }>(insercao, [s.comunidade, ...params])
    await auditar(s, quem.conta, 'conteudo.criado', { tipo: tabela, id: rows[0]!.id })
    anotar(s.registro, tabela, linha)
  }
  for (const m of plano.musicas.itens) {
    await criar(
      'musicas',
      plano.musicas.autor,
      { coluna: 'titulo', valor: m.titulo },
      `insert into uj.musicas (comunidade_id, titulo, artista, tom, observacoes)
       values ($1, $2, $3, $4, $5) returning id`,
      [m.titulo, m.artista, m.tom, m.observacoes],
      `música ${m.titulo}`,
    )
  }
  for (const p of plano.palestrantes.itens) {
    await criar(
      'palestrantes',
      plano.palestrantes.autor,
      { coluna: 'nome', valor: p.nome },
      `insert into uj.palestrantes (comunidade_id, nome, temas, origem, observacoes)
       values ($1, $2, $3, $4, $5) returning id`,
      [p.nome, p.temas, p.origem, p.observacoes],
      `palestrante ${p.nome}`,
    )
  }
  for (const d of plano.dinamicas.itens) {
    await criar(
      'dinamicas',
      plano.dinamicas.autor,
      { coluna: 'titulo', valor: d.titulo },
      `insert into uj.dinamicas (comunidade_id, titulo, objetivo, instrucoes, duracao_min, materiais)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [d.titulo, d.objetivo, d.instrucoes, d.duracaoMin, d.materiais],
      `dinâmica ${d.titulo}`,
    )
  }
}

// ---------------------------------------------------------------- sugestões

async function garantirSugestoes(s: Semeadura, plano: PlanoDaComunidadeA): Promise<void> {
  for (const g of plano.sugestoes) {
    const p = pessoa(s, g.autor)
    if (!p) continue
    const ja = await existe(
      s,
      'select 1 from uj.sugestoes where comunidade_id = $1 and titulo = $2',
      [s.comunidade, g.titulo],
    )
    if (ja) continue
    const moderador = g.status === 'recebida' ? null : autora(s, g.moderadaPor ?? 'organizador')!
    await como(s, p)
    // A autoria vem do contexto (autor_conta_id = uj.conta_atual()), como na rota.
    const { rows } = await s.c.query<{ id: string }>(
      `insert into uj.sugestoes (comunidade_id, anonima, titulo, texto, status, resposta,
         respondida_por, respondida_em, criado_em)
       values ($1, $2, $3, $4, $5, $6, $7, case when $7::uuid is not null then now() end,
         now() - make_interval(hours => $8))
       returning id`,
      [
        s.comunidade,
        g.anonima,
        g.titulo,
        g.texto,
        g.status,
        g.resposta ?? null,
        moderador?.conta ?? null,
        g.horasAtras,
      ],
    )
    if (moderador) {
      await auditar(
        s,
        moderador.conta,
        'sugestao.moderada',
        { tipo: 'sugestao', id: rows[0]!.id },
        { status: { de: 'recebida', para: g.status }, respondeu: g.resposta !== undefined },
      )
    }
    anotar(s.registro, 'sugestões', `sugestão ${g.titulo}`)
  }
}

// ---------------------------------------------------------------- pedidos de oração

async function garantirPedidosDeOracao(s: Semeadura, plano: PlanoDaComunidadeA): Promise<void> {
  const chave = s.chaveDeOracao
  if (!chave) {
    s.registro.avisos.push(
      'Pedidos de oração não semeados: defina ORACAO_CHAVE (a mesma da API) para cifrá-los.',
    )
    return
  }
  const autoras = [...new Set(plano.pedidosDeOracao.map((p) => pessoa(s, p.autor)?.conta))].filter(
    (x): x is string => x !== undefined,
  )
  // O texto só existe cifrado: o pedido já gravado é reconhecido decifrando-o
  // aqui, em memória. O texto nunca sai desta função (nem em erro).
  const gravados = new Map<string, string>()
  const { rows } = await s.c.query<{ id: string; autor_conta_id: string; texto_cifrado: Buffer }>(
    `select id, autor_conta_id, texto_cifrado from uj.pedidos_oracao
      where comunidade_id = $1 and autor_conta_id = any($2::uuid[])`,
    [s.comunidade, autoras],
  )
  for (const r of rows) {
    let texto: string
    try {
      texto = decifrar(chave, r.texto_cifrado, `oracao:${r.id}`)
    } catch {
      throw new Error(
        'A ORACAO_CHAVE informada não decifra os pedidos de oração já gravados na demonstração. ' +
          'Use a mesma chave da API.',
      )
    }
    gravados.set(`${r.autor_conta_id}\n${texto}`, r.id)
  }

  for (const [n, pedido] of plano.pedidosDeOracao.entries()) {
    const autor = pessoa(s, pedido.autor)
    if (!autor) continue
    let id = gravados.get(`${autor.conta}\n${pedido.texto}`)
    if (!id) {
      id = randomUUID()
      await como(s, autor)
      // Mesmo caminho da rota POST /oracao: id gerado antes, cifra com `oracao:<id>`.
      await s.c.query(
        `insert into uj.pedidos_oracao (id, comunidade_id, texto_cifrado, visibilidade,
           respondido_em, criado_em)
         values ($1, $2, $3, $4, case when $5 then now() end, now() - make_interval(hours => $6))`,
        [
          id,
          s.comunidade,
          cifrar(chave, pedido.texto, `oracao:${id}`),
          pedido.visibilidade,
          pedido.respondido === true,
          pedido.horasAtras,
        ],
      )
      const recurso = { tipo: 'pedido_oracao', id }
      await auditar(s, autor.conta, 'oracao.criado', recurso, {
        visibilidade: pedido.visibilidade,
      })
      if (pedido.respondido) {
        await auditar(s, autor.conta, 'oracao.respondido', recurso, { respondido: true })
      }
      anotar(
        s.registro,
        'pedidos de oração',
        `pedido de oração ${n + 1} (${pedido.visibilidade === 'comunidade' ? 'comunidade' : 'somente eu'})`,
      )
    }
    for (const chaveDeQuemOra of pedido.orando) {
      const quem = pessoa(s, chaveDeQuemOra)
      if (!quem) continue
      await como(s, quem)
      const r = await s.c.query(
        `insert into uj.intercessoes (comunidade_id, pedido_id) values ($1, $2)
         on conflict (pedido_id, conta_id) do nothing returning id`,
        [s.comunidade, id],
      )
      if (r.rows[0]) anotar(s.registro, 'intercessões')
    }
  }
}
