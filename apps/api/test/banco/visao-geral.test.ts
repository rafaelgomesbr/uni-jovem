import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import {
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Visão geral do Início (D59): `GET /visao-geral`. A parte "minha" é de todo
 * membro e só conta o que é da própria pessoa; a parte "comunidade" é da
 * organização (membro recebe 403) e só traz contagens e identificadores de
 * encontro. Nada vaza entre comunidades, e texto de oração nunca sai daqui.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let admin: Pessoa
let org: Pessoa
let ana: Pessoa
let beto: Pessoa
let orgB: Pessoa
/** Membro em A e organizadora em B. */
let dupla: Pessoa
const v: Record<string, string> = {}
const e: Record<string, string> = {}

const TEXTO_DA_ORACAO = 'Peço oração pela prova de sexta-feira'

const req = (com: string, p: Pessoa, escopo?: string) =>
  app.inject({
    method: 'GET',
    url: `/api/v1/c/${com}/visao-geral${escopo ? `?escopo=${escopo}` : ''}`,
    headers: p.auth,
  })

async function evento(
  com: string,
  criadoPor: string,
  titulo: string,
  inicio: string,
  status = 'publicado',
): Promise<string> {
  const { rows } = await b.dono.query<{ id: string }>(
    `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
     values ($1, $2, 'Outra', ${inicio}, 60, 'America/Sao_Paulo', $3, $4) returning id`,
    [com, titulo, criadoPor, status],
  )
  return rows[0]!.id
}

async function convocar(com: string, eventoId: string, vinculoId: string, estado: string) {
  await b.dono.query(
    'insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id, estado) values ($1, $2, $3, $4)',
    [com, eventoId, vinculoId, estado],
  )
}

async function presenca(com: string, eventoId: string, vinculoId: string, registrou: string) {
  await b.dono.query(
    `insert into uj.presencas (comunidade_id, evento_id, vinculo_id, origem, registrada_por, chave_idempotencia)
     values ($1, $2, $3, 'manual', $4, gen_random_uuid())`,
    [com, eventoId, vinculoId, registrou],
  )
}

async function tarefa(
  com: string,
  eventoId: string,
  vinculoId: string,
  prazo: string,
  concluida = false,
) {
  await b.dono.query(
    `insert into uj.tarefas (comunidade_id, evento_id, titulo, responsavel_vinculo_id, prazo, concluida_em)
     values ($1, $2, 'Levar o som', $3, ${prazo}, ${concluida ? 'now()' : 'null'})`,
    [com, eventoId, vinculoId],
  )
}

async function pedirOracao(p: Pessoa): Promise<string> {
  const r = await app.inject({
    method: 'POST',
    url: `/api/v1/c/${comA}/oracao`,
    headers: p.auth,
    payload: { texto: TEXTO_DA_ORACAO, visibilidade: 'somente_eu' },
  })
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
  admin = await pessoaComSessao(b, app, config, 'Adão')
  org = await pessoaComSessao(b, app, config, 'Olga')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  beto = await pessoaComSessao(b, app, config, 'Beto')
  orgB = await pessoaComSessao(b, app, config, 'Otto')
  dupla = await pessoaComSessao(b, app, config, 'Duda')
  v['admin'] = await vincular(b, admin.id, comA, 'admin')
  v['org'] = await vincular(b, org.id, comA, 'organizador')
  v['ana'] = await vincular(b, ana.id, comA, 'membro')
  v['beto'] = await vincular(b, beto.id, comA, 'membro')
  v['duplaA'] = await vincular(b, dupla.id, comA, 'membro')
  v['orgB'] = await vincular(b, orgB.id, comB, 'organizador')
  v['duplaB'] = await vincular(b, dupla.id, comB, 'organizador')

  // A: dois encontros nos próximos 14 dias, um mais longe e um rascunho.
  e['sabado'] = await evento(comA, org.id, 'Sábado com a juventude', "now() + interval '3 days'")
  e['retiro'] = await evento(comA, org.id, 'Retiro', "now() + interval '20 days'")
  e['luau'] = await evento(comA, org.id, 'Luau', "now() + interval '5 days'")
  e['rascunho'] = await evento(comA, org.id, 'Rascunho', "now() + interval '6 days'", 'rascunho')
  await convocar(comA, e['sabado']!, v['ana']!, 'pendente')
  await convocar(comA, e['sabado']!, v['beto']!, 'recusada')
  await convocar(comA, e['sabado']!, v['org']!, 'confirmada')
  await convocar(comA, e['retiro']!, v['ana']!, 'pendente')
  await convocar(comA, e['luau']!, v['ana']!, 'confirmada')
  await convocar(comA, e['rascunho']!, v['beto']!, 'pendente')
  await b.dono.query(
    `insert into uj.inscricoes (comunidade_id, evento_id, origem, vinculo_id, nome, estado)
     values ($1, $2, 'membro', $3, 'Ana', 'confirmada')`,
    [comA, e['luau'], v['ana']],
  )

  // A: três encontros que já aconteceram (um com 2 presenças, um com 1 e um sem nenhuma).
  e['p1'] = await evento(comA, org.id, 'Passado 1', "now() - interval '3 days'")
  e['p2'] = await evento(comA, org.id, 'Passado 2', "now() - interval '10 days'")
  e['p3'] = await evento(comA, org.id, 'Passado 3', "now() - interval '17 days'")
  await presenca(comA, e['p1']!, v['ana']!, v['org']!)
  await presenca(comA, e['p1']!, v['beto']!, v['org']!)
  await presenca(comA, e['p2']!, v['ana']!, v['org']!)

  // A: tarefas (duas atrasadas e abertas, uma sem prazo, uma concluída).
  await tarefa(comA, e['sabado']!, v['ana']!, "now() - interval '1 day'")
  await tarefa(comA, e['sabado']!, v['ana']!, 'null')
  await tarefa(comA, e['sabado']!, v['ana']!, "now() - interval '2 days'", true)
  await tarefa(comA, e['sabado']!, v['beto']!, "now() - interval '2 days'")

  // A: um pedido de entrada pendente e uma denúncia aberta.
  const candidata = await criarConta(b, 'Candidata')
  await b.dono.query(
    `insert into uj.pedidos_de_entrada (comunidade_id, conta_id, origem, consentimento_versao, consentimento_forma)
     values ($1, $2, 'busca', 1, 'web')`,
    [comA, candidata],
  )
  await b.dono.query(
    `insert into uj.denuncias (comunidade_id, recurso_tipo, recurso_id, denunciante_conta_id, motivo)
     values ($1, 'aviso', gen_random_uuid(), $2, 'spam')`,
    [comA, ana.id],
  )

  // A: Ana tem dois pedidos de oração (um já respondido); Beto tem um.
  await pedirOracao(ana)
  const respondido = await pedirOracao(ana)
  const r = await app.inject({
    method: 'POST',
    url: `/api/v1/c/${comA}/oracao/${respondido}/respondido`,
    headers: ana.auth,
    payload: { respondido: true },
  })
  expect(r.statusCode).toBe(200)
  await pedirOracao(beto)

  // B: um encontro com uma convocação sem resposta, outra pessoa e uma tarefa atrasada.
  e['serra'] = await evento(comB, orgB.id, 'Encontro da Serra', "now() + interval '2 days'")
  await convocar(comB, e['serra']!, v['duplaB']!, 'pendente')
  await tarefa(comB, e['serra']!, v['duplaB']!, "now() - interval '1 day'")
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('visão geral: a minha (todo membro)', () => {
  it('conta só o que é da pessoa: convocações, tarefas, inscrições, presença e orações', async () => {
    const r = await req(comA, ana, 'minha')
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      escopo: 'minha',
      convocacoesParaResponder: 2,
      convocacoesProximas: 1,
      tarefasAbertas: 2,
      inscricoes: 1,
      presenca30dias: { presentes: 2, encontros: 3 },
      oracoesAtivas: 1,
    })
  })

  it('sem o parâmetro, o escopo é "minha"; recusada, rascunho e tarefa alheia não entram', async () => {
    const r = await req(comA, beto)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      escopo: 'minha',
      // Recusou o Sábado; a convocação do rascunho nem aparece para membro.
      convocacoesParaResponder: 0,
      convocacoesProximas: 0,
      tarefasAbertas: 1,
      inscricoes: 0,
      presenca30dias: { presentes: 1, encontros: 3 },
      oracoesAtivas: 1,
    })
  })

  it('texto de oração nunca sai: só a contagem', async () => {
    const r = await req(comA, ana, 'minha')
    expect(r.body).not.toContain(TEXTO_DA_ORACAO)
    expect(r.body).not.toContain('prova de sexta')
  })

  it('escopo inválido é recusado com 400', async () => {
    expect((await req(comA, ana, 'todos')).statusCode).toBe(400)
  })
})

describe('visão geral: a da comunidade (organização)', () => {
  it('organizadora recebe os números da comunidade; denúncias vêm nulas', async () => {
    const r = await req(comA, org, 'comunidade')
    expect(r.statusCode).toBe(200)
    const corpo = r.json()
    expect(corpo).toMatchObject({
      escopo: 'comunidade',
      pessoasAtivas: 5,
      // Sábado e Retiro: a Ana ainda não respondeu aos dois; o Beto recusou o Sábado.
      convocacoes: { semResposta: 2, recusadas: 1 },
      pedidosDeEntrada: 1,
      denunciasAbertas: null,
      // Passado 1 (2), Passado 2 (1) e Passado 3 (0): 3 presenças em 3 encontros.
      presencaMedia: { encontros: 3, media: 1 },
      tarefasAtrasadas: 2,
    })
    // Só os encontros dos próximos 14 dias, em ordem, com a situação das convocações.
    expect(corpo.proximosEncontros).toEqual([
      expect.objectContaining({
        id: e['sabado'],
        titulo: 'Sábado com a juventude',
        convocados: 3,
        semResposta: 1,
        recusadas: 1,
      }),
      expect.objectContaining({
        id: e['luau'],
        titulo: 'Luau',
        convocados: 1,
        semResposta: 0,
        recusadas: 0,
      }),
    ])
  })

  it('a administradora também vê as denúncias abertas', async () => {
    const r = await req(comA, admin, 'comunidade')
    expect(r.statusCode).toBe(200)
    expect(r.json().denunciasAbertas).toBe(1)
  })

  it('só contagens e identificadores: nenhum nome, contato ou texto de pessoa', async () => {
    const r = await req(comA, admin, 'comunidade')
    for (const proibido of ['Ana', 'Beto', 'Olga', '@exemplo.test', TEXTO_DA_ORACAO, 'Candidata']) {
      expect(r.body).not.toContain(proibido)
    }
  })

  it('membro recebe 403 na parte da comunidade (a dupla é organizadora só em B)', async () => {
    expect((await req(comA, ana, 'comunidade')).statusCode).toBe(403)
    expect((await req(comA, dupla, 'comunidade')).statusCode).toBe(403)
    // E continua podendo ver a própria.
    expect((await req(comA, dupla, 'minha')).statusCode).toBe(200)
  })
})

describe('visão geral: isolamento entre comunidades', () => {
  it('cada comunidade só enxerga o que é dela', async () => {
    const deB = (await req(comB, orgB, 'comunidade')).json()
    expect(deB).toMatchObject({
      pessoasAtivas: 2,
      convocacoes: { semResposta: 1, recusadas: 0 },
      pedidosDeEntrada: 0,
      tarefasAtrasadas: 1,
      presencaMedia: { encontros: 0, media: null },
    })
    expect(deB.proximosEncontros.map((x: { id: string }) => x.id)).toEqual([e['serra']])

    const deA = (await req(comA, org, 'comunidade')).json()
    expect(JSON.stringify(deA)).not.toContain(e['serra']!)
    expect(JSON.stringify(deA)).not.toContain('Serra')
  })

  it('a dupla vê em B só o que é de B, e a parte "minha" não mistura comunidades', async () => {
    const emB = (await req(comB, dupla, 'minha')).json()
    expect(emB).toMatchObject({
      convocacoesParaResponder: 1,
      tarefasAbertas: 1,
      oracoesAtivas: 0,
    })
    const emA = (await req(comA, dupla, 'minha')).json()
    expect(emA).toMatchObject({ convocacoesParaResponder: 0, tarefasAbertas: 0 })
  })

  it('quem não é de B recebe 404 com o id de B no caminho, nos dois escopos', async () => {
    expect((await req(comB, org, 'comunidade')).statusCode).toBe(404)
    expect((await req(comB, ana, 'minha')).statusCode).toBe(404)
    expect((await req(comB, ana)).statusCode).toBe(404)
  })
})
