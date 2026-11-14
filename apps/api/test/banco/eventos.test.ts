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
let outra: string
let org: Pessoa
let membro: Pessoa
let outroMembro: Pessoa
let vinculoDoMembro: string
let vinculoDoOutro: string
let vinculoDeOutraComunidade: string

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
const req = (metodo: Metodo, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

const SABADO = '2026-11-21T16:00:00-03:00'

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
  outra = await criarComunidade(b, 'Outra')
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  membro = await pessoaComSessao(b, app, config, 'Membro')
  outroMembro = await pessoaComSessao(b, app, config, 'Outro membro')
  await vincular(b, org.id, com, 'organizador')
  vinculoDoMembro = await vincular(b, membro.id, com, 'membro')
  vinculoDoOutro = await vincular(b, outroMembro.id, com, 'membro')
  vinculoDeOutraComunidade = await vincular(b, outroMembro.id, outra, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

async function eventoDoSabado(): Promise<string> {
  const r = await req('POST', '/eventos', org, {
    titulo: 'Programação de sábado',
    categoria: 'Programação de sábado',
    inicio: SABADO,
    modelo: 'sabado_padrao',
  })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
}

describe('eventos', () => {
  it('criar pelo modelo Sábado padrão: 7 etapas em sequência, 60 min, checklist', async () => {
    const id = await eventoDoSabado()
    const d = (await req('GET', `/eventos/${id}`, org)).json()
    expect(d.status).toBe('rascunho')
    expect(d.duracaoMin).toBe(60)
    expect(d.fuso).toBe('America/Sao_Paulo')
    expect(d.etapas.map((e: { titulo: string }) => e.titulo)).toHaveLength(7)
    expect(d.etapas[0].inicioPrevisto).toBe('2026-11-21T19:00:00.000Z')
    expect(d.etapas[1].inicioPrevisto).toBe('2026-11-21T19:05:00.000Z')
    expect(d.etapas.at(-1).fimPrevisto).toBe('2026-11-21T20:00:00.000Z')
    expect(d.checklist.length).toBe(7)
  })

  it('rascunho é invisível para membro; publicado aparece', async () => {
    const id = await eventoDoSabado()
    expect((await req('GET', `/eventos/${id}`, membro)).statusCode).toBe(404)
    const lista = (await req('GET', '/eventos', membro)).json().eventos as { id: string }[]
    expect(lista.some((e) => e.id === id)).toBe(false)
    expect(
      (await req('POST', `/eventos/${id}/status`, org, { status: 'publicado' })).statusCode,
    ).toBe(200)
    expect((await req('GET', `/eventos/${id}`, membro)).statusCode).toBe(200)
  })

  it('transições inválidas e cancelamento sem motivo são recusados', async () => {
    const id = await eventoDoSabado()
    expect(
      (await req('POST', `/eventos/${id}/status`, org, { status: 'cancelado' })).statusCode,
    ).toBe(409)
    await req('POST', `/eventos/${id}/status`, org, { status: 'publicado' })
    expect(
      (await req('POST', `/eventos/${id}/status`, org, { status: 'cancelado' })).statusCode,
    ).toBe(400)
    const adiado = await req('POST', `/eventos/${id}/status`, org, {
      status: 'adiado',
      motivo: 'Chuva forte prevista',
      novoInicio: '2026-11-28T16:00:00-03:00',
    })
    expect(adiado.json()).toMatchObject({ status: 'adiado' })
  })

  it('membro não cria, não edita e não publica', async () => {
    const id = await eventoDoSabado()
    await req('POST', `/eventos/${id}/status`, org, { status: 'publicado' })
    expect(
      (
        await req('POST', '/eventos', membro, {
          titulo: 'X',
          categoria: 'Outra',
          inicio: SABADO,
          duracaoMin: 30,
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (await req('PATCH', `/eventos/${id}`, membro, { versao: 1, titulo: 'Novo' })).statusCode,
    ).toBe(403)
    const etapa = (await req('GET', `/eventos/${id}`, membro)).json().etapas[0].id
    expect(
      (await req('PATCH', `/eventos/${id}/etapas/${etapa}`, membro, { titulo: 'X' })).statusCode,
    ).toBe(403)
  })

  it('edição concorrente: versão antiga recebe 409 com a versão atual', async () => {
    const id = await eventoDoSabado()
    const v1 = (await req('GET', `/eventos/${id}`, org)).json().versao as number
    expect(
      (await req('PATCH', `/eventos/${id}`, org, { versao: v1, titulo: 'Primeira edição' }))
        .statusCode,
    ).toBe(200)
    const antiga = await req('PATCH', `/eventos/${id}`, org, {
      versao: v1,
      titulo: 'Edição atrasada',
    })
    expect(antiga.statusCode).toBe(409)
    expect(antiga.json()).toMatchObject({ erro: 'conflito', atual: { versao: v1 + 1 } })
  })

  it('reordenar etapas; lista incompleta é recusada', async () => {
    const id = await eventoDoSabado()
    const ids = ((await req('GET', `/eventos/${id}`, org)).json().etapas as { id: string }[]).map(
      (e) => e.id,
    )
    const invertida = [...ids].reverse()
    expect(
      (await req('PUT', `/eventos/${id}/etapas/ordem`, org, { ids: invertida })).statusCode,
    ).toBe(200)
    const depois = (
      (await req('GET', `/eventos/${id}`, org)).json().etapas as { id: string }[]
    ).map((e) => e.id)
    expect(depois).toEqual(invertida)
    expect(
      (await req('PUT', `/eventos/${id}/etapas/ordem`, org, { ids: ids.slice(1) })).statusCode,
    ).toBe(409)
  })

  it('só rascunho pode ser excluído; duplicar copia etapas sem copiar a escala', async () => {
    const id = await eventoDoSabado()
    await req('POST', `/eventos/${id}/atribuicoes`, org, {
      vinculoId: vinculoDoMembro,
      funcao: 'louvor',
    })
    await req('POST', `/eventos/${id}/status`, org, { status: 'publicado' })
    expect((await req('DELETE', `/eventos/${id}`, org)).statusCode).toBe(409)
    const copia = (
      await req('POST', `/eventos/${id}/duplicar`, org, { inicio: '2026-11-28T16:00:00-03:00' })
    ).json().id
    const d = (await req('GET', `/eventos/${copia}`, org)).json()
    expect(d.status).toBe('rascunho')
    expect(d.etapas).toHaveLength(7)
    expect(d.atribuicoes).toEqual([])
    expect((await req('DELETE', `/eventos/${copia}`, org)).statusCode).toBe(200)
  })

  it('local externo exige endereço', async () => {
    expect((await req('POST', '/locais', org, { nome: 'Praia', tipo: 'externo' })).statusCode).toBe(
      400,
    )
    const ok = await req('POST', '/locais', org, {
      nome: 'Praia do Forte',
      tipo: 'externo',
      endereco: 'Av. Beira-Mar, 100',
      latitude: -23.5,
      longitude: -46.6,
    })
    expect(ok.statusCode).toBe(200)
  })
})

describe('tarefas, checklist, notas e anexos', () => {
  let id: string
  beforeAll(async () => {
    id = await eventoDoSabado()
    await req('POST', `/eventos/${id}/status`, org, { status: 'publicado' })
  })

  it('membro conclui a própria tarefa, não a dos outros, e não renomeia', async () => {
    const minha = (
      await req('POST', `/eventos/${id}/tarefas`, org, {
        titulo: 'Levar o violão',
        responsavelVinculoId: vinculoDoMembro,
      })
    ).json().id
    const alheia = (
      await req('POST', `/eventos/${id}/tarefas`, org, {
        titulo: 'Comprar o brinde',
        responsavelVinculoId: vinculoDoOutro,
      })
    ).json().id
    const ok = await req('PATCH', `/eventos/${id}/tarefas/${minha}`, membro, { concluida: true })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().concluidaEm).not.toBeNull()
    const { rows } = await b.su.query('select concluida_por from uj.tarefas where id = $1', [minha])
    expect(rows).toEqual([{ concluida_por: membro.id }])
    expect(
      (await req('PATCH', `/eventos/${id}/tarefas/${alheia}`, membro, { concluida: true }))
        .statusCode,
    ).toBe(404)
    expect(
      (await req('PATCH', `/eventos/${id}/tarefas/${minha}`, membro, { titulo: 'Outro nome' }))
        .statusCode,
    ).toBe(403)
  })

  it('responsável marca o item do checklist', async () => {
    const item = (
      await req('POST', `/eventos/${id}/checklist`, org, {
        tipo: 'preparacao',
        texto: 'Afinar o violão',
        responsavelVinculoId: vinculoDoMembro,
      })
    ).json().id
    const r = await req('PATCH', `/eventos/${id}/checklist/${item}`, membro, { marcado: true })
    expect(r.statusCode).toBe(200)
    expect(r.json().marcadoEm).not.toBeNull()
  })

  it('notas internas: organizadores veem; membros nunca', async () => {
    await req('POST', `/eventos/${id}/notas`, org, { texto: 'Conversar com o pastor sobre o som' })
    expect((await req('GET', `/eventos/${id}`, org)).json().notas).toHaveLength(1)
    expect((await req('GET', `/eventos/${id}`, membro)).json().notas).toEqual([])
    expect((await req('POST', `/eventos/${id}/notas`, membro, { texto: 'x' })).statusCode).toBe(403)
  })

  it('anexo só com https', async () => {
    expect(
      (
        await req('POST', `/eventos/${id}/anexos`, org, {
          titulo: 'Cifras',
          url: 'http://exemplo.test/x',
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await req('POST', `/eventos/${id}/anexos`, org, {
          titulo: 'Cifras',
          url: 'https://exemplo.test/cifras',
        })
      ).statusCode,
    ).toBe(200)
  })

  it('não dá para escalar alguém de outra comunidade', async () => {
    const r = await req('POST', `/eventos/${id}/atribuicoes`, org, {
      vinculoId: vinculoDeOutraComunidade,
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().erro).toBe('referencia_invalida')
  })
})
