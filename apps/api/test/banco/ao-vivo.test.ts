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
let org1: Pessoa
let org2: Pessoa
let membro: Pessoa

type Metodo = 'GET' | 'POST'
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
  org1 = await pessoaComSessao(b, app, config, 'Org Um')
  org2 = await pessoaComSessao(b, app, config, 'Org Dois')
  membro = await pessoaComSessao(b, app, config, 'Membro')
  await vincular(b, org1.id, com, 'organizador')
  await vincular(b, org2.id, com, 'organizador')
  await vincular(b, membro.id, com, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

async function eventoPublicado(
  inicio = new Date(Date.now() - 10 * 60_000).toISOString(),
): Promise<string> {
  const id = (
    await req('POST', '/eventos', org1, {
      titulo: 'Sábado',
      categoria: 'Programação de sábado',
      inicio,
      modelo: 'sabado_padrao',
    })
  ).json().id
  await req('POST', `/eventos/${id}/status`, org1, { status: 'publicado' })
  return id
}

const cmd = (id: string, p: Pessoa, corpo: object) =>
  req('POST', `/eventos/${id}/ao-vivo`, p, corpo)

describe('ao vivo', () => {
  it('conduzir: iniciar e avançar; atraso calculado contra o previsto', async () => {
    const id = await eventoPublicado()
    let r = await cmd(id, org1, { comando: 'iniciar', versao: 0 })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ situacao: 'em_andamento', versao: 1, souCondutor: true })
    expect(r.json().etapas[0].situacao).toBe('atual')
    // Começou cerca de 10 minutos depois do previsto.
    expect(r.json().atrasoMin).toBeGreaterThanOrEqual(9)
    expect(r.json().atrasoMin).toBeLessThanOrEqual(11)
    r = await cmd(id, org1, { comando: 'avancar', versao: 1 })
    expect(r.json()).toMatchObject({ versao: 2 })
    expect(
      r
        .json()
        .etapas.map((e: { situacao: string }) => e.situacao)
        .slice(0, 3),
    ).toEqual(['concluida', 'atual', 'proxima'])
    expect(r.json().etapas[1].inicioReal).not.toBeNull()
  })

  it('outro organizador não comanda; só assume confirmando, e fica registrado', async () => {
    const id = await eventoPublicado()
    await cmd(id, org1, { comando: 'iniciar', versao: 0 })
    const tentativa = await cmd(id, org2, { comando: 'avancar', versao: 1 })
    expect(tentativa.statusCode).toBe(409)
    expect(tentativa.json()).toMatchObject({
      erro: 'conduzido_por_outra_pessoa',
      atual: { condutor: { nome: 'Org Um' } },
    })
    expect((await cmd(id, org2, { comando: 'assumir', versao: 1 })).statusCode).toBe(409)
    const assumiu = await cmd(id, org2, { comando: 'assumir', versao: 1, forcar: true })
    expect(assumiu.json()).toMatchObject({ souCondutor: true, condutor: { nome: 'Org Dois' } })
    const aud = await b.su.query(
      "select count(*)::int as n from uj.auditoria where acao = 'ao_vivo.conducao_assumida'",
    )
    expect(aud.rows[0].n).toBeGreaterThan(0)
  })

  it('versão antiga recebe 409 com o estado atual, e o estado não se corrompe', async () => {
    const id = await eventoPublicado()
    await cmd(id, org1, { comando: 'iniciar', versao: 0 })
    const antiga = await cmd(id, org1, { comando: 'avancar', versao: 0 })
    expect(antiga.statusCode).toBe(409)
    expect(antiga.json().atual.versao).toBe(1)
  })

  it('dois comandos simultâneos com a mesma versão: só um vale', async () => {
    const id = await eventoPublicado()
    await cmd(id, org1, { comando: 'iniciar', versao: 0 })
    const [a, c] = await Promise.all([
      cmd(id, org1, { comando: 'avancar', versao: 1 }),
      cmd(id, org1, { comando: 'avancar', versao: 1 }),
    ])
    expect([a.statusCode, c.statusCode].sort()).toEqual([200, 409])
    const estado = (await req('GET', `/eventos/${id}/ao-vivo`, org1)).json()
    expect(estado.versao).toBe(2)
    expect(estado.etapas[1].situacao).toBe('atual')
  })

  it('membro acompanha, mas não conduz; rascunho não vai ao vivo', async () => {
    const id = await eventoPublicado()
    expect((await req('GET', `/eventos/${id}/ao-vivo`, membro)).statusCode).toBe(200)
    expect((await cmd(id, membro, { comando: 'iniciar', versao: 0 })).statusCode).toBe(403)
    const rascunho = (
      await req('POST', '/eventos', org1, {
        titulo: 'Rascunho',
        categoria: 'Outra',
        inicio: new Date().toISOString(),
        duracaoMin: 30,
      })
    ).json().id
    expect((await cmd(rascunho, org1, { comando: 'iniciar', versao: 0 })).json().erro).toBe(
      'evento_nao_publicado',
    )
  })

  it('long polling: quem espera recebe a mudança assim que ela acontece', async () => {
    const id = await eventoPublicado()
    await cmd(id, org1, { comando: 'iniciar', versao: 0 })
    const inicio = Date.now()
    const espera = req('GET', `/eventos/${id}/ao-vivo?depoisDaVersao=1`, membro)
    setTimeout(() => void cmd(id, org1, { comando: 'avancar', versao: 1 }), 300)
    const r = await espera
    expect(r.json().versao).toBe(2)
    expect(Date.now() - inicio).toBeLessThan(5_000)
  })
})
