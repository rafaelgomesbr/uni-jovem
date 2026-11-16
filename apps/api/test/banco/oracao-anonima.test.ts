import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import {
  concederProva,
  criarComunidade,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Pedido de oração anônimo (D55): mesma regra das sugestões anônimas. Só a
 * autora sabe que o pedido é dela; membro, equipe de oração, organizador,
 * administrador e o Criador recebem `autorNome: null`, e nem a API lê a
 * autoria no banco.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let outra: string
let autora: Pessoa
let admin: Pessoa
let criador: Pessoa
let equipe: Pessoa
let membro: Pessoa
let organizador: Pessoa
let forasteira: Pessoa

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, caminho: string, p: Pessoa, corpo?: object, comunidade = com) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${comunidade}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

async function criarPedido(corpo: object, quem: Pessoa = autora): Promise<string> {
  const r = await req('POST', '/oracao', quem, corpo)
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
  com = await criarComunidade(b, 'Jovens Oração Anônima')
  outra = await criarComunidade(b, 'Outra Comunidade Anônima')
  autora = await pessoaComSessao(b, app, config, 'Autora Discreta')
  admin = await pessoaComSessao(b, app, config, 'Admin Atento')
  criador = await pessoaComSessao(b, app, config, 'Criador Curioso', { criador: true })
  equipe = await pessoaComSessao(b, app, config, 'Equipe Fiel')
  membro = await pessoaComSessao(b, app, config, 'Membro Comum')
  organizador = await pessoaComSessao(b, app, config, 'Organizador Zeloso')
  forasteira = await pessoaComSessao(b, app, config, 'Forasteira')
  await vincular(b, autora.id, com, 'membro')
  await vincular(b, admin.id, com, 'admin')
  await vincular(b, criador.id, com, 'admin')
  await vincular(b, equipe.id, com, 'membro')
  await vincular(b, membro.id, com, 'membro')
  await vincular(b, organizador.id, com, 'organizador')
  await vincular(b, forasteira.id, outra, 'admin')
  await b.su.query(
    "update uj.vinculos set designacoes = '{equipe_oracao}' where conta_id = $1 and comunidade_id = $2",
    [equipe.id, com],
  )
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('pedido de oração anônimo: quem vê o nome', () => {
  it('a autora vê o próprio nome e a marca de anônimo', async () => {
    const id = await criarPedido({
      texto: 'Pela minha ansiedade',
      visibilidade: 'comunidade',
      anonimo: true,
    })
    const r = await req('GET', `/oracao/${id}`, autora)
    expect(r.json()).toMatchObject({
      minha: true,
      anonimo: true,
      autorNome: 'Autora Discreta',
    })
    const lista = (await req('GET', '/oracao?filtro=meus', autora)).json().pedidos as {
      id: string
    }[]
    expect(lista.map((p) => p.id)).toContain(id)
  })

  it('membro, equipe, organizador, admin e Criador recebem o pedido sem autoria', async () => {
    const id = await criarPedido({
      texto: 'Pela entrevista de emprego',
      visibilidade: 'comunidade',
      anonimo: true,
    })
    for (const quem of [membro, equipe, organizador, admin, criador]) {
      const r = await req('GET', `/oracao/${id}`, quem)
      expect(r.statusCode).toBe(200)
      const corpo = r.json()
      expect(corpo).toMatchObject({ anonimo: true, minha: false, autorNome: null })
      // Nem o nome nem o id da conta saem em parte alguma da resposta.
      expect(r.body).not.toContain('Autora Discreta')
      expect(r.body).not.toContain(autora.id)
      const lista = await req('GET', '/oracao', quem)
      const daLista = (lista.json().pedidos as { id: string }[]).find((p) => p.id === id)
      expect(daLista).toMatchObject({ autorNome: null, anonimo: true })
      expect(lista.body).not.toContain(autora.id)
      // Filtro "meus" não é atalho para descobrir: o pedido não é da pessoa.
      const meus = (await req('GET', '/oracao?filtro=meus', quem)).json().pedidos as {
        id: string
      }[]
      expect(meus.map((p) => p.id)).not.toContain(id)
    }
  })

  it('a equipe de oração também não vê o nome no pedido só para a equipe', async () => {
    const id = await criarPedido({
      texto: 'Pela minha família',
      visibilidade: 'equipe_oracao',
      anonimo: true,
    })
    const r = await req('GET', `/oracao/${id}`, equipe)
    expect(r.json()).toMatchObject({ anonimo: true, autorNome: null })
    expect(r.body).not.toContain('Autora Discreta')
  })

  it('pedido não anônimo continua com o nome (e anônimo é falso por padrão)', async () => {
    const id = await criarPedido({ texto: 'Pela viagem', visibilidade: 'comunidade' })
    const r = await req('GET', `/oracao/${id}`, membro)
    expect(r.json()).toMatchObject({ anonimo: false, autorNome: 'Autora Discreta' })
  })

  it('a API não lê a autoria no banco, nem com prova de 2FA do Criador', async () => {
    const id = await criarPedido({
      texto: 'Pela saúde do meu pai',
      visibilidade: 'comunidade',
      anonimo: true,
    })
    const prova = await concederProva(b, criador.id)
    for (const ctx of [
      { contaId: admin.id, comunidadeId: com },
      { contaId: criador.id, comunidadeId: com, prova },
      { contaId: autora.id, comunidadeId: com },
    ]) {
      const erro = await b
        .comoApi(ctx, 'select autor_conta_id from uj.pedidos_oracao where id = $1', [id])
        .then(
          () => '',
          (e: Error) => e.message,
        )
      expect(erro).toMatch(/permission denied/)
    }
    // A coluna que a API lê é nula no anônimo.
    expect(
      await b.comoApi(
        { contaId: admin.id, comunidadeId: com },
        'select autor_publico from uj.pedidos_oracao where id = $1',
        [id],
      ),
    ).toEqual([{ autor_publico: null }])
    // "Meus pedidos" só responde pela própria conta.
    expect(
      await b.comoApi(
        { contaId: admin.id, comunidadeId: com },
        'select * from uj.meus_pedidos_de_oracao() m where m = $1',
        [id],
      ),
    ).toEqual([])
    // O sistema guarda a autoria (abuso, exclusão de conta).
    const { rows } = await b.su.query(
      'select autor_conta_id from uj.pedidos_oracao where id = $1',
      [id],
    )
    expect(rows[0].autor_conta_id).toBe(autora.id)
  })
})

describe('pedido de oração anônimo: mudar depois', () => {
  it('só a autora liga e desliga o anonimato, com versão', async () => {
    const id = await criarPedido({ texto: 'Pela prova', visibilidade: 'comunidade' })
    expect((await req('GET', `/oracao/${id}`, membro)).json().autorNome).toBe('Autora Discreta')

    // Outra pessoa: 403 da matriz (o pedido ela vê).
    expect((await req('PATCH', `/oracao/${id}`, admin, { anonimo: true })).statusCode).toBe(403)
    // Corpo vazio: nada a mudar.
    expect((await req('PATCH', `/oracao/${id}`, autora, {})).statusCode).toBe(400)

    const ligado = await req('PATCH', `/oracao/${id}`, autora, { anonimo: true, versao: 1 })
    expect(ligado.statusCode).toBe(200)
    expect(ligado.json()).toMatchObject({ anonimo: true, versao: 2 })
    expect((await req('GET', `/oracao/${id}`, membro)).json()).toMatchObject({
      anonimo: true,
      autorNome: null,
    })
    // Versão antiga: conflito.
    expect(
      (await req('PATCH', `/oracao/${id}`, autora, { anonimo: false, versao: 1 })).statusCode,
    ).toBe(409)
    // O texto muda sem mexer no anonimato.
    await req('PATCH', `/oracao/${id}`, autora, { texto: 'Pela prova de amanhã' })
    expect((await req('GET', `/oracao/${id}`, membro)).json()).toMatchObject({
      texto: 'Pela prova de amanhã',
      anonimo: true,
      autorNome: null,
    })

    await req('PATCH', `/oracao/${id}`, autora, { anonimo: false })
    expect((await req('GET', `/oracao/${id}`, membro)).json().autorNome).toBe('Autora Discreta')

    // Auditoria: só o estado, nunca o texto; lida só pela autora.
    const aud = await b.su.query(
      "select detalhes from uj.auditoria where acao = 'oracao.anonimato_alterado' and recurso_id = $1 order by id",
      [id],
    )
    expect(aud.rows.map((x) => x.detalhes)).toEqual([{ anonimo: true }, { anonimo: false }])
  })
})

describe('pedido de oração anônimo: bloqueio e isolamento', () => {
  it('não serve para bloquear e não some para quem bloqueou a autora', async () => {
    const anonimoId = await criarPedido({
      texto: 'Pedido sem nome',
      visibilidade: 'comunidade',
      anonimo: true,
    })
    const assinadoId = await criarPedido({ texto: 'Pedido com nome', visibilidade: 'comunidade' })
    const peloAnonimo = await req('POST', '/bloqueios', membro, {
      recursoTipo: 'pedido_oracao',
      recursoId: anonimoId,
    })
    expect(peloAnonimo.statusCode).toBe(422)
    expect(peloAnonimo.json().erro).toBe('autoria_anonima')
    expect(peloAnonimo.json().mensagem).toMatch(/pedido é anônimo/)

    // Bloqueia pela via assinada: o assinado some, o anônimo continua (sumir revelaria).
    expect(
      (
        await req('POST', '/bloqueios', membro, {
          recursoTipo: 'pedido_oracao',
          recursoId: assinadoId,
        })
      ).statusCode,
    ).toBe(200)
    const ids = ((await req('GET', '/oracao', membro)).json().pedidos as { id: string }[]).map(
      (p) => p.id,
    )
    expect(ids).toContain(anonimoId)
    expect(ids).not.toContain(assinadoId)
  })

  it('outra comunidade: 404 ao ler, orar, editar e excluir, trocando o id na URL', async () => {
    const id = await criarPedido({
      texto: 'Só desta comunidade',
      visibilidade: 'comunidade',
      anonimo: true,
    })
    for (const [metodo, caminho, corpo] of [
      ['GET', `/oracao/${id}`, undefined],
      ['POST', `/oracao/${id}/orando`, undefined],
      ['PATCH', `/oracao/${id}`, { anonimo: false }],
      ['DELETE', `/oracao/${id}`, undefined],
    ] as const) {
      const r = await req(metodo, caminho, forasteira, corpo, outra)
      expect(r.statusCode, `${metodo} ${caminho}`).toBe(404)
    }
    const lista = await req('GET', '/oracao', forasteira, undefined, outra)
    expect((lista.json().pedidos as { id: string }[]).map((p) => p.id)).not.toContain(id)
    // E a autora, na comunidade dela, continua vendo o pedido como dela.
    expect((await req('GET', `/oracao/${id}`, autora)).json().minha).toBe(true)
  })
})

describe('pedido de oração anônimo: exportação da autora', () => {
  it('o pedido sai normalmente para a autora, com a marca de anônimo', async () => {
    const id = await criarPedido({ texto: 'Pedido para exportar', anonimo: true })
    const r = await app.inject({ method: 'GET', url: '/api/v1/eu/exportar', headers: autora.auth })
    expect(r.statusCode).toBe(200)
    const pedido = (
      r.json().pedidosDeOracao as { id: string; texto: string; anonimo: boolean }[]
    ).find((p) => p.id === id)
    expect(pedido).toMatchObject({ texto: 'Pedido para exportar', anonimo: true })
  })
})
