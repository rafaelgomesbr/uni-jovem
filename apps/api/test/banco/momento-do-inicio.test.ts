import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Cartão do momento do Início (D66): o campo `momento` de `GET /inicio`, com o
 * estado (longe, véspera, no dia, acontecendo), "Sua parte", a inscrição, os
 * números do líder (responderam, quem falta, falta função, músicas, quantos o
 * lembrete alcança), o encontro que terminou há menos de 24 h e "próximo a
 * marcar". Os campos de antes do `/inicio` não mudam.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let comB: string
let org: Pessoa
let orgB: Pessoa
let ana: Pessoa
let bruno: Pessoa
let camila: Pessoa
let mara: Pessoa
const v: Record<string, string> = {}

const HORA = 3_600_000
const DIA = 24 * HORA

async function inicio(p: Pessoa, comunidade = com) {
  const r = await app.inject({
    method: 'GET',
    url: `/api/v1/c/${comunidade}/inicio`,
    headers: p.auth,
  })
  expect(r.statusCode).toBe(200)
  return r.json()
}

/** Cria o encontro direto no banco (o relógio do teste é o de verdade), no instante pedido. */
async function encontro(
  titulo: string,
  inicioEm: Date,
  opcoes: { status?: string; duracaoMin?: number; comunidade?: string; publica?: boolean } = {},
): Promise<string> {
  const { rows } = await b.dono.query<{ id: string }>(
    `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, status,
                             criado_por, visibilidade, capacidade)
     values ($1, $2, 'Programação de sábado', $3, $4, 'America/Sao_Paulo', $5, $6, $7, $8)
     returning id`,
    [
      opcoes.comunidade ?? com,
      titulo,
      inicioEm,
      opcoes.duracaoMin ?? 60,
      opcoes.status ?? 'publicado',
      org.id,
      opcoes.publica ? 'publica' : 'interna',
      opcoes.publica ? 50 : null,
    ],
  )
  return rows[0]!.id
}

async function limpar() {
  await b.dono.query('delete from uj.eventos where comunidade_id = any ($1)', [[com, comB]])
}

async function convocar(
  eventoId: string,
  vinculo: string,
  funcao: string,
  estado: string,
  etapaId: string | null = null,
) {
  await b.dono.query(
    `insert into uj.atribuicoes (comunidade_id, evento_id, etapa_id, vinculo_id, funcao, estado)
     values ($1, $2, $3, $4, $5, $6)`,
    [com, eventoId, etapaId, vinculo, funcao, estado],
  )
}

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  com = await criarComunidade(b, 'Jovens do Vale')
  comB = await criarComunidade(b, 'Jovens da Serra')
  org = await pessoaComSessao(b, app, config, 'Daniel')
  orgB = await pessoaComSessao(b, app, config, 'Otávio')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bruno = await pessoaComSessao(b, app, config, 'Bruno')
  camila = await pessoaComSessao(b, app, config, 'Camila')
  mara = await pessoaComSessao(b, app, config, 'Mara')
  v['org'] = await vincular(b, org.id, com, 'organizador')
  await vincular(b, orgB.id, comB, 'organizador')
  v['ana'] = await vincular(b, ana.id, com, 'membro')
  v['bruno'] = await vincular(b, bruno.id, com, 'membro')
  v['camila'] = await vincular(b, camila.id, com, 'membro')
  v['mara'] = await vincular(b, mara.id, com, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('estado e dados do encontro do cartão', () => {
  it('sem nenhum encontro: tudo vazio, e o líder vê "próximo a marcar"', async () => {
    await limpar()
    const lider = (await inicio(org)).momento
    expect(lider).toMatchObject({
      evento: null,
      estado: null,
      minutosParaInicio: null,
      suaParte: [],
      inscricao: null,
      lider: null,
      recemTerminado: null,
      proximoAMarcar: true,
    })
    // Membro: o campo de organização é nulo, não "falso".
    expect((await inicio(ana)).momento.proximoAMarcar).toBeNull()
  })

  it('os campos de antes continuam iguais', async () => {
    const r = await inicio(ana)
    expect(Object.keys(r).sort()).toEqual(
      [
        'avisos',
        'minhasEscalas',
        'minhasTarefas',
        'momento',
        'proximosEventos',
        'substituicoesAbertas',
      ].sort(),
    )
  })

  it('longe, véspera e no dia pelo relógio do fuso do encontro', async () => {
    await limpar()
    const longe = await encontro('Longe', new Date(Date.now() + 5 * DIA))
    let m = (await inicio(ana)).momento
    expect(m.evento.id).toBe(longe)
    expect(m.estado).toBe('longe')
    expect(m.minutosParaInicio).toBeGreaterThan(5 * 24 * 60 - 5)
    expect(m.evento.local).toBeNull()

    await limpar()
    await encontro('Véspera', new Date(Date.now() + 26 * HORA))
    m = (await inicio(ana)).momento
    // 26 h pode cair em amanhã (véspera) ou, a depender da hora local, depois de amanhã (longe);
    // o que não pode é ser "no dia" nem "acontecendo".
    expect(['vespera', 'longe']).toContain(m.estado)

    await limpar()
    await encontro('No dia', new Date(Date.now() + 10 * 60_000))
    m = (await inicio(ana)).momento
    expect(m.estado).toBe('no_dia')
    expect(m.minutosParaInicio).toBeGreaterThanOrEqual(9)
  })

  it('acontecendo (pelo horário) e quem está acontecendo vem antes do próximo', async () => {
    await limpar()
    const agora = await encontro('Agora', new Date(Date.now() - 20 * 60_000), { duracaoMin: 90 })
    await encontro('Depois', new Date(Date.now() + 3 * DIA))
    const m = (await inicio(ana)).momento
    expect(m.evento.id).toBe(agora)
    expect(m.estado).toBe('acontecendo')
    expect(m.minutosParaInicio).toBeLessThan(0)
  })

  it('o ao vivo vence o relógio: estourou o horário e segue acontecendo; encerrado sai do cartão', async () => {
    await limpar()
    const e = await encontro('Estourou', new Date(Date.now() - 3 * HORA), { duracaoMin: 60 })
    expect((await inicio(ana)).momento.evento).toBeNull()
    await b.dono.query(
      `insert into uj.andamentos (comunidade_id, evento_id, situacao, iniciado_em)
       values ($1, $2, 'em_andamento', now() - interval '3 hours')`,
      [com, e],
    )
    const m = (await inicio(ana)).momento
    expect(m.evento.id).toBe(e)
    expect(m.estado).toBe('acontecendo')
    await b.dono.query(
      `update uj.andamentos set situacao = 'encerrado', encerrado_em = now() where evento_id = $1`,
      [e],
    )
    const depois = (await inicio(ana)).momento
    expect(depois.evento).toBeNull()
    expect(depois.recemTerminado).toMatchObject({ id: e })
  })

  it('local com endereço e coordenadas para o "Como chegar"', async () => {
    await limpar()
    const local = await b.dono.query<{ id: string }>(
      `insert into uj.locais (comunidade_id, nome, tipo, endereco, latitude, longitude)
       values ($1, 'Salão da igreja', 'externo', 'Rua das Flores, 100', -23.5, -46.6) returning id`,
      [com],
    )
    const e = await encontro('Com local', new Date(Date.now() + 2 * DIA))
    await b.dono.query('update uj.eventos set local_id = $2 where id = $1', [e, local.rows[0]!.id])
    const m = (await inicio(ana)).momento
    expect(m.evento.local).toMatchObject({
      nome: 'Salão da igreja',
      tipo: 'externo',
      endereco: 'Rua das Flores, 100',
      latitude: -23.5,
      longitude: -46.6,
    })
  })
})

describe('"Sua parte" e inscrição', () => {
  it('a pendência primeiro, só as da própria pessoa', async () => {
    await limpar()
    const e = await encontro('Com parte', new Date(Date.now() + 4 * DIA))
    const louvor = await b.dono.query<{ id: string }>(
      `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min)
       values ($1, $2, 0, 'Louvor', 20) returning id`,
      [com, e],
    )
    await convocar(e, v['ana']!, 'Vocal', 'confirmada', louvor.rows[0]!.id)
    await convocar(e, v['ana']!, 'Recepção', 'pendente')
    await convocar(e, v['bruno']!, 'Violão', 'pendente', louvor.rows[0]!.id)
    const m = (await inicio(ana)).momento
    expect(m.suaParte.map((p: { funcao: string }) => p.funcao)).toEqual(['Recepção', 'Vocal'])
    expect(m.suaParte[1]).toMatchObject({ etapaTitulo: 'Louvor', estado: 'confirmada' })
    expect((await inicio(camila)).momento.suaParte).toEqual([])
    // O membro não recebe a visão do líder.
    expect(m.lider).toBeNull()
  })

  it('qualquer pessoa vê quantas músicas o encontro tem (D73), mesmo sem tocar; só a contagem', async () => {
    await limpar()
    const e = await encontro('Com repertório', new Date(Date.now() + 5 * DIA))
    expect((await inicio(camila)).momento.evento.musicas).toBe(0)
    const musica = await b.dono.query<{ id: string }>(
      `insert into uj.musicas (comunidade_id, titulo, criado_por) values ($1, 'Sobre a rocha', $2) returning id`,
      [com, org.id],
    )
    await b.dono.query(
      `insert into uj.repertorio_itens (comunidade_id, evento_id, musica_id, ordem)
       values ($1, $2, $3, 0)`,
      [com, e, musica.rows[0]!.id],
    )
    // Camila não é de nenhuma banda e é só membro: vê a contagem, nunca o título.
    const m = (await inicio(camila)).momento
    expect(m.evento.musicas).toBe(1)
    expect(m.lider).toBeNull()
    expect(JSON.stringify(m)).not.toContain('Sobre a rocha')
    expect((await inicio(org)).momento.evento.musicas).toBe(1)
  })

  it('inscrições: não se aplica, aberta, inscrito, espera e fechada', async () => {
    await limpar()
    const interno = await encontro('Interno', new Date(Date.now() + 3 * DIA))
    expect((await inicio(ana)).momento.inscricao).toEqual({
      situacao: 'nao_se_aplica',
      inscritos: null,
      capacidade: null,
    })
    await b.dono.query('delete from uj.eventos where id = $1', [interno])

    const publico = await encontro('Público', new Date(Date.now() + 3 * DIA), { publica: true })
    expect((await inicio(ana)).momento.inscricao).toEqual({
      situacao: 'aberta',
      inscritos: null,
      capacidade: 50,
    })
    // Quem organiza vê o total.
    expect((await inicio(org)).momento.inscricao).toMatchObject({
      situacao: 'aberta',
      inscritos: 0,
    })
    await b.dono.query(
      `insert into uj.inscricoes (comunidade_id, evento_id, origem, vinculo_id, nome, estado)
       values ($1, $2, 'membro', $3, 'Ana', 'confirmada')`,
      [com, publico, v['ana']],
    )
    expect((await inicio(ana)).momento.inscricao).toMatchObject({
      situacao: 'inscrito',
      inscritos: null,
    })
    expect((await inicio(bruno)).momento.inscricao).toMatchObject({
      situacao: 'aberta',
      inscritos: null,
    })
    expect((await inicio(org)).momento.inscricao).toMatchObject({ inscritos: 1 })
    await b.dono.query(`update uj.inscricoes set estado = 'espera' where evento_id = $1`, [publico])
    expect((await inicio(ana)).momento.inscricao.situacao).toBe('espera')
    await b.dono.query(
      `update uj.eventos set inscricao_ate = now() - interval '1 hour' where id = $1`,
      [publico],
    )
    expect((await inicio(bruno)).momento.inscricao.situacao).toBe('fechada')
  })
})

describe('visão do líder', () => {
  let e: string

  beforeAll(async () => {
    await limpar()
    e = await encontro('Sábado Jovem', new Date(Date.now() + 5 * DIA))
    const louvor = await b.dono.query<{ id: string }>(
      `insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min)
       values ($1, $2, 0, 'Louvor', 20) returning id`,
      [com, e],
    )
    const l = louvor.rows[0]!.id
    await convocar(e, v['ana']!, 'Vocal', 'confirmada', l)
    await convocar(e, v['bruno']!, 'Violão', 'pendente', l)
    await convocar(e, v['camila']!, 'Bateria', 'pendente', l)
    await convocar(e, v['mara']!, 'Recepção', 'recusada')
    const m = await b.dono.query<{ id: string }>(
      `insert into uj.musicas (comunidade_id, titulo, criado_por) values ($1, 'Sobre a rocha', $2) returning id`,
      [com, org.id],
    )
    await b.dono.query(
      `insert into uj.repertorio_itens (comunidade_id, evento_id, etapa_id, musica_id, ordem)
       values ($1, $2, $3, $4, 0)`,
      [com, e, l, m.rows[0]!.id],
    )
  })

  it('quantos responderam, quem falta, falta função, músicas e quantos o lembrete alcança', async () => {
    const m = (await inicio(org)).momento
    expect(m.evento.id).toBe(e)
    expect(m.lider).toMatchObject({
      convocados: 4,
      confirmados: 1,
      recusaram: 1,
      pendentes: 2,
      responderam: 2,
      faltamResponderTotal: 2,
      musicas: 1,
      inscritos: 0,
      presentes: 0,
      lembraveis: 2,
      avisariaAoPublicar: 4,
    })
    expect(
      m.lider.faltamResponder.map((p: { nome: string; funcoes: string[] }) => [p.nome, p.funcoes]),
    ).toEqual([
      ['Bruno', ['Violão']],
      ['Camila', ['Bateria']],
    ])
    // Vocal aceitou; Violão e Bateria só têm pendentes: faltam as duas.
    expect(m.lider.faltaFuncao).toEqual(['Violão', 'Bateria'])
    // Há encontro só este: nada marcado depois dele.
    expect(m.proximoAMarcar).toBe(true)
  })

  it('"Lembrar" muda o número: quem já foi lembrado nas últimas 24 h não conta', async () => {
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${com}/eventos/${e}/lembrar-pendentes`,
      headers: org.auth,
    })
    expect(r.json()).toEqual({ pendentes: 2, lembradas: 2, jaLembradas: 0 })
    const m = (await inicio(org)).momento
    expect(m.lider.lembraveis).toBe(0)
    expect(m.lider.pendentes).toBe(2)
  })

  it('rascunho: o líder vê, o membro não; "avisaria ao publicar" conta as pessoas', async () => {
    await b.dono.query(`update uj.eventos set status = 'rascunho' where id = $1`, [e])
    const lider = (await inicio(org)).momento
    expect(lider.evento).toMatchObject({ id: e, status: 'rascunho' })
    expect(lider.lider.avisariaAoPublicar).toBe(4)
    expect(lider.lider.lembraveis).toBe(0)
    expect(lider.inscricao.situacao).toBe('nao_se_aplica')
    expect((await inicio(ana)).momento.evento).toBeNull()
    await b.dono.query(`update uj.eventos set status = 'publicado' where id = $1`, [e])
  })

  it('"próximo a marcar" some quando há outro encontro depois', async () => {
    await encontro('Mais adiante', new Date(Date.now() + 12 * DIA))
    expect((await inicio(org)).momento.proximoAMarcar).toBe(false)
  })

  it('quem pende de resposta é cortado em 4 nomes, com o total', async () => {
    const muitos = await encontro('Com muita gente', new Date(Date.now() + 1 * DIA))
    for (let i = 0; i < 6; i++) {
      const p = await pessoaComSessao(b, app, config, `Pessoa${i}`)
      const vinc = await vincular(b, p.id, com, 'membro')
      await convocar(muitos, vinc, 'Recepção', 'pendente')
    }
    const m = (await inicio(org)).momento
    expect(m.evento.id).toBe(muitos)
    expect(m.lider.faltamResponder).toHaveLength(4)
    expect(m.lider.faltamResponderTotal).toBe(6)
    await b.dono.query('delete from uj.eventos where id = $1', [muitos])
  })

  it('sem texto de oração, nome de música ou cifra no cartão', async () => {
    const corpo = JSON.stringify((await inicio(org)).momento)
    expect(corpo).not.toMatch(/Sobre a rocha/)
  })
})

describe('encontro que acabou de terminar', () => {
  it('até 24 h depois: o líder vê presentes; quem serviu sabe que serviu; depois some', async () => {
    await limpar()
    const e = await encontro('Ontem', new Date(Date.now() - 3 * HORA), { duracaoMin: 60 })
    await convocar(e, v['ana']!, 'Recepção', 'confirmada')
    await convocar(e, v['bruno']!, 'Som', 'pendente')
    await b.dono.query(
      `insert into uj.presencas (comunidade_id, evento_id, vinculo_id, origem, registrada_por, chave_idempotencia)
       values ($1, $2, $3, 'manual', $4, gen_random_uuid()), ($1, $2, $5, 'manual', $4, gen_random_uuid())`,
      [com, e, v['ana'], v['org'], v['camila']],
    )
    const lider = (await inicio(org)).momento
    expect(lider.evento).toBeNull()
    expect(lider.recemTerminado).toMatchObject({
      id: e,
      titulo: 'Ontem',
      presentes: 2,
      euServi: false,
    })
    expect(lider.proximoAMarcar).toBe(true)
    expect((await inicio(ana)).momento.recemTerminado).toMatchObject({
      id: e,
      euServi: true,
      presentes: null,
    })
    // Quem só estava pendente não "serviu"; membro sem parte também não.
    expect((await inicio(bruno)).momento.recemTerminado.euServi).toBe(false)
    expect((await inicio(camila)).momento.recemTerminado.euServi).toBe(false)

    await b.dono.query(`update uj.eventos set inicio = now() - interval '2 days' where id = $1`, [
      e,
    ])
    expect((await inicio(org)).momento.recemTerminado).toBeNull()
  })

  it('cancelado e rascunho passado não contam', async () => {
    await limpar()
    await encontro('Cancelado', new Date(Date.now() - 3 * HORA), { status: 'cancelado' })
    await encontro('Rascunho velho', new Date(Date.now() - 3 * HORA), { status: 'rascunho' })
    const m = (await inicio(org)).momento
    expect(m.evento).toBeNull()
    expect(m.recemTerminado).toBeNull()
  })
})

describe('isolamento', () => {
  it('encontros de B nunca aparecem no cartão de A, e vice-versa', async () => {
    await limpar()
    await encontro('Só de B', new Date(Date.now() + 2 * DIA), { comunidade: comB })
    expect((await inicio(org)).momento.evento).toBeNull()
    expect((await inicio(orgB, comB)).momento.evento).toMatchObject({ titulo: 'Só de B' })
    const cruzado = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${comB}/inicio`,
      headers: org.auth,
    })
    expect(cruzado.statusCode).toBe(404)
  })
})

describe('vários encontros no mesmo dia (doDia, D79)', () => {
  /** Meio-dia em São Paulo (15:00 UTC) de daqui a 3 dias, mais `horas`: tudo no mesmo dia local. */
  function nesseDia(horas: number, dias = 3): Date {
    const base = new Date(Date.now() + dias * DIA)
    base.setUTCHours(15, 0, 0, 0)
    return new Date(base.getTime() + horas * HORA)
  }

  it('sem cartão, a lista vem vazia', async () => {
    await limpar()
    expect((await inicio(ana)).momento.doDia).toEqual([])
  })

  it('traz os encontros do mesmo dia por horário, com o do cartão entre eles, e não os de outro dia', async () => {
    await limpar()
    const tarde = await encontro('Culto', nesseDia(3))
    const manha = await encontro('Café da manhã', nesseDia(-3), { duracaoMin: 90 })
    await encontro('Noite', nesseDia(6), { duracaoMin: 45 })
    await encontro('Outro dia', nesseDia(0, 4))
    await encontro('Cancelado', nesseDia(1), { status: 'cancelado' })
    const m = (await inicio(ana)).momento
    expect(m.evento.id).toBe(manha)
    expect(m.doDia.map((e: { titulo: string }) => e.titulo)).toEqual([
      'Café da manhã',
      'Culto',
      'Noite',
    ])
    expect(m.doDia[0]).toMatchObject({
      id: manha,
      duracaoMin: 90,
      status: 'publicado',
      situacao: 'adiante',
      fuso: 'America/Sao_Paulo',
      suaParte: [],
    })
    expect(m.doDia[1].id).toBe(tarde)
    expect(new Date(m.doDia[0].fim).getTime() - new Date(m.doDia[0].inicio).getTime()).toBe(
      90 * 60_000,
    )
  })

  it('"suaParte" de cada encontro é só da própria pessoa', async () => {
    await limpar()
    const a = await encontro('Primeiro', nesseDia(-2))
    const c = await encontro('Segundo', nesseDia(2))
    await convocar(a, v['ana']!, 'Recepção', 'pendente')
    await convocar(c, v['ana']!, 'Vocal', 'confirmada')
    await convocar(c, v['bruno']!, 'Violão', 'pendente')
    const ana1 = (await inicio(ana)).momento.doDia
    expect(ana1[0].suaParte).toEqual([
      { funcao: 'Recepção', etapaTitulo: null, estado: 'pendente' },
    ])
    expect(ana1[1].suaParte).toEqual([{ funcao: 'Vocal', etapaTitulo: null, estado: 'confirmada' }])
    const bruno1 = (await inicio(bruno)).momento.doDia
    expect(bruno1[0].suaParte).toEqual([])
    expect(bruno1[1].suaParte).toEqual([
      { funcao: 'Violão', etapaTitulo: null, estado: 'pendente' },
    ])
  })

  it('rascunho só aparece na lista da organização', async () => {
    await limpar()
    await encontro('Publicado', nesseDia(-1))
    await encontro('Rascunho', nesseDia(2), { status: 'rascunho' })
    expect((await inicio(org)).momento.doDia).toHaveLength(2)
    expect((await inicio(ana)).momento.doDia.map((e: { titulo: string }) => e.titulo)).toEqual([
      'Publicado',
    ])
  })

  it('o que já terminou hoje fica na lista, e o cartão é o próximo', async () => {
    await limpar()
    const agora = new Date()
    // Dois encontros no dia de hoje (fuso de São Paulo): um que já acabou e um que ainda vem.
    const acabou = await encontro('Já foi', new Date(agora.getTime() - 3 * HORA), {
      duracaoMin: 60,
    })
    const vem = await encontro('Ainda vem', new Date(agora.getTime() + 2 * HORA))
    const m = (await inicio(ana)).momento
    // Só vale quando os dois caem no mesmo dia de São Paulo (perto da meia-noite não caem).
    const dia = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
    if (dia(new Date(agora.getTime() - 3 * HORA)) === dia(new Date(agora.getTime() + 2 * HORA))) {
      expect(m.evento.id).toBe(vem)
      expect(m.doDia.map((e: { id: string; situacao: string }) => [e.id, e.situacao])).toEqual([
        [acabou, 'terminou'],
        [vem, 'adiante'],
      ])
    }
  })

  it('isolamento: encontros de B no mesmo dia nunca entram na lista de A', async () => {
    await limpar()
    await encontro('De A', nesseDia(0))
    await encontro('De B', nesseDia(1), { comunidade: comB })
    expect((await inicio(org)).momento.doDia.map((e: { titulo: string }) => e.titulo)).toEqual([
      'De A',
    ])
    expect(
      (await inicio(orgB, comB)).momento.doDia.map((e: { titulo: string }) => e.titulo),
    ).toEqual(['De B'])
  })
})
