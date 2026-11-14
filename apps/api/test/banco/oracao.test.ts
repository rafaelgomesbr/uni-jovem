import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decifrar } from '../../src/autenticacao/cripto.ts'
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
 * Pedidos de oração (F15): visibilidade aplicada na API E no banco, texto
 * cifrado em repouso e fora de auditoria e log de mudanças.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let autora: Pessoa
let admin: Pessoa
let criador: Pessoa
let equipe: Pessoa
let membro: Pessoa
let organizador: Pessoa

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

const ids = async (p: Pessoa): Promise<string[]> =>
  ((await req('GET', '/oracao', p)).json().pedidos as { id: string }[]).map((x) => x.id)

async function criarPedido(texto: string, visibilidade?: string): Promise<string> {
  const r = await req('POST', '/oracao', autora, visibilidade ? { texto, visibilidade } : { texto })
  expect(r.statusCode).toBe(200)
  return r.json().id
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
  com = await criarComunidade(b, 'Jovens Oração')
  autora = await pessoaComSessao(b, app, config, 'Autora')
  admin = await pessoaComSessao(b, app, config, 'Admin')
  criador = await pessoaComSessao(b, app, config, 'Criador', { criador: true })
  equipe = await pessoaComSessao(b, app, config, 'Equipe')
  membro = await pessoaComSessao(b, app, config, 'Membro')
  organizador = await pessoaComSessao(b, app, config, 'Organizador')
  await vincular(b, autora.id, com, 'membro')
  await vincular(b, admin.id, com, 'admin')
  // O Criador também é admin desta comunidade: nem assim lê "Somente eu".
  await vincular(b, criador.id, com, 'admin')
  await vincular(b, equipe.id, com, 'membro')
  await vincular(b, membro.id, com, 'membro')
  await vincular(b, organizador.id, com, 'organizador')
  await b.su.query(
    "update uj.vinculos set designacoes = '{equipe_oracao}' where conta_id = $1 and comunidade_id = $2",
    [equipe.id, com],
  )
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('pedidos de oração: "Somente eu"', () => {
  it('é o padrão e só a autora vê, pela API', async () => {
    const id = await criarPedido('Minha saúde, só entre mim e Deus')
    const meu = await req('GET', `/oracao/${id}`, autora)
    expect(meu.json()).toMatchObject({
      texto: 'Minha saúde, só entre mim e Deus',
      visibilidade: 'somente_eu',
      minha: true,
      autorNome: 'Autora',
    })
    for (const quem of [admin, criador, equipe, membro, organizador]) {
      expect(await ids(quem)).not.toContain(id)
      expect((await req('GET', `/oracao/${id}`, quem)).statusCode).toBe(404)
      expect((await req('POST', `/oracao/${id}/orando`, quem)).statusCode).toBe(404)
      expect((await req('PATCH', `/oracao/${id}`, quem, { texto: 'x' })).statusCode).toBe(404)
      expect((await req('DELETE', `/oracao/${id}`, quem)).statusCode).toBe(404)
    }
  })

  it('é invisível direto no banco para admin e para o Criador, com e sem intervenção', async () => {
    const id = await criarPedido('Pedido secreto de teste')
    const prova = await concederProva(b, criador.id)
    const contextos = [
      { contaId: admin.id, comunidadeId: com },
      { contaId: organizador.id, comunidadeId: com },
      { contaId: equipe.id, comunidadeId: com },
      // Criador com vínculo de admin e prova de 2FA.
      { contaId: criador.id, comunidadeId: com, prova },
    ]
    for (const ctx of contextos) {
      expect(await b.comoApi(ctx, 'select id from uj.pedidos_oracao where id = $1', [id])).toEqual(
        [],
      )
      expect(
        await b.comoApi(
          ctx,
          "select id from uj.mudancas where tabela = 'pedidos_oracao' and registro_id = $1",
          [id],
        ),
      ).toEqual([])
      expect(
        await b.comoApi(ctx, "select id from uj.auditoria where acao like 'oracao.%'"),
      ).toEqual([])
      // Nem atualizar ou apagar às cegas.
      expect(
        await b.comoApi(
          ctx,
          "update uj.pedidos_oracao set visibilidade = 'comunidade' where id = $1 returning id",
          [id],
        ),
      ).toEqual([])
    }
    // Criador em intervenção numa comunidade onde NÃO tem vínculo: também nada.
    const outra = await criarComunidade(b, 'Outra comunidade')
    const forasteira = await pessoaComSessao(b, app, config, 'Forasteira')
    await vincular(b, forasteira.id, outra, 'admin')
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${outra}/oracao`,
      headers: forasteira.auth,
      payload: { texto: 'Pedido na outra comunidade' },
    })
    const idOutra = r.json().id as string
    expect(
      await b.comoApi(
        { contaId: criador.id, comunidadeId: outra, prova },
        'select id from uj.pedidos_oracao',
      ),
    ).toEqual([])
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/c/${outra}/oracao/${idOutra}`,
          headers: criador.auth,
        })
      ).statusCode,
    ).toBe(404)
    // A autora, sim, lê no banco (prova de que a política não está fechada para todos).
    expect(
      await b.comoApi(
        { contaId: autora.id, comunidadeId: com },
        'select id from uj.pedidos_oracao where id = $1',
        [id],
      ),
    ).toEqual([{ id }])
  })

  it('a auditoria da comunidade não mostra ações de oração ao admin', async () => {
    await criarPedido('Outro pedido')
    const r = await req('GET', '/auditoria', admin)
    expect(r.statusCode).toBe(200)
    const acoes = (r.json().registros as { acao: string }[]).map((x) => x.acao)
    expect(acoes.some((a) => a.startsWith('oracao.'))).toBe(false)
    const { rows } = await b.su.query(
      "select count(*)::int as n from uj.auditoria where acao = 'oracao.criado' and conta_id = $1",
      [autora.id],
    )
    expect(rows[0].n).toBeGreaterThan(0)
  })
})

describe('pedidos de oração: texto cifrado e fora dos registros', () => {
  it('o texto não aparece em nenhuma tabela do esquema, nem na auditoria ou no log de mudanças', async () => {
    const marca = 'MARCA-SECRETA-7f3a pela cura da minha irmã'
    const id = await criarPedido(marca, 'comunidade')
    await req('PATCH', `/oracao/${id}`, autora, { texto: `${marca} (editado)` })
    await req('PUT', `/oracao/${id}/visibilidade`, autora, {
      de: 'comunidade',
      para: 'equipe_oracao',
    })
    await req('POST', `/oracao/${id}/orando`, equipe)
    await req('POST', `/oracao/${id}/respondido`, autora, { respondido: true })

    // "Dump": cada linha de cada tabela de uj, como texto.
    const tabelas = (
      await b.su.query<{ t: string }>(
        "select tablename as t from pg_tables where schemaname = 'uj' order by 1",
      )
    ).rows.map((r) => r.t)
    expect(tabelas).toContain('pedidos_oracao')
    for (const t of tabelas) {
      const { rows } = await b.su.query<{ dump: string | null }>(
        `select string_agg(x::text, E'\\n') as dump from uj.${t} x`,
      )
      const dump = rows[0]!.dump ?? ''
      expect(dump.includes('MARCA-SECRETA'), `tabela ${t}`).toBe(false)
      // bytea aparece em hexadecimal: confere também o texto em hex.
      expect(dump.includes(Buffer.from('MARCA-SECRETA').toString('hex')), `tabela ${t} (hex)`).toBe(
        false,
      )
    }
    const aud = await b.su.query<{ d: string }>(
      "select string_agg(detalhes::text || coalesce(recurso_id, ''), ' ') as d from uj.auditoria where acao like 'oracao.%'",
    )
    expect(aud.rows[0]!.d).not.toContain('MARCA')

    // O que está no banco decifra com a chave e o contexto do id (e só com eles).
    const { rows } = await b.su.query<{ texto_cifrado: Buffer }>(
      'select texto_cifrado from uj.pedidos_oracao where id = $1',
      [id],
    )
    const chave = Buffer.from(config.ORACAO_CHAVE, 'base64')
    expect(decifrar(chave, rows[0]!.texto_cifrado, `oracao:${id}`)).toBe(`${marca} (editado)`)
    expect(() => decifrar(chave, rows[0]!.texto_cifrado, 'oracao:outro-id')).toThrow()
  })

  it('o banco recusa texto claro na coluna cifrada', async () => {
    const erro = await b
      .comoApi(
        { contaId: autora.id, comunidadeId: com },
        "insert into uj.pedidos_oracao (comunidade_id, texto_cifrado) values ($1, convert_to('texto em claro sem cifra nenhuma aqui', 'UTF8'))",
        [com],
      )
      .then(
        () => '',
        (e: Error) => e.message,
      )
    expect(erro).toMatch(/check/)
  })
})

describe('pedidos de oração: mudança de visibilidade', () => {
  it('é explícita, confere o público visto e muda quem lê', async () => {
    const id = await criarPedido('Pela minha família')
    // Público visto diferente do atual: 409, nada muda.
    const errado = await req('PUT', `/oracao/${id}/visibilidade`, autora, {
      de: 'comunidade',
      para: 'equipe_oracao',
    })
    expect(errado.statusCode).toBe(409)
    expect(errado.json().atual.visibilidade).toBe('somente_eu')

    const r = await req('PUT', `/oracao/${id}/visibilidade`, autora, {
      de: 'somente_eu',
      para: 'equipe_oracao',
    })
    expect(r.json()).toMatchObject({ visibilidade: 'equipe_oracao' })
    expect(r.json().quemVe).toMatch(/equipe de oração/)
    expect(await ids(equipe)).toContain(id)
    for (const quem of [admin, criador, membro, organizador]) {
      expect(await ids(quem)).not.toContain(id)
    }
    // A equipe sabe pelo log de mudanças; o admin não.
    expect(
      (
        await b.comoApi(
          { contaId: equipe.id, comunidadeId: com },
          "select id from uj.mudancas where tabela = 'pedidos_oracao' and registro_id = $1",
          [id],
        )
      ).length,
    ).toBeGreaterThan(0)
    expect(
      await b.comoApi(
        { contaId: admin.id, comunidadeId: com },
        "select id from uj.mudancas where tabela = 'pedidos_oracao' and registro_id = $1",
        [id],
      ),
    ).toEqual([])

    await req('PUT', `/oracao/${id}/visibilidade`, autora, {
      de: 'equipe_oracao',
      para: 'comunidade',
    })
    for (const quem of [admin, criador, equipe, membro, organizador]) {
      expect(await ids(quem)).toContain(id)
    }

    // Voltar a "Somente eu" fecha para todos de novo.
    await req('PUT', `/oracao/${id}/visibilidade`, autora, {
      de: 'comunidade',
      para: 'somente_eu',
    })
    for (const quem of [admin, criador, equipe, membro, organizador]) {
      expect(await ids(quem)).not.toContain(id)
    }
    const aud = await b.su.query(
      "select detalhes from uj.auditoria where acao = 'oracao.visibilidade_alterada' and recurso_id = $1 order by id",
      [id],
    )
    expect(aud.rows.map((x) => x.detalhes)).toEqual([
      { de: 'somente_eu', para: 'equipe_oracao' },
      { de: 'equipe_oracao', para: 'comunidade' },
      { de: 'comunidade', para: 'somente_eu' },
    ])
  })

  it('só a autora edita, muda o público, marca como respondido e exclui', async () => {
    const id = await criarPedido('Pela viagem', 'comunidade')
    expect((await req('PATCH', `/oracao/${id}`, membro, { texto: 'Tomado' })).statusCode).toBe(403)
    expect(
      (
        await req('PUT', `/oracao/${id}/visibilidade`, admin, {
          de: 'comunidade',
          para: 'somente_eu',
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (await req('POST', `/oracao/${id}/respondido`, admin, { respondido: true })).statusCode,
    ).toBe(403)
    expect((await req('DELETE', `/oracao/${id}`, organizador)).statusCode).toBe(403)

    const editado = await req('PATCH', `/oracao/${id}`, autora, { texto: 'Pela viagem de volta' })
    expect(editado.statusCode).toBe(200)
    expect((await req('GET', `/oracao/${id}`, membro)).json().texto).toBe('Pela viagem de volta')
    // Versão antiga: conflito.
    expect(
      (await req('PATCH', `/oracao/${id}`, autora, { texto: 'Outro', versao: 1 })).statusCode,
    ).toBe(409)

    const respondido = await req('POST', `/oracao/${id}/respondido`, autora, { respondido: true })
    expect(respondido.json().respondidoEm).not.toBeNull()
    expect((await req('DELETE', `/oracao/${id}`, autora)).json()).toEqual({ ok: true })
    expect((await req('GET', `/oracao/${id}`, membro)).statusCode).toBe(404)
  })
})

describe('pedidos de oração: "estou orando"', () => {
  it('conta e mostra quem ora conforme a visibilidade', async () => {
    const id = await criarPedido('Pela prova da faculdade', 'comunidade')
    const r = await req('POST', `/oracao/${id}/orando`, membro)
    expect(r.json()).toEqual({ euEstouOrando: true, total: 1 })
    // Repetir não duplica.
    expect((await req('POST', `/oracao/${id}/orando`, membro)).json().total).toBe(1)
    await req('POST', `/oracao/${id}/orando`, equipe)
    const visto = (await req('GET', `/oracao/${id}`, autora)).json()
    expect(visto.orando).toEqual({ total: 2, euEstouOrando: false, pessoas: ['Equipe', 'Membro'] })

    // Fechado para a equipe: o membro deixa de ver o pedido e as intercessões.
    await req('PUT', `/oracao/${id}/visibilidade`, autora, {
      de: 'comunidade',
      para: 'equipe_oracao',
    })
    expect((await req('GET', `/oracao/${id}`, membro)).statusCode).toBe(404)
    expect((await req('DELETE', `/oracao/${id}/orando`, membro)).statusCode).toBe(404)
    expect(
      await b.comoApi(
        { contaId: membro.id, comunidadeId: com },
        'select id from uj.intercessoes where pedido_id = $1',
        [id],
      ),
    ).toEqual([])
    const equipeVe = (await req('GET', `/oracao/${id}`, equipe)).json()
    expect(equipeVe.orando).toMatchObject({ total: 2, euEstouOrando: true })

    expect((await req('DELETE', `/oracao/${id}/orando`, equipe)).json()).toEqual({
      euEstouOrando: false,
      total: 1,
    })
  })

  it('pedido de quem saiu da comunidade some para os outros', async () => {
    const saiu = await pessoaComSessao(b, app, config, 'Saiu')
    await vincular(b, saiu.id, com, 'membro')
    const r = await req('POST', '/oracao', saiu, {
      texto: 'Antes de sair',
      visibilidade: 'comunidade',
    })
    const id = r.json().id as string
    expect(await ids(membro)).toContain(id)
    await req('POST', '/sair', saiu)
    expect(await ids(membro)).not.toContain(id)
  })
})
