import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * "Aguardando resposta" (D57): a aba Escalas mostra à organização os
 * encontros publicados que ainda não acabaram e têm convocação sem resposta
 * ou recusada. Só contagens, só da comunidade do caminho, só para quem
 * convoca.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let orgA: Pessoa
let ana: Pessoa
let orgB: Pessoa
/** Membro em A e organizadora em B: em A não convoca, em B só vê B. */
let dupla: Pessoa
const v: Record<string, string> = {}

const CAMINHO = '/convocacoes/aguardando-resposta'

type Metodo = 'GET' | 'POST'
const req = (metodo: Metodo, com: string, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

let dias = 3
async function novoEvento(com: string, org: Pessoa, titulo: string, publicar = true) {
  const inicio = new Date(Date.now() + dias++ * 86_400_000).toISOString()
  const r = await req('POST', com, '/eventos', org, {
    titulo,
    categoria: 'Programação de sábado',
    inicio,
    duracaoMin: 120,
  })
  expect(r.statusCode).toBe(200)
  const eventoId = r.json().id as string
  if (publicar) {
    const p = await req('POST', com, `/eventos/${eventoId}/status`, org, { status: 'publicado' })
    expect(p.statusCode).toBe(200)
  }
  return eventoId
}

async function convocar(com: string, org: Pessoa, eventoId: string, vinculoId: string) {
  const r = await req('POST', com, `/eventos/${eventoId}/atribuicoes`, org, { vinculoId })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
}

interface Linha {
  id: string
  titulo: string
  pendentes: number
  recusadas: number
}

async function aguardando(com: string, p: Pessoa): Promise<Linha[]> {
  const r = await req('GET', com, CAMINHO, p)
  expect(r.statusCode).toBe(200)
  return r.json().encontros as Linha[]
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
  orgA = await pessoaComSessao(b, app, config, 'Olga')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  orgB = await pessoaComSessao(b, app, config, 'Otto')
  dupla = await pessoaComSessao(b, app, config, 'Duda')
  await vincular(b, orgA.id, comA, 'organizador')
  v['ana'] = await vincular(b, ana.id, comA, 'membro')
  v['duplaA'] = await vincular(b, dupla.id, comA, 'membro')
  await vincular(b, orgB.id, comB, 'organizador')
  v['duplaB'] = await vincular(b, dupla.id, comB, 'organizador')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('aguardando resposta', () => {
  it('conta pendentes e recusadas por encontro publicado; aceito e rascunho ficam de fora', async () => {
    const sabado = await novoEvento(comA, orgA, 'Sábado com a juventude')
    await convocar(comA, orgA, sabado, v['ana']!)
    const recusa = await convocar(comA, orgA, sabado, v['duplaA']!)
    expect((await req('POST', comA, `/atribuicoes/${recusa}/recusar`, dupla)).statusCode).toBe(200)

    const tudoCerto = await novoEvento(comA, orgA, 'Luau')
    const aceita = await convocar(comA, orgA, tudoCerto, v['ana']!)
    expect((await req('POST', comA, `/atribuicoes/${aceita}/confirmar`, ana)).statusCode).toBe(200)

    const rascunho = await novoEvento(comA, orgA, 'Rascunho', false)
    await convocar(comA, orgA, rascunho, v['ana']!)

    expect(await aguardando(comA, orgA)).toEqual([
      expect.objectContaining({
        id: sabado,
        titulo: 'Sábado com a juventude',
        pendentes: 1,
        recusadas: 1,
      }),
    ])
  })

  it('membro não vê (403): quem não convoca não acompanha as respostas', async () => {
    expect((await req('GET', comA, CAMINHO, ana)).statusCode).toBe(403)
    // A dupla é organizadora em B, mas em A é membro: o papel vem do vínculo de A.
    expect((await req('GET', comA, CAMINHO, dupla)).statusCode).toBe(403)
  })

  it('isolamento: cada comunidade só vê os próprios encontros; o id de B no caminho dá 404', async () => {
    const deB = await novoEvento(comB, orgB, 'Encontro da Serra')
    await convocar(comB, orgB, deB, v['duplaB']!)

    const deA = await aguardando(comA, orgA)
    expect(deA.some((e) => e.id === deB)).toBe(false)
    expect(JSON.stringify(deA)).not.toContain('Serra')

    const vistosEmB = await aguardando(comB, dupla)
    expect(vistosEmB.map((e) => e.id)).toEqual([deB])

    expect((await req('GET', comB, CAMINHO, orgA)).statusCode).toBe(404)
  })
})
