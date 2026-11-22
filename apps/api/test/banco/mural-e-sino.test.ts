import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Mural da aba Comunidade e sino com título real (D66): contagens de avisos,
 * de pedidos de oração novos (só número, nunca texto) e de pedidos de entrada;
 * o `assunto` real dos avisos e encontros na caixa de notificações, sem mudar o
 * texto genérico da tela bloqueada (NOT-02), e a quebra de não lidas por tipo.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let org: Pessoa
let orgB: Pessoa
let ana: Pessoa
let bruno: Pessoa
let carla: Pessoa
const v: Record<string, string> = {}

type Metodo = 'GET' | 'POST' | 'DELETE'
const req = (metodo: Metodo, url: string, p: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })

const mural = async (p: Pessoa, com = comA) => {
  const r = await req('GET', `/api/v1/c/${com}/mural`, p)
  expect(r.statusCode).toBe(200)
  return r.json()
}

const CAIXA = '/api/v1/eu/notificacoes/caixa'
const caixa = async (p: Pessoa) => {
  const r = await req('GET', CAIXA, p)
  expect(r.statusCode).toBe(200)
  return r.json().notificacoes as {
    tipo: string
    titulo: string
    texto: string
    assunto: string | null
    eventoId: string | null
    destino: { tela: string } | null
  }[]
}

async function aviso(titulo: string, extra: object = {}) {
  const r = await req('POST', `/api/v1/c/${comA}/avisos`, org, {
    titulo,
    texto: 'Texto sigiloso do aviso com o telefone 11 91234-5678',
    publicar: true,
    ...extra,
  })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
}

async function pedidoDeOracao(p: Pessoa, texto: string, visibilidade = 'comunidade') {
  const r = await req('POST', `/api/v1/c/${comA}/oracao`, p, { texto, visibilidade })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
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
  comA = await criarComunidade(b, 'Jovens do Vale')
  comB = await criarComunidade(b, 'Jovens da Serra')
  org = await pessoaComSessao(b, app, config, 'Olga')
  orgB = await pessoaComSessao(b, app, config, 'Otávio')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bruno = await pessoaComSessao(b, app, config, 'Bruno')
  carla = await pessoaComSessao(b, app, config, 'Carla')
  v['org'] = await vincular(b, org.id, comA, 'organizador')
  await vincular(b, orgB.id, comB, 'organizador')
  v['ana'] = await vincular(b, ana.id, comA, 'membro')
  v['bruno'] = await vincular(b, bruno.id, comA, 'membro')
  v['carla'] = await vincular(b, carla.id, comA, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('mural da Comunidade', () => {
  it('comunidade vazia: zeros e aviso nulo', async () => {
    expect(await mural(ana)).toEqual({
      avisos: { total: 0, destaque: null },
      oracao: { novos: 0 },
      pessoas: { total: 4 },
      organizacao: null,
    })
  })

  it('o aviso à vista é o fixado; rascunho, despublicado e vencido não contam', async () => {
    await aviso('Aviso comum')
    const fixado = await aviso('Ensaio do louvor às 15h', { fixado: true })
    await req('POST', `/api/v1/c/${comA}/avisos`, org, { titulo: 'Rascunho', texto: 'x' })
    const velho = await aviso('Aviso vencido')
    await b.su.query(`update uj.avisos set visivel_ate = now() - interval '1 hour' where id = $1`, [
      velho,
    ])
    const tirado = await aviso('Aviso tirado do ar')
    await req('POST', `/api/v1/c/${comA}/avisos/${tirado}/despublicar`, org)
    const m = await mural(ana)
    expect(m.avisos.total).toBe(2)
    expect(m.avisos.destaque).toMatchObject({
      id: fixado,
      titulo: 'Ensaio do louvor às 15h',
      fixado: true,
    })
    // Só id, título e data: o texto do aviso fica na leitura do aviso.
    expect(Object.keys(m.avisos.destaque).sort()).toEqual(['fixado', 'id', 'publicadoEm', 'titulo'])
    expect(JSON.stringify(m)).not.toMatch(/sigiloso|91234/)
  })

  it('sem fixado, o mais recente é o destaque', async () => {
    await b.su.query(`update uj.avisos set fixado = false where comunidade_id = $1`, [comA])
    const novo = await aviso('O mais novo')
    expect((await mural(bruno)).avisos.destaque.id).toBe(novo)
  })

  it('pedidos de oração novos: só os dos outros, ainda não respondidos, recentes e que ela não marcou', async () => {
    const p1 = await pedidoDeOracao(org, 'Pedido sigiloso número um')
    const p2 = await pedidoDeOracao(org, 'Pedido sigiloso número dois')
    await pedidoDeOracao(org, 'Pedido só dela', 'somente_eu')
    await pedidoDeOracao(ana, 'Pedido da própria Ana')
    expect((await mural(ana)).oracao.novos).toBe(2)
    expect((await mural(bruno)).oracao.novos).toBe(3)
    // A autora não conta os próprios (Ana vê 2 de Olga; Olga vê 1 de Ana).
    expect((await mural(org)).oracao.novos).toBe(1)

    // "Estou orando" tira do selo; respondido também; antigo também.
    expect((await req('POST', `/api/v1/c/${comA}/oracao/${p1}/orando`, ana)).statusCode).toBe(200)
    expect((await mural(ana)).oracao.novos).toBe(1)
    await b.su.query(`update uj.pedidos_oracao set respondido_em = now() where id = $1`, [p2])
    expect((await mural(ana)).oracao.novos).toBe(0)
    await b.su.query(
      `update uj.pedidos_oracao set respondido_em = null, criado_em = now() - interval '8 days' where id = $1`,
      [p2],
    )
    expect((await mural(ana)).oracao.novos).toBe(0)
    expect((await mural(bruno)).oracao.novos).toBe(2)

    // O texto de pedido nunca aparece no mural.
    expect(JSON.stringify(await mural(bruno))).not.toMatch(/sigiloso|dela|Ana/)
  })

  it('quem a pessoa bloqueou não entra na contagem', async () => {
    const antes = (await mural(carla)).oracao.novos
    const b1 = await req('POST', `/api/v1/c/${comA}/bloqueios`, carla, {
      recursoTipo: 'pedido_oracao',
      recursoId: (
        await b.su.query<{ id: string }>(
          `select id from uj.pedidos_oracao where comunidade_id = $1 and visibilidade = 'comunidade' limit 1`,
          [comA],
        )
      ).rows[0]!.id,
    })
    expect(b1.statusCode).toBe(200)
    // Ela bloqueou uma autora (Olga ou Ana): a contagem cai.
    expect((await mural(carla)).oracao.novos).toBeLessThan(antes)
  })

  it('organização: pedidos de entrada só para quem decide; membro recebe nulo', async () => {
    const quem = await pessoaComSessao(b, app, config, 'Quer entrar')
    await b.dono.query(
      `insert into uj.pedidos_de_entrada (comunidade_id, conta_id, origem, mensagem,
                                          consentimento_versao, consentimento_forma)
       values ($1, $2, 'busca', 'Mensagem sigilosa de entrada', 3, 'ios')`,
      [comA, quem.id],
    )
    expect((await mural(org)).organizacao).toEqual({ pedidosDeEntrada: 1 })
    expect((await mural(ana)).organizacao).toBeNull()
    expect(JSON.stringify(await mural(org))).not.toMatch(/sigilosa|Quer entrar/)
  })

  it('pessoas: só vínculos ativos', async () => {
    const antes = (await mural(ana)).pessoas.total
    await b.su.query(`update uj.vinculos set estado = 'desativado' where id = $1`, [v['carla']])
    expect((await mural(ana)).pessoas.total).toBe(antes - 1)
    await b.su.query(`update uj.vinculos set estado = 'ativo' where id = $1`, [v['carla']])
  })

  it('isolamento: nada de B entra no mural de A, e B só vê o seu', async () => {
    await req('POST', `/api/v1/c/${comB}/avisos`, orgB, {
      titulo: 'Aviso só de B',
      texto: 'Texto de B',
      publicar: true,
    })
    const doA = await mural(org)
    expect(JSON.stringify(doA)).not.toContain('Aviso só de B')
    const doB = await mural(orgB, comB)
    expect(doB.avisos).toMatchObject({ total: 1, destaque: { titulo: 'Aviso só de B' } })
    expect(doB.pessoas.total).toBe(1)
    expect(doB.oracao.novos).toBe(0)
    expect((await req('GET', `/api/v1/c/${comB}/mural`, org)).statusCode).toBe(404)
  })
})

describe('sino com título real', () => {
  let avisoId: string
  let eventoId: string

  it('aviso: assunto real e texto genérico, sem o corpo do aviso', async () => {
    avisoId = await aviso('Ensaio geral às 16h')
    const itens = (await caixa(bruno)).filter((n) => n.tipo === 'avisos')
    const item = itens.find((n) => n.assunto === 'Ensaio geral às 16h')
    expect(item).toBeDefined()
    expect(item).toMatchObject({
      titulo: 'Novo aviso',
      texto: 'Há um aviso novo na sua comunidade. Abra o app para ler.',
      eventoId: null,
    })
    // O texto do aviso nunca chega à caixa.
    expect(JSON.stringify(itens)).not.toMatch(/sigiloso|91234/)
  })

  it('aviso tirado do ar ou vencido: assunto nulo', async () => {
    await req('POST', `/api/v1/c/${comA}/avisos/${avisoId}/despublicar`, org)
    const item = (await caixa(bruno)).find((n) => n.assunto === 'Ensaio geral às 16h')
    expect(item).toBeUndefined()
    const sem = (await caixa(bruno)).filter((n) => n.tipo === 'avisos' && n.assunto === null)
    expect(sem.length).toBeGreaterThan(0)
  })

  it('aviso de quem a pessoa bloqueou: assunto nulo só para ela', async () => {
    const id = await aviso('Aviso do autor bloqueado')
    await b.dono.query('delete from uj.bloqueios where conta_id = $1', [carla.id])
    await b.dono.query(
      `insert into uj.bloqueios (comunidade_id, conta_id, bloqueada_conta_id) values ($1, $2, $3)`,
      [comA, carla.id, org.id],
    )
    expect((await caixa(carla)).some((n) => n.assunto === 'Aviso do autor bloqueado')).toBe(false)
    expect((await caixa(bruno)).some((n) => n.assunto === 'Aviso do autor bloqueado')).toBe(true)
    await b.dono.query('delete from uj.bloqueios where conta_id = $1', [carla.id])
    expect(id).toBeTruthy()
  })

  it('convocação: título do encontro e id do encontro, texto genérico', async () => {
    const r = await req('POST', `/api/v1/c/${comA}/eventos`, org, {
      titulo: 'Sábado Jovem',
      categoria: 'Programação de sábado',
      inicio: new Date(Date.now() + 6 * 86_400_000).toISOString(),
      duracaoMin: 90,
    })
    eventoId = r.json().id
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/atribuicoes`, org, {
      vinculoId: v['ana'],
      funcao: 'Violão',
    })
    // Rascunho: nada na caixa, e o título não aparece.
    expect((await caixa(ana)).some((n) => n.assunto === 'Sábado Jovem')).toBe(false)
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/status`, org, { status: 'publicado' })
    const item = (await caixa(ana)).find((n) => n.titulo === 'Nova convocação')
    expect(item).toMatchObject({
      tipo: 'escalas',
      assunto: 'Sábado Jovem',
      eventoId,
      texto: 'Você foi convocado para servir. Abra o app para responder.',
    })
    expect(item!.texto).not.toMatch(/Sábado|Violão/)
  })

  it('lembrete e cancelamento também trazem o título do encontro', async () => {
    await req('POST', `/api/v1/c/${comA}/eventos/${eventoId}/lembrar-pendentes`, org)
    const lembrete = (await caixa(ana)).find((n) => n.titulo === 'Falta responder')
    expect(lembrete).toMatchObject({ assunto: 'Sábado Jovem', eventoId })
    expect(lembrete!.destino).toMatchObject({ tela: 'evento' })
  })

  it('pedido de entrada: sem assunto (nem nome de quem pede)', async () => {
    const quem = await pessoaComSessao(b, app, config, 'Pessoa Que Pede')
    await b.dono.query(`select uj.avisar_pedido_de_entrada($1, gen_random_uuid())`, [comA])
    const itens = (await caixa(org)).filter((n) => n.tipo === 'pedido_de_entrada')
    expect(itens.length).toBeGreaterThan(0)
    expect(itens.every((n) => n.assunto === null)).toBe(true)
    expect(JSON.stringify(itens)).not.toContain(quem.email)
  })

  it('não lidas: o selo e a quebra por assunto', async () => {
    const r = await req('GET', `${CAIXA}/nao-lidas`, org)
    expect(r.statusCode).toBe(200)
    const o = r.json()
    expect(Object.keys(o).sort()).toEqual(['avisos', 'convocacoes', 'naoLidas', 'pedidosDeEntrada'])
    expect(o.pedidosDeEntrada).toBeGreaterThan(0)
    expect(o.avisos + o.convocacoes + o.pedidosDeEntrada).toBeLessThanOrEqual(o.naoLidas)

    const a = (await req('GET', `${CAIXA}/nao-lidas`, ana)).json()
    expect(a.convocacoes).toBe(2) // Nova convocação e Falta responder
    expect(a.avisos).toBeGreaterThan(0)
    expect(a.pedidosDeEntrada).toBe(0)
    expect(a.naoLidas).toBeGreaterThanOrEqual(a.avisos + a.convocacoes)

    // Marcar como lida baixa a quebra também.
    await req('POST', `${CAIXA}/lidas`, ana)
    expect((await req('GET', `${CAIXA}/nao-lidas`, ana)).json()).toEqual({
      naoLidas: 0,
      avisos: 0,
      convocacoes: 0,
      pedidosDeEntrada: 0,
    })
  })

  it('isolamento: a função não revela assunto de notificação de outra conta nem de outra comunidade', async () => {
    const dele = (
      await b.su.query<{ id: string }>(
        `select id from uj.notificacoes where conta_id = $1 and titulo = 'Nova convocação'`,
        [ana.id],
      )
    ).rows[0]!.id
    const comoOutra = await b.comoApi<{ assunto: string | null; evento_id: string | null }>(
      { contaId: bruno.id, comunidadeId: null },
      'select * from uj.assunto_da_notificacao($1)',
      [dele],
    )
    expect(comoOutra).toEqual([{ assunto: null, evento_id: null }])
    // Quem saiu da comunidade deixa de ver o assunto, mesmo antes do expurgo.
    await b.su.query(`update uj.vinculos set estado = 'desativado' where id = $1`, [v['ana']])
    const aposSair = await b.comoApi<{ assunto: string | null }>(
      { contaId: ana.id, comunidadeId: null },
      'select * from uj.assunto_da_notificacao($1)',
      [dele],
    )
    expect(aposSair).toEqual([{ assunto: null, evento_id: null }])
    await b.su.query(`update uj.vinculos set estado = 'ativo' where id = $1`, [v['ana']])
  })
})
