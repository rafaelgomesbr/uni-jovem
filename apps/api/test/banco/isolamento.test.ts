import type { InjectOptions } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gerarToken, hmacDeToken } from '../../src/autenticacao/cripto.ts'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * SUÍTE DE ISOLAMENTO ENTRE COMUNIDADES (ADR 0002, item 6).
 *
 * Gerada do inventário de rotas do servidor: toda rota de comunidade precisa
 * ter um caso em CASOS, ou o teste "inventário" reprova. Para cada rota, a
 * administradora da comunidade A tenta:
 *   1. a rota com o id da comunidade B no caminho;
 *   2. a rota com o id de A no caminho e o id de um recurso de B;
 * e o esperado é 404 sempre, com os dados de B intactos no fim.
 */

const config = carregarConfig(envDeTeste())

/** Corpo válido por rota, para que a validação não responda antes da checagem de acesso. */
const CASOS: Record<string, Record<string, unknown> | undefined> = {
  'GET /api/v1/c/:comunidadeId': undefined,
  'PATCH /api/v1/c/:comunidadeId': { nome: 'Tomada' },
  'GET /api/v1/c/:comunidadeId/membros': undefined,
  'PATCH /api/v1/c/:comunidadeId/membros/:vinculoId': { papel: 'membro' },
  'POST /api/v1/c/:comunidadeId/sair': undefined,
  'GET /api/v1/c/:comunidadeId/convites': undefined,
  'POST /api/v1/c/:comunidadeId/convites': { papel: 'admin' },
  'POST /api/v1/c/:comunidadeId/convites/:conviteId/revogar': undefined,
  'GET /api/v1/c/:comunidadeId/auditoria': undefined,
}

interface Rota {
  metodo: string
  url: string
}

let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let adminA: Pessoa
let adminB: Pessoa
let comA: string
let comB: string
const idsDeB: Record<string, string> = {}

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  comA = await criarComunidade(b, 'Comunidade A')
  comB = await criarComunidade(b, 'Comunidade B')
  adminA = await pessoaComSessao(b, app, config, 'Admin A')
  adminB = await pessoaComSessao(b, app, config, 'Admin B')
  await vincular(b, adminA.id, comA, 'admin')
  idsDeB['vinculoId'] = await vincular(b, adminB.id, comB, 'admin')
  const { rows } = await b.su.query<{ id: string }>(
    `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
     values ($1, 'membro', $2, now() + interval '7 days', $3) returning id`,
    [comB, hmacDeToken(gerarToken(), config.CONVITE_SEGREDO), adminB.id],
  )
  idsDeB['conviteId'] = rows[0]!.id
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

function rotasDeComunidade(): Rota[] {
  return app.rotas().filter((r) => r.url.startsWith('/api/v1/c/:comunidadeId'))
}

function montar(url: string, comunidade: string, recursos: Record<string, string>): string {
  return url
    .replace(':comunidadeId', comunidade)
    .replace(/:(\w+)/g, (_, nome: string) => recursos[nome] ?? `faltou-${nome}`)
}

function pedir(r: Rota, comunidade: string, quem: Pessoa | null, corpo?: Record<string, unknown>) {
  const opcoes: InjectOptions = {
    method: r.metodo as 'GET',
    url: montar(r.url, comunidade, idsDeB),
  }
  if (quem) opcoes.headers = quem.auth
  const payload = corpo ?? CASOS[`${r.metodo} ${r.url}`]
  if (payload) opcoes.payload = payload
  return app.inject(opcoes)
}

async function estadoDeB() {
  const { rows } = await b.su.query(
    `select (select json_agg(row(papel, estado) order by id) from uj.vinculos where comunidade_id = $1) as v,
            (select json_agg(row(revogado_em) order by id) from uj.convites where comunidade_id = $1) as c,
            (select nome from uj.comunidades where id = $1) as nome`,
    [comB],
  )
  return rows[0]
}

describe('isolamento entre comunidades', () => {
  it('inventário: toda rota de comunidade tem caso de isolamento', () => {
    const semCaso = rotasDeComunidade()
      .map((r) => `${r.metodo} ${r.url}`)
      .filter((chave) => !(chave in CASOS))
    expect(semCaso).toEqual([])
    expect(rotasDeComunidade().length).toBe(Object.keys(CASOS).length)
  })

  it('A não alcança nada de B pelo caminho, em nenhuma rota (404)', async () => {
    const antes = await estadoDeB()
    for (const r of rotasDeComunidade()) {
      const resposta = await pedir(r, comB, adminA)
      expect(resposta.statusCode, `${r.metodo} ${r.url}`).toBe(404)
    }
    expect(await estadoDeB()).toEqual(antes)
  })

  it('A não alcança recurso de B trocando só o id do recurso (404)', async () => {
    const antes = await estadoDeB()
    const comRecurso = rotasDeComunidade().filter((r) => /:(?!comunidadeId)\w+/.test(r.url))
    expect(comRecurso.length).toBeGreaterThan(0)
    for (const r of comRecurso) {
      const resposta = await pedir(r, comA, adminA)
      expect(resposta.statusCode, `${r.metodo} ${r.url}`).toBe(404)
    }
    expect(await estadoDeB()).toEqual(antes)
  })

  it('ids inválidos ou inexistentes dão 404, sem erro interno', async () => {
    for (const id of ['nao-e-uuid', '00000000-0000-0000-0000-000000000000', "1' or '1'='1"]) {
      const r = await app.inject({
        method: 'GET',
        url: `/api/v1/c/${encodeURIComponent(id)}/membros`,
        headers: adminA.auth,
      })
      expect(r.statusCode).toBe(404)
    }
  })

  it('rotas de plataforma recusam quem não é Criador com 2FA (403)', async () => {
    const plataforma = app.rotas().filter((r) => r.url.startsWith('/api/v1/plataforma'))
    expect(plataforma.length).toBeGreaterThan(0)
    for (const r of plataforma) {
      const resposta = await pedir(r, comB, adminA, {})
      expect(resposta.statusCode, `${r.metodo} ${r.url}`).toBe(403)
    }
  })

  it('sem sessão, toda rota /api/v1 responde 401', async () => {
    for (const r of app.rotas().filter((x) => x.url.startsWith('/api/v1/'))) {
      const resposta = await pedir(r, comA, null)
      expect(resposta.statusCode, `${r.metodo} ${r.url}`).toBe(401)
    }
  })
})
