import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Bloqueio individual (Apple 1.2, D35 e D36): quem bloqueia deixa de ver os
 * pedidos de oração e as sugestões não anônimas da outra pessoa, só naquela
 * comunidade. Avisos e programação continuam. A pessoa bloqueada não percebe
 * nada, nenhum papel muda e ninguém (nem a administração) vê quem bloqueou quem.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let outra: string
let admin: Pessoa
let organizadora: Pessoa
let ana: Pessoa
let bruno: Pessoa
let carla: Pessoa
const vinculos: Record<string, string> = {}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, url: string, p: Pessoa, corpo?: object) =>
  app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })
const em = (comunidade: string, caminho: string) => `/api/v1/c/${comunidade}${caminho}`

async function pedidoDeOracao(p: Pessoa, texto: string, comunidade = com): Promise<string> {
  const r = await req('POST', em(comunidade, '/oracao'), p, { texto, visibilidade: 'comunidade' })
  expect(r.statusCode).toBe(200)
  return r.json().id as string
}

async function bloquear(p: Pessoa, corpo: object, comunidade = com) {
  return req('POST', em(comunidade, '/bloqueios'), p, corpo)
}

async function textosDaOracao(p: Pessoa, comunidade = com): Promise<string[]> {
  const r = await req('GET', em(comunidade, '/oracao'), p)
  expect(r.statusCode).toBe(200)
  return (r.json().pedidos as { texto: string }[]).map((x) => x.texto)
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
  com = await criarComunidade(b, 'Jovens do Bloqueio')
  outra = await criarComunidade(b, 'Outra Comunidade')
  admin = await pessoaComSessao(b, app, config, 'Admin Bloqueio')
  organizadora = await pessoaComSessao(b, app, config, 'Organizadora Bloqueio')
  ana = await pessoaComSessao(b, app, config, 'Ana Bloqueadora')
  bruno = await pessoaComSessao(b, app, config, 'Bruno Bloqueado')
  carla = await pessoaComSessao(b, app, config, 'Carla Terceira')
  vinculos['admin'] = await vincular(b, admin.id, com, 'admin')
  vinculos['organizadora'] = await vincular(b, organizadora.id, com, 'organizador')
  vinculos['ana'] = await vincular(b, ana.id, com, 'membro')
  vinculos['bruno'] = await vincular(b, bruno.id, com, 'membro')
  vinculos['carla'] = await vincular(b, carla.id, com, 'membro')
  // Ana e Bruno também estão em outra comunidade: o bloqueio de uma não vale na outra.
  await vincular(b, ana.id, outra, 'admin')
  await vincular(b, bruno.id, outra, 'membro')
  await b.su.query(
    "update uj.contas set avatar_icone = 'sol', avatar_cor = 'verde' where id = $1",
    [bruno.id],
  )
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('bloquear pelo pedido de oração', () => {
  it('o pedido some só para quem bloqueou; a pessoa bloqueada não percebe nada', async () => {
    const doBruno = await pedidoDeOracao(bruno, 'Pedido do Bruno')
    const naOutra = await pedidoDeOracao(bruno, 'Pedido do Bruno na outra', outra)
    expect(await textosDaOracao(ana)).toContain('Pedido do Bruno')
    const papeisAntes = (await b.su.query('select id, papel, estado from uj.vinculos order by id'))
      .rows
    const notificacoesAntes = (await b.su.query('select count(*)::int as n from uj.notificacoes'))
      .rows[0]

    const r = await bloquear(ana, { recursoTipo: 'pedido_oracao', recursoId: doBruno })
    expect(r.statusCode).toBe(200)
    expect(r.json().mensagem).toMatch(/não é avisada/)
    // Repetir devolve o mesmo bloqueio.
    const deNovo = await bloquear(ana, { recursoTipo: 'pedido_oracao', recursoId: doBruno })
    expect(deNovo.statusCode).toBe(200)
    expect(deNovo.json().id).toBe(r.json().id)

    // Para Ana: some da lista, do detalhe e do "estou orando".
    expect(await textosDaOracao(ana)).not.toContain('Pedido do Bruno')
    expect((await req('GET', em(com, `/oracao/${doBruno}`), ana)).statusCode).toBe(404)
    expect((await req('POST', em(com, `/oracao/${doBruno}/orando`), ana)).statusCode).toBe(404)
    // Só nesta comunidade.
    expect(await textosDaOracao(ana, outra)).toContain('Pedido do Bruno na outra')
    expect((await req('GET', em(outra, `/oracao/${naOutra}`), ana)).statusCode).toBe(200)
    // Para os outros, nada muda.
    expect(await textosDaOracao(carla)).toContain('Pedido do Bruno')
    expect(await textosDaOracao(bruno)).toContain('Pedido do Bruno')
    // Bruno não vê o bloqueio, não recebe notificação e ninguém muda de papel.
    expect((await req('GET', em(com, '/bloqueios'), bruno)).json()).toEqual({ bloqueios: [] })
    expect((await b.su.query('select count(*)::int as n from uj.notificacoes')).rows[0]).toEqual(
      notificacoesAntes,
    )
    expect(
      (await b.su.query('select id, papel, estado from uj.vinculos order by id')).rows,
    ).toEqual(papeisAntes)
    // O log de mudanças só avisa quem bloqueou.
    const log = await b.su.query<{ conta_alvo: string | null }>(
      "select conta_alvo from uj.mudancas where tabela = 'bloqueios'",
    )
    expect(log.rows.length).toBeGreaterThan(0)
    expect(new Set(log.rows.map((x) => x.conta_alvo))).toEqual(new Set([ana.id]))
    const peloBruno = await b.comoApi(
      { contaId: bruno.id, comunidadeId: com },
      "select 1 from uj.mudancas where tabela = 'bloqueios'",
    )
    expect(peloBruno).toEqual([])
  })

  it('a auditoria registra sem conteúdo e fora da comunidade: a administração não vê', async () => {
    const linhas = await b.su.query<{
      comunidade_id: string | null
      conta_id: string
      detalhes: Record<string, unknown>
    }>("select comunidade_id, conta_id, detalhes from uj.auditoria where acao = 'bloqueio.criado'")
    expect(linhas.rows).toEqual([
      { comunidade_id: null, conta_id: ana.id, detalhes: { origem: 'pedido_oracao' } },
    ])
    expect(JSON.stringify(linhas.rows)).not.toContain(bruno.id)
    const daComunidade = await req('GET', em(com, '/auditoria'), admin)
    expect(daComunidade.statusCode).toBe(200)
    expect(JSON.stringify(daComunidade.json())).not.toContain('bloqueio')
  })

  it('"estou orando" de quem eu bloqueei não aparece no meu pedido; a contagem continua', async () => {
    const meu = await pedidoDeOracao(ana, 'Pedido da Ana')
    expect((await req('POST', em(com, `/oracao/${meu}/orando`), bruno)).statusCode).toBe(200)
    expect((await req('POST', em(com, `/oracao/${meu}/orando`), carla)).statusCode).toBe(200)
    const r = await req('GET', em(com, `/oracao/${meu}`), ana)
    expect(r.json().orando.total).toBe(2)
    expect(r.json().orando.pessoas).toEqual(['Carla Terceira'])
  })
})

describe('lista de pessoas bloqueadas', () => {
  it('mostra nome e avatar de quem eu bloqueei; nunca quem me bloqueou', async () => {
    const r = await req('GET', em(com, '/bloqueios'), ana)
    expect(r.statusCode).toBe(200)
    expect(r.json().bloqueios).toEqual([
      {
        id: expect.any(String),
        vinculoId: vinculos['bruno'],
        nome: 'Bruno Bloqueado',
        avatar: { icone: 'sol', cor: 'verde' },
        fotoVersao: null,
        bloqueadoEm: expect.any(String),
      },
    ])
    // Bruno bloqueia Carla: a lista dele não mostra Ana, e a de Carla fica vazia.
    const daCarla = await pedidoDeOracao(carla, 'Pedido da Carla')
    expect(
      (await bloquear(bruno, { recursoTipo: 'pedido_oracao', recursoId: daCarla })).statusCode,
    ).toBe(200)
    const doBruno = (await req('GET', em(com, '/bloqueios'), bruno)).json().bloqueios
    expect(doBruno.map((x: { nome: string }) => x.nome)).toEqual(['Carla Terceira'])
    expect((await req('GET', em(com, '/bloqueios'), carla)).json()).toEqual({ bloqueios: [] })
    // Nem a administração lê os bloqueios das pessoas.
    expect((await req('GET', em(com, '/bloqueios'), admin)).json()).toEqual({ bloqueios: [] })
    expect(
      await b.comoApi({ contaId: admin.id, comunidadeId: com }, 'select * from uj.bloqueios'),
    ).toEqual([])
  })
})

describe('sugestões e avisos', () => {
  it('organizadora bloqueia a autora: a sugestão com nome some, a anônima continua', async () => {
    const comNome = await req('POST', em(com, '/sugestoes'), carla, {
      titulo: 'Sugestão assinada',
      texto: 'Texto',
    })
    const anonima = await req('POST', em(com, '/sugestoes'), carla, {
      titulo: 'Sugestão anônima',
      texto: 'Texto',
      anonima: true,
    })
    const titulos = async () =>
      (
        (await req('GET', em(com, '/sugestoes'), organizadora)).json().sugestoes as {
          titulo: string
        }[]
      ).map((s) => s.titulo)
    expect(await titulos()).toEqual(
      expect.arrayContaining(['Sugestão assinada', 'Sugestão anônima']),
    )
    // Pela anônima não dá: bloquear revelaria quem escreveu.
    const pelaAnonima = await bloquear(organizadora, {
      recursoTipo: 'sugestao',
      recursoId: anonima.json().id,
    })
    expect(pelaAnonima.statusCode).toBe(422)
    expect(pelaAnonima.json().erro).toBe('autoria_anonima')
    // Membro não vê a sugestão de outra pessoa: 404, como se não existisse.
    expect(
      (await bloquear(ana, { recursoTipo: 'sugestao', recursoId: comNome.json().id })).statusCode,
    ).toBe(404)

    expect(
      (await bloquear(organizadora, { recursoTipo: 'sugestao', recursoId: comNome.json().id }))
        .statusCode,
    ).toBe(200)
    const depois = await titulos()
    expect(depois).not.toContain('Sugestão assinada')
    // A anônima continua: escondê-la diria que foi a Carla quem escreveu.
    expect(depois).toContain('Sugestão anônima')
    expect(
      (await req('GET', em(com, `/sugestoes/${comNome.json().id}`), organizadora)).statusCode,
    ).toBe(404)
    // A administração continua vendo tudo.
    const doAdmin = (await req('GET', em(com, '/sugestoes'), admin)).json().sugestoes as {
      titulo: string
    }[]
    expect(doAdmin.map((s) => s.titulo)).toContain('Sugestão assinada')
  })

  it('bloquear quem escreveu um aviso não esconde avisos nem programação', async () => {
    const aviso = await req('POST', em(com, '/avisos'), admin, {
      titulo: 'Retiro de verão',
      texto: 'Inscrições abertas.',
      publicar: true,
    })
    expect(aviso.statusCode).toBe(200)
    const r = await bloquear(ana, { recursoTipo: 'aviso', recursoId: aviso.json().id })
    expect(r.statusCode).toBe(200)
    const avisos = (await req('GET', em(com, '/avisos'), ana)).json().avisos as { titulo: string }[]
    expect(avisos.map((a) => a.titulo)).toContain('Retiro de verão')
    const inicio = (await req('GET', em(com, '/inicio'), ana)).json()
    expect(inicio.avisos.map((a: { titulo: string }) => a.titulo)).toContain('Retiro de verão')
    // E o bloqueio não muda o papel de ninguém: a admin segue admin.
    const papel = await b.su.query('select papel, estado from uj.vinculos where id = $1', [
      vinculos['admin'],
    ])
    expect(papel.rows).toEqual([{ papel: 'admin', estado: 'ativo' }])
    // Desbloquear devolve o que estava escondido (aqui, nada some de fato).
    expect((await req('DELETE', em(com, `/bloqueios/${r.json().id}`), ana)).statusCode).toBe(200)
  })
})

describe('pedidos recusados e desbloqueio', () => {
  it('a própria pessoa, conteúdo inexistente, vínculo de outra comunidade e corpo inválido', async () => {
    expect((await bloquear(ana, { vinculoId: vinculos['ana']! })).json().erro).toBe('bloquear_a_si')
    const meu = await pedidoDeOracao(ana, 'Outro pedido da Ana')
    const proprio = await bloquear(ana, { recursoTipo: 'pedido_oracao', recursoId: meu })
    expect(proprio.statusCode).toBe(422)
    expect(
      (
        await bloquear(ana, {
          recursoTipo: 'aviso',
          recursoId: '00000000-0000-4000-8000-000000000000',
        })
      ).statusCode,
    ).toBe(404)
    // O vínculo de Bruno na OUTRA comunidade não serve aqui.
    const vinculoNaOutra = (
      await b.su.query<{ id: string }>(
        'select id from uj.vinculos where conta_id = $1 and comunidade_id = $2',
        [bruno.id, outra],
      )
    ).rows[0]!.id
    expect((await bloquear(ana, { vinculoId: vinculoNaOutra })).statusCode).toBe(404)
    expect((await bloquear(ana, { vinculoId: 'nao-e-uuid' })).statusCode).toBe(400)
    expect((await bloquear(ana, { recursoTipo: 'evento', recursoId: meu })).statusCode).toBe(400)
  })

  it('pelo vínculo; outra pessoa não desfaz o meu bloqueio; desbloquear devolve o conteúdo', async () => {
    const r = await bloquear(carla, { vinculoId: vinculos['bruno']! })
    expect(r.statusCode).toBe(200)
    expect(await textosDaOracao(carla)).not.toContain('Pedido do Bruno')
    // Ana (outra pessoa) e a admin não desfazem o bloqueio da Carla: 404.
    expect((await req('DELETE', em(com, `/bloqueios/${r.json().id}`), ana)).statusCode).toBe(404)
    expect((await req('DELETE', em(com, `/bloqueios/${r.json().id}`), admin)).statusCode).toBe(404)
    // No caminho de outra comunidade da Carla não existe nada: 404.
    expect((await req('DELETE', em(outra, `/bloqueios/${r.json().id}`), ana)).statusCode).toBe(404)
    expect((await req('DELETE', em(com, `/bloqueios/${r.json().id}`), carla)).statusCode).toBe(200)
    expect(await textosDaOracao(carla)).toContain('Pedido do Bruno')
    expect((await req('DELETE', em(com, `/bloqueios/${r.json().id}`), carla)).statusCode).toBe(404)
    const auditoria = await b.su.query(
      "select comunidade_id, conta_id from uj.auditoria where acao = 'bloqueio.desfeito'",
    )
    expect(auditoria.rows).toContainEqual({ comunidade_id: null, conta_id: carla.id })
  })
})

describe('fim do vínculo e exportação', () => {
  it('exportar meus dados traz quando bloqueei, sem nada de quem foi bloqueado', async () => {
    const r = await req('GET', '/api/v1/eu/exportar', ana)
    expect(r.statusCode).toBe(200)
    expect(r.json().bloqueios).toEqual([{ comunidadeId: com, bloqueadoEm: expect.any(String) }])
    expect(r.body).not.toContain('Bruno Bloqueado')
    expect(r.body).not.toContain(bruno.id)
  })

  it('quando a pessoa bloqueada sai da comunidade, o bloqueio sai junto', async () => {
    expect((await req('GET', em(com, '/bloqueios'), ana)).json().bloqueios).toHaveLength(1)
    expect((await req('POST', em(com, '/sair'), bruno)).statusCode).toBe(200)
    expect((await req('GET', em(com, '/bloqueios'), ana)).json()).toEqual({ bloqueios: [] })
    const restantes = await b.su.query(
      'select 1 from uj.bloqueios where comunidade_id = $1 and $2 in (conta_id, bloqueada_conta_id)',
      [com, bruno.id],
    )
    expect(restantes.rows).toEqual([])
  })

  it('os papéis do aplicativo não gravam bloqueio direto nem leem o de outra pessoa', async () => {
    await expect(
      b.comoApi(
        { contaId: carla.id, comunidadeId: com },
        'insert into uj.bloqueios (comunidade_id, conta_id, bloqueada_conta_id) values ($1, $2, $3)',
        [com, carla.id, admin.id],
      ),
    ).rejects.toMatchObject({ code: '42501' })
    await expect(
      b.auth.query('select uj.bloquear($1, $2)', ['vinculo', vinculos['admin']]),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
