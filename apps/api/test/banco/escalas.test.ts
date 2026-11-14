import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let org: Pessoa
let ana: Pessoa
let bia: Pessoa
let caio: Pessoa
const v: Record<string, string> = {}

type Metodo = 'GET' | 'POST' | 'PUT'
const req = (metodo: Metodo, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  com = await criarComunidade(b, 'Jovens Central')
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bia = await pessoaComSessao(b, app, config, 'Bia')
  caio = await pessoaComSessao(b, app, config, 'Caio')
  await vincular(b, org.id, com, 'organizador')
  v['ana'] = await vincular(b, ana.id, com, 'membro')
  v['bia'] = await vincular(b, bia.id, com, 'membro')
  v['caio'] = await vincular(b, caio.id, com, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

async function escalaDaAna(): Promise<{ eventoId: string; atribuicaoId: string }> {
  const amanha = new Date(Date.now() + 2 * 86_400_000).toISOString()
  const eventoId = (
    await req('POST', '/eventos', org, {
      titulo: 'Sábado',
      categoria: 'Programação de sábado',
      inicio: amanha,
      modelo: 'sabado_padrao',
    })
  ).json().id
  await req('POST', `/eventos/${eventoId}/status`, org, { status: 'publicado' })
  const etapa = (await req('GET', `/eventos/${eventoId}`, org)).json().etapas[1].id
  const atribuicaoId = (
    await req('POST', `/eventos/${eventoId}/atribuicoes`, org, {
      vinculoId: v['ana'],
      etapaId: etapa,
      funcao: 'violão',
    })
  ).json().id
  return { eventoId, atribuicaoId }
}

describe('escalas', () => {
  it('a pessoa vê a própria escala e confirma; outra pessoa não consegue', async () => {
    const { atribuicaoId } = await escalaDaAna()
    const minhas = (await req('GET', '/minhas-escalas', ana)).json().escalas
    expect(minhas[0]).toMatchObject({
      id: atribuicaoId,
      funcao: 'violão',
      estado: 'pendente',
      etapaTitulo: 'Louvor',
    })
    expect((await req('POST', `/atribuicoes/${atribuicaoId}/confirmar`, bia)).statusCode).toBe(404)
    const ok = await req('POST', `/atribuicoes/${atribuicaoId}/confirmar`, ana)
    expect(ok.json()).toEqual({ estado: 'confirmada' })
  })

  it('substituição aberta: outra pessoa assume, e o registro diz quem substituiu quem', async () => {
    const { atribuicaoId } = await escalaDaAna()
    const pedido = await req('POST', `/atribuicoes/${atribuicaoId}/substituicao`, ana, {
      motivo: 'Viagem',
    })
    const substituicaoId = pedido.json().substituicaoId
    const listaDaBia = (await req('GET', '/substituicoes', bia)).json().substituicoes
    expect(listaDaBia.find((s: { id: string }) => s.id === substituicaoId)).toMatchObject({
      pedidaPor: 'Ana',
      possoAssumir: true,
      motivo: 'Viagem',
    })
    // Não dá para responder enquanto a substituição está aberta.
    expect((await req('POST', `/atribuicoes/${atribuicaoId}/confirmar`, ana)).statusCode).toBe(409)
    expect((await req('POST', `/substituicoes/${substituicaoId}/assumir`, ana)).statusCode).toBe(
      409,
    )
    expect((await req('POST', `/substituicoes/${substituicaoId}/assumir`, bia)).statusCode).toBe(
      200,
    )
    const { rows } = await b.su.query(
      'select vinculo_id, estado from uj.atribuicoes where id = $1',
      [atribuicaoId],
    )
    expect(rows).toEqual([{ vinculo_id: v['bia'], estado: 'confirmada' }])
    const aud = await b.su.query(
      "select detalhes from uj.auditoria where acao = 'escala.substituicao_assumida' order by id desc limit 1",
    )
    expect(aud.rows[0].detalhes).toEqual({ de: v['ana'], para: v['bia'] })
    // Ninguém assume duas vezes.
    expect((await req('POST', `/substituicoes/${substituicaoId}/assumir`, caio)).statusCode).toBe(
      409,
    )
  })

  it('substituição dirigida: só a pessoa indicada assume', async () => {
    const { atribuicaoId } = await escalaDaAna()
    const id = (
      await req('POST', `/atribuicoes/${atribuicaoId}/substituicao`, ana, {
        paraVinculoId: v['caio'],
      })
    ).json().substituicaoId
    expect((await req('POST', `/substituicoes/${id}/assumir`, bia)).statusCode).toBe(409)
    expect((await req('POST', `/substituicoes/${id}/assumir`, caio)).statusCode).toBe(200)
  })

  it('cancelar o pedido volta a escala para pendente', async () => {
    const { atribuicaoId } = await escalaDaAna()
    const id = (await req('POST', `/atribuicoes/${atribuicaoId}/substituicao`, ana, {})).json()
      .substituicaoId
    expect((await req('POST', `/substituicoes/${id}/cancelar`, bia)).statusCode).toBe(409)
    expect((await req('POST', `/substituicoes/${id}/cancelar`, ana)).statusCode).toBe(200)
    const { rows } = await b.su.query('select estado from uj.atribuicoes where id = $1', [
      atribuicaoId,
    ])
    expect(rows).toEqual([{ estado: 'pendente' }])
  })
})

describe('início', () => {
  it('mostra próximos eventos, escalas e tarefas da pessoa e substituições que ela pode assumir', async () => {
    const { eventoId, atribuicaoId } = await escalaDaAna()
    await req('POST', `/eventos/${eventoId}/tarefas`, org, {
      titulo: 'Levar cabo P10',
      responsavelVinculoId: v['ana'],
    })
    await req('POST', `/atribuicoes/${atribuicaoId}/substituicao`, ana, {})
    const daAna = (await req('GET', '/inicio', ana)).json()
    expect(daAna.proximosEventos.length).toBeGreaterThan(0)
    expect(daAna.minhasEscalas.some((e: { id: string }) => e.id === atribuicaoId)).toBe(true)
    expect(daAna.minhasTarefas.some((t: { titulo: string }) => t.titulo === 'Levar cabo P10')).toBe(
      true,
    )
    // O próprio pedido não conta para a Ana; conta para a Bia.
    const daBia = (await req('GET', '/inicio', bia)).json()
    // (Os pedidos dos testes anteriores já foram assumidos ou cancelados.)
    expect(daAna.substituicoesAbertas).toBe(0)
    expect(daBia.substituicoesAbertas).toBe(1)
    expect(daBia.minhasTarefas).toEqual([])
  })
})

describe('disponibilidade', () => {
  it('cada um informa a sua; membro vê só a sua, organizador vê a de todos', async () => {
    expect(
      (
        await req('PUT', '/disponibilidade/2026-12-05', ana, {
          disponivel: false,
          observacao: 'Viagem',
        })
      ).statusCode,
    ).toBe(200)
    await req('PUT', '/disponibilidade/2026-12-05', bia, { disponivel: true })
    // Atualizar a mesma data não duplica.
    await req('PUT', '/disponibilidade/2026-12-05', ana, { disponivel: true })
    const daAna = (await req('GET', '/disponibilidade?de=2026-12-01&ate=2026-12-31', ana)).json()
      .disponibilidade
    expect(daAna).toEqual([
      expect.objectContaining({ data: '2026-12-05', disponivel: true, nome: 'Ana' }),
    ])
    const doOrg = (await req('GET', '/disponibilidade?de=2026-12-01&ate=2026-12-31', org)).json()
      .disponibilidade
    expect(doOrg).toHaveLength(2)
  })

  it('data inválida é recusada', async () => {
    expect(
      (await req('PUT', '/disponibilidade/2026-02-30', ana, { disponivel: true })).statusCode,
    ).toBe(400)
  })
})
