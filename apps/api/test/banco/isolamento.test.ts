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
  // F7: eventos e programação
  'GET /api/v1/c/:comunidadeId/locais': undefined,
  'POST /api/v1/c/:comunidadeId/locais': { nome: 'Salão', tipo: 'interno' },
  'PATCH /api/v1/c/:comunidadeId/locais/:localId': { nome: 'Tomado' },
  'GET /api/v1/c/:comunidadeId/modelos': undefined,
  'POST /api/v1/c/:comunidadeId/modelos': { nome: 'Modelo', categoria: 'Outra', etapas: [] },
  'DELETE /api/v1/c/:comunidadeId/modelos/:modeloId': undefined,
  'GET /api/v1/c/:comunidadeId/eventos': undefined,
  'POST /api/v1/c/:comunidadeId/eventos': {
    titulo: 'Invasão',
    categoria: 'Outra',
    inicio: '2026-12-01T10:00:00-03:00',
    duracaoMin: 30,
  },
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId': undefined,
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId': { versao: 1, titulo: 'Tomado' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/status': { status: 'publicado' },
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/duplicar': {
    inicio: '2026-12-01T10:00:00-03:00',
  },
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/etapas': { titulo: 'Etapa', duracaoMin: 5 },
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId/etapas/:etapaId': { titulo: 'Tomada' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/etapas/:etapaId': undefined,
  'PUT /api/v1/c/:comunidadeId/eventos/:eventoId/etapas/ordem': {
    ids: ['00000000-0000-4000-8000-000000000000'],
  },
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/atribuicoes': {
    vinculoId: '00000000-0000-4000-8000-000000000000',
  },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/atribuicoes/:atribuicaoId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/tarefas': { titulo: 'Tarefa' },
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId/tarefas/:tarefaId': { titulo: 'Tomada' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/tarefas/:tarefaId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/materiais': { nome: 'Material' },
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId/materiais/:materialId': { nome: 'Tomado' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/materiais/:materialId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/checklist': { tipo: 'preparacao', texto: 'Item' },
  'PATCH /api/v1/c/:comunidadeId/eventos/:eventoId/checklist/:itemId': { texto: 'Tomado' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/checklist/:itemId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/notas': { texto: 'Nota' },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/notas/:notaId': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/anexos': {
    titulo: 'Link',
    url: 'https://exemplo.test/x',
  },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/anexos/:anexoId': undefined,
  // F8: recorrência
  'POST /api/v1/c/:comunidadeId/series': {
    regra: { frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [6] },
    horaLocal: '16:00',
    inicioEm: '2026-12-05',
    titulo: 'Série invasora',
    categoria: 'Outra',
  },
  'GET /api/v1/c/:comunidadeId/series/:serieId': undefined,
  'PATCH /api/v1/c/:comunidadeId/series/:serieId': {
    versao: 1,
    escopo: 'serie',
    mudancas: { titulo: 'Tomada' },
  },
  'POST /api/v1/c/:comunidadeId/series/:serieId/encerrar': {
    aPartirDe: '2026-12-05',
    motivo: 'Invasão',
  },
  // F9: escalas e disponibilidade
  'GET /api/v1/c/:comunidadeId/minhas-escalas': undefined,
  'POST /api/v1/c/:comunidadeId/atribuicoes/:atribuicaoId/confirmar': undefined,
  'POST /api/v1/c/:comunidadeId/atribuicoes/:atribuicaoId/recusar': undefined,
  'POST /api/v1/c/:comunidadeId/atribuicoes/:atribuicaoId/substituicao': { motivo: 'Invasão' },
  'GET /api/v1/c/:comunidadeId/substituicoes': undefined,
  'POST /api/v1/c/:comunidadeId/substituicoes/:substituicaoId/assumir': undefined,
  'POST /api/v1/c/:comunidadeId/substituicoes/:substituicaoId/cancelar': undefined,
  'GET /api/v1/c/:comunidadeId/disponibilidade': undefined,
  'PUT /api/v1/c/:comunidadeId/disponibilidade/:data': { disponivel: true },
  // F10
  'GET /api/v1/c/:comunidadeId/inicio': undefined,
  // F11
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/ao-vivo': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/ao-vivo': { comando: 'assumir', versao: 0 },
  // F12
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/inscricoes': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/inscricoes/eu': undefined,
  'POST /api/v1/c/:comunidadeId/inscricoes/:inscricaoId/cancelar': undefined,
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/checkin': undefined,
  'GET /api/v1/c/:comunidadeId/eventos/:eventoId/presencas': undefined,
  'POST /api/v1/c/:comunidadeId/eventos/:eventoId/presencas': {
    chaveIdempotencia: '00000000-0000-4000-8000-000000000001',
    origem: 'manual',
    nomeAvulso: 'Invasor',
  },
  'DELETE /api/v1/c/:comunidadeId/eventos/:eventoId/presencas/:presencaId': undefined,
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

  // Um exemplar de cada recurso de evento em B (inserido pelo dono do banco).
  const um = async (sql: string, params: unknown[]) =>
    (await b.dono.query<{ id: string }>(sql, params)).rows[0]!.id
  idsDeB['localId'] = await um(
    "insert into uj.locais (comunidade_id, nome, tipo) values ($1, 'Salão de B', 'interno') returning id",
    [comB],
  )
  idsDeB['modeloId'] = await um(
    "insert into uj.modelos (comunidade_id, nome, categoria, criado_por) values ($1, 'Modelo de B', 'Outra', $2) returning id",
    [comB, adminB.id],
  )
  const eventoId = await um(
    `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, status)
     values ($1, 'Evento de B', 'Outra', now(), 60, 'America/Sao_Paulo', $2, 'publicado') returning id`,
    [comB, adminB.id],
  )
  idsDeB['eventoId'] = eventoId
  idsDeB['serieId'] = await um(
    `insert into uj.series (comunidade_id, regra, hora_local, fuso, duracao_min, inicio_em, titulo, categoria, criado_por)
     values ($1, '{"frequencia":"semanal","intervaloSemanas":1,"diasDaSemana":[6]}', '16:00', 'America/Sao_Paulo', 60, current_date, 'Série de B', 'Outra', $2) returning id`,
    [comB, adminB.id],
  )
  idsDeB['etapaId'] = await um(
    "insert into uj.etapas (comunidade_id, evento_id, ordem, titulo, duracao_min) values ($1, $2, 0, 'Louvor', 15) returning id",
    [comB, eventoId],
  )
  idsDeB['atribuicaoId'] = await um(
    'insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id) values ($1, $2, $3) returning id',
    [comB, eventoId, idsDeB['vinculoId']],
  )
  idsDeB['tarefaId'] = await um(
    "insert into uj.tarefas (comunidade_id, evento_id, titulo) values ($1, $2, 'Tarefa de B') returning id",
    [comB, eventoId],
  )
  idsDeB['materialId'] = await um(
    "insert into uj.materiais (comunidade_id, evento_id, nome) values ($1, $2, 'Material de B') returning id",
    [comB, eventoId],
  )
  idsDeB['itemId'] = await um(
    "insert into uj.checklist_itens (comunidade_id, evento_id, tipo, texto) values ($1, $2, 'preparacao', 'Item de B') returning id",
    [comB, eventoId],
  )
  idsDeB['notaId'] = await um(
    "insert into uj.notas_internas (comunidade_id, evento_id, texto, autor_conta_id) values ($1, $2, 'Nota de B', $3) returning id",
    [comB, eventoId, adminB.id],
  )
  idsDeB['substituicaoId'] = await um(
    'insert into uj.substituicoes (comunidade_id, atribuicao_id, pedida_por) values ($1, $2, $3) returning id',
    [comB, idsDeB['atribuicaoId'], idsDeB['vinculoId']],
  )
  idsDeB['data'] = '2026-12-05'
  idsDeB['inscricaoId'] = await um(
    "insert into uj.inscricoes (comunidade_id, evento_id, origem, nome, telefone, estado, consentimento_em) values ($1, $2, 'publica', 'Pessoa de B', '+5511900000000', 'confirmada', now()) returning id",
    [comB, eventoId],
  )
  idsDeB['presencaId'] = await um(
    "insert into uj.presencas (comunidade_id, evento_id, inscricao_id, origem, registrada_por, chave_idempotencia) values ($1, $2, $3, 'manual', $4, gen_random_uuid()) returning id",
    [comB, eventoId, idsDeB['inscricaoId'], idsDeB['vinculoId']],
  )
  idsDeB['anexoId'] = await um(
    "insert into uj.anexos (comunidade_id, evento_id, titulo, url, criado_por) values ($1, $2, 'Link de B', 'https://exemplo.test/b', $3) returning id",
    [comB, eventoId, adminB.id],
  )
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

/** Retrato de tudo que é de B: qualquer escrita indevida muda este retrato. */
async function estadoDeB() {
  const { rows } = await b.su.query(
    `select (select json_agg(row(papel, estado) order by id) from uj.vinculos where comunidade_id = $1) as v,
            (select json_agg(row(revogado_em) order by id) from uj.convites where comunidade_id = $1) as c,
            (select nome from uj.comunidades where id = $1) as nome,
            (select json_agg(row(nome, arquivado) order by id) from uj.locais where comunidade_id = $1) as l,
            (select count(*) from uj.modelos where comunidade_id = $1) as m,
            (select json_agg(row(titulo, status, versao) order by id) from uj.eventos where comunidade_id = $1) as e,
            (select json_agg(row(titulo, ordem) order by id) from uj.etapas where comunidade_id = $1) as et,
            (select count(*) from uj.atribuicoes where comunidade_id = $1) as a,
            (select json_agg(row(titulo, concluida_em) order by id) from uj.tarefas where comunidade_id = $1) as t,
            (select json_agg(row(nome) order by id) from uj.materiais where comunidade_id = $1) as ma,
            (select json_agg(row(texto, marcado_em) order by id) from uj.checklist_itens where comunidade_id = $1) as ck,
            (select count(*) from uj.notas_internas where comunidade_id = $1) as n,
            (select count(*) from uj.anexos where comunidade_id = $1) as an,
            (select json_agg(row(titulo, fim_em, versao) order by id) from uj.series where comunidade_id = $1) as s,
            (select json_agg(row(estado, assumida_por) order by id) from uj.substituicoes where comunidade_id = $1) as sb,
            (select json_agg(row(estado, vinculo_id) order by id) from uj.atribuicoes where comunidade_id = $1) as at,
            (select count(*) from uj.disponibilidades where comunidade_id = $1) as d,
            (select json_agg(row(estado) order by id) from uj.inscricoes where comunidade_id = $1) as i,
            (select count(*) from uj.presencas where comunidade_id = $1) as p`,
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
    // `:data` (disponibilidade) não é id de recurso: fica fora deste ataque.
    const comRecurso = rotasDeComunidade().filter((r) => /:(?!comunidadeId|data\b)\w+/.test(r.url))
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
