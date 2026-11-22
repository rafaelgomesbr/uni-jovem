/* eslint-disable no-script-url -- os casos de teste incluem javascript: de propósito: a regra tem de recusá-lo */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'
import { LINKS_ACEITOS, LINKS_RECUSADOS } from '../../../../packages/dominio/test/casos-de-links.ts'

/**
 * Links do Google Drive e do YouTube na música e "cadastrar direto no repertório" (D80, migração
 * 0031): a regra do banco é a mesma do domínio, a API recusa o que não passa (400 em palavras), a
 * organização grava e o membro só lê, o isolamento entre comunidades vale (404), a música nova e o
 * item do repertório entram numa transação só, e o endereço nunca vai para auditoria nem para o
 * log de mudanças.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let org: Pessoa
let orgB: Pessoa
let membro: Pessoa
let eventoId: string
let eventoDeB: string

const YT = 'https://www.youtube.com/watch?v=abc123'
const DRIVE = 'https://drive.google.com/file/d/1AbC/view?usp=sharing'
const SEGREDO = 'segredo-do-link-que-nao-vai-a-log'

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
const req = (metodo: Metodo, com: string, caminho: string, p: Pessoa, corpo?: object) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: p.auth,
    ...(corpo ? { payload: corpo } : {}),
  })

const nova = async (corpo: object, p = org, com = comA) =>
  req('POST', com, '/conteudos/musicas', p, corpo)
const musica = async (id: string, p = org, com = comA) =>
  (await req('GET', com, `/conteudos/musicas/${id}`, p)).json()

async function novoEncontro(com: string, p: Pessoa): Promise<string> {
  const r = await req('POST', com, '/eventos', p, {
    titulo: 'Sábado dos links',
    categoria: 'Programação de sábado',
    inicio: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    duracaoMin: 120,
  })
  expect(r.statusCode).toBe(200)
  const id = r.json().id as string
  await req('POST', com, `/eventos/${id}/etapas`, p, { titulo: 'Louvor', duracaoMin: 20 })
  await req('POST', com, `/eventos/${id}/status`, p, { status: 'publicado' })
  return id
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
  org = await pessoaComSessao(b, app, config, 'Olga')
  orgB = await pessoaComSessao(b, app, config, 'Otávio')
  membro = await pessoaComSessao(b, app, config, 'Mara')
  await vincular(b, org.id, comA, 'organizador')
  await vincular(b, orgB.id, comB, 'organizador')
  await vincular(b, membro.id, comA, 'membro')
  eventoId = await novoEncontro(comA, org)
  eventoDeB = await novoEncontro(comB, orgB)
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('a regra do banco é a mesma do domínio', () => {
  const noBanco = async (url: string) =>
    (await b.su.query<{ ok: boolean }>('select uj.link_de_musica_valido($1) as ok', [url])).rows[0]!
      .ok

  it.each(LINKS_ACEITOS)('o banco aceita %s', async (url) => {
    expect(await noBanco(url.trim())).toBe(true)
  })

  it.each(LINKS_RECUSADOS)('o banco recusa %j', async (url) => {
    expect(await noBanco(url)).toBe(false)
  })

  it('a lista: no máximo 3, só url e rotulo, o rótulo de 1 a 40 letras', async () => {
    const valida = async (json: unknown) =>
      (
        await b.su.query<{ ok: boolean }>('select uj.links_de_musica_validos($1::jsonb) as ok', [
          JSON.stringify(json),
        ])
      ).rows[0]!.ok
    expect(await valida([])).toBe(true)
    expect(await valida([{ url: YT }, { url: DRIVE, rotulo: 'Cifra' }, { url: YT }])).toBe(true)
    expect(await valida([{ url: YT }, { url: YT }, { url: YT }, { url: YT }])).toBe(false)
    expect(await valida({ url: YT })).toBe(false)
    expect(await valida([YT])).toBe(false)
    expect(await valida([{ url: YT, extra: 'x' }])).toBe(false)
    expect(await valida([{ rotulo: 'sem url' }])).toBe(false)
    expect(await valida([{ url: 7 }])).toBe(false)
    expect(await valida([{ url: 'https://exemplo.test/x' }])).toBe(false)
    expect(await valida([{ url: YT, rotulo: '' }])).toBe(false)
    expect(await valida([{ url: YT, rotulo: '   ' }])).toBe(false)
    expect(await valida([{ url: YT, rotulo: 'x'.repeat(41) }])).toBe(false)
    expect(await valida([{ url: YT, rotulo: 'x'.repeat(40) }])).toBe(true)
    expect(await valida([{ url: YT, rotulo: 7 }])).toBe(false)
  })

  it('mesmo com a rota contornada, o gatilho recusa (UJ103) em INSERT e UPDATE, também para o dono', async () => {
    await expect(
      b.comoApi(
        { contaId: org.id, comunidadeId: comA },
        `insert into uj.musicas (comunidade_id, titulo, links)
         values ($1, 'Contornada', '[{"url":"https://exemplo.test/x"}]')`,
        [comA],
      ),
    ).rejects.toMatchObject({ code: 'UJ103' })
    await expect(
      b.dono.query(
        `insert into uj.musicas (comunidade_id, titulo, links, criado_por)
         values ($1, 'Do dono', '[{"url":"javascript:alert(1)"}]', $2)`,
        [comA, org.id],
      ),
    ).rejects.toMatchObject({ code: 'UJ103' })
    const id = (await nova({ titulo: 'Para o update' })).json().id as string
    await expect(
      b.comoApi(
        { contaId: org.id, comunidadeId: comA },
        `update uj.musicas set links = '[{"url":"data:text/html,x"}]' where id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: 'UJ103' })
    // O link antigo (uma coluna só) segue a mesma regra quando muda.
    await expect(
      b.comoApi(
        { contaId: org.id, comunidadeId: comA },
        `update uj.musicas set link = 'https://exemplo.test/x' where id = $1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: 'UJ103' })
    await expect(
      b.comoApi(
        { contaId: org.id, comunidadeId: comA },
        `update uj.musicas set links = '[1, 2, 3, 4]'::jsonb where id = $1`,
        [id],
      ),
    ).rejects.toBeDefined()
  })
})

describe('links na música', () => {
  it('a organização grava até 3 links com nome opcional, e a lista e o detalhe os trazem', async () => {
    const r = await nova({
      titulo: 'Firmes na rocha',
      links: [
        { url: `  ${YT}  `, rotulo: '  Versão ao vivo ' },
        { url: DRIVE, rotulo: '' },
        { url: 'https://youtu.be/xyz', rotulo: null },
      ],
    })
    expect(r.statusCode).toBe(200)
    const id = r.json().id as string
    const esperado = [
      { url: YT, rotulo: 'Versão ao vivo' },
      { url: DRIVE },
      { url: 'https://youtu.be/xyz' },
    ]
    expect((await musica(id)).links).toEqual(esperado)
    const lista = (await req('GET', comA, '/conteudos/musicas', org)).json().itens as {
      id: string
      links: unknown
    }[]
    expect(lista.find((m) => m.id === id)?.links).toEqual(esperado)
  })

  it('o link é opcional: sem `links` a lista é vazia', async () => {
    const id = (await nova({ titulo: 'Sem link' })).json().id as string
    expect((await musica(id)).links).toEqual([])
    const id2 = (await nova({ titulo: 'Lista vazia', links: [] })).json().id as string
    expect((await musica(id2)).links).toEqual([])
    const id3 = (await nova({ titulo: 'Nulo', links: null })).json().id as string
    expect((await musica(id3)).links).toEqual([])
  })

  it('editar troca a lista inteira; [] e null apagam; sem o campo, não mexe', async () => {
    const id = (await nova({ titulo: 'Editável', links: [{ url: YT }] })).json().id as string
    let versao = (await musica(id)).versao as number
    const trocar = async (corpo: object) => {
      const r = await req('PATCH', comA, `/conteudos/musicas/${id}`, org, { ...corpo, versao })
      expect(r.statusCode).toBe(200)
      versao = r.json().versao
    }
    await trocar({ links: [{ url: DRIVE, rotulo: 'Cifra' }] })
    expect((await musica(id)).links).toEqual([{ url: DRIVE, rotulo: 'Cifra' }])
    await trocar({ titulo: 'Editável 2' })
    expect((await musica(id)).links).toEqual([{ url: DRIVE, rotulo: 'Cifra' }])
    await trocar({ links: [] })
    expect((await musica(id)).links).toEqual([])
    await trocar({ links: [{ url: YT }] })
    await trocar({ links: null })
    expect((await musica(id)).links).toEqual([])
  })

  it.each([
    ['endereço de outro site', [{ url: 'https://exemplo.test/x' }], /Google Drive ou do YouTube/],
    ['http sem o s', [{ url: 'http://youtu.be/x' }], /começar com https/],
    ['javascript:', [{ url: 'javascript:alert(1)' }], /começar com https/],
    ['data:', [{ url: 'data:text/html;base64,PHNjcmlwdD4=' }], /começar com https/],
    ['usuário e senha na URL', [{ url: 'https://a:b@youtu.be/x' }], /usuário e senha/],
    [
      'servidor disfarçado',
      [{ url: 'https://youtu.be.evil.test/x' }],
      /Google Drive ou do YouTube/,
    ],
    ['espaço no meio', [{ url: 'https://youtu.be/a b' }], /espaços/],
    ['endereço enorme', [{ url: `https://youtu.be/${'a'.repeat(2100)}` }], /muito longo/],
    ['mais de 3 links', [YT, YT, YT, YT].map((url) => ({ url })), /até 3 links/],
    ['nome grande demais', [{ url: YT, rotulo: 'x'.repeat(41) }], /até 40 letras/],
    ['nome com caractere de controle', [{ url: YT, rotulo: 'a\u0007b' }], /caractere que não dá/],
  ])('recusa com 400 e em palavras: %s', async (_nome, links, mensagem) => {
    const r = await nova({ titulo: 'Recusada', links })
    expect(r.statusCode).toBe(400)
    expect(r.json().mensagem).toMatch(mensagem)
    expect(r.json().mensagem).not.toMatch(/too|invalid|expected|received|string|zod/i)
  })

  it('o link antigo (`link`) segue a mesma regra e o corpo errado não passa', async () => {
    expect((await nova({ titulo: 'Antigo bom', link: YT })).statusCode).toBe(200)
    expect((await nova({ titulo: 'Antigo ruim', link: 'https://exemplo.test/x' })).statusCode).toBe(
      400,
    )
    expect((await nova({ titulo: 'Corpo errado', links: 'não é lista' })).statusCode).toBe(400)
    expect((await nova({ titulo: 'Corpo errado', links: [YT] })).statusCode).toBe(400)
  })

  it('a edição também recusa, e nada muda', async () => {
    const id = (await nova({ titulo: 'Fica como está', links: [{ url: YT }] })).json().id as string
    const versao = (await musica(id)).versao as number
    const r = await req('PATCH', comA, `/conteudos/musicas/${id}`, org, {
      versao,
      links: [{ url: 'https://exemplo.test/x' }],
    })
    expect(r.statusCode).toBe(400)
    expect((await musica(id)).links).toEqual([{ url: YT }])
  })

  it('o membro lê os links e não grava', async () => {
    const id = (await nova({ titulo: 'Para o membro', links: [{ url: YT }] })).json().id as string
    expect((await musica(id, membro)).links).toEqual([{ url: YT }])
    const versao = (await musica(id)).versao as number
    expect(
      (await req('PATCH', comA, `/conteudos/musicas/${id}`, membro, { versao, links: [] }))
        .statusCode,
    ).toBe(403)
    expect((await nova({ titulo: 'Do membro', links: [{ url: YT }] }, membro)).statusCode).toBe(403)
    // E o banco, direto: o membro não altera a coluna (a política de gravar pede organizador).
    const alteradas = await b.comoApi(
      { contaId: membro.id, comunidadeId: comA },
      `update uj.musicas set links = '[]'::jsonb where id = $1 returning id`,
      [id],
    )
    expect(alteradas).toEqual([])
    expect((await musica(id)).links).toEqual([{ url: YT }])
  })

  it('isolamento: a organização de B não vê nem altera os links de A (404), e a de A não alcança B', async () => {
    const id = (await nova({ titulo: 'Só de A', links: [{ url: DRIVE }] })).json().id as string
    expect((await req('GET', comA, `/conteudos/musicas/${id}`, orgB)).statusCode).toBe(404)
    expect((await req('GET', comB, `/conteudos/musicas/${id}`, orgB)).statusCode).toBe(404)
    const versao = (await musica(id)).versao as number
    expect(
      (await req('PATCH', comB, `/conteudos/musicas/${id}`, orgB, { versao, links: [] }))
        .statusCode,
    ).toBe(404)
    expect((await musica(id)).links).toEqual([{ url: DRIVE }])
    // Direto no banco, com o contexto de B: a RLS não devolve a linha de A.
    expect(
      await b.comoApi(
        { contaId: orgB.id, comunidadeId: comB },
        'select links from uj.musicas where id = $1',
        [id],
      ),
    ).toEqual([])
  })

  it('o endereço do link nunca vai para a auditoria nem para o log de mudanças', async () => {
    const url = `https://youtu.be/${SEGREDO}`
    const id = (await nova({ titulo: 'Auditada', links: [{ url, rotulo: SEGREDO }] })).json()
      .id as string
    const versao = (await musica(id)).versao as number
    await req('PATCH', comA, `/conteudos/musicas/${id}`, org, {
      versao,
      links: [{ url: `${url}2`, rotulo: SEGREDO }],
    })
    const auditoria = (
      await b.su.query<{ t: string }>(
        `select string_agg(coalesce(detalhes::text, '') || coalesce(recurso_tipo, '') || coalesce(recurso_id::text, ''), ' ') as t
           from uj.auditoria where recurso_id = $1`,
        [id],
      )
    ).rows[0]!.t
    expect(auditoria).toBeTruthy()
    expect(auditoria).not.toContain(SEGREDO)
    const mudancas = (
      await b.su.query<{ t: string }>(
        `select string_agg(row_to_json(m)::text, ' ') as t from uj.mudancas m where registro_id = $1`,
        [id],
      )
    ).rows[0]!.t
    expect(mudancas).toBeTruthy()
    expect(mudancas).not.toContain(SEGREDO)
  })

  it('a resposta de erro nunca repete o endereço enviado', async () => {
    const r = await nova({ titulo: 'Eco', links: [{ url: `https://exemplo.test/${SEGREDO}` }] })
    expect(r.statusCode).toBe(400)
    expect(r.body).not.toContain(SEGREDO)
  })
})

describe('links no repertório, no Meu repertório e no pacote', () => {
  it('a lista do repertório, o pacote e o Meu repertório trazem os links', async () => {
    const id = (
      await nova({ titulo: 'Com links no repertório', links: [{ url: YT }, { url: DRIVE }] })
    ).json().id as string
    expect(
      (await req('POST', comA, `/eventos/${eventoId}/repertorio`, org, { musicaId: id }))
        .statusCode,
    ).toBe(200)
    const lista = (await req('GET', comA, `/eventos/${eventoId}/repertorio`, membro)).json()
      .itens as { musicaId: string; links: unknown }[]
    expect(lista.find((i) => i.musicaId === id)?.links).toEqual([{ url: YT }, { url: DRIVE }])
    const pacote = (await req('GET', comA, `/eventos/${eventoId}/repertorio/pacote`, org)).json()
      .itens as { musicaId: string; links: unknown }[]
    expect(pacote.find((i) => i.musicaId === id)?.links).toEqual([{ url: YT }, { url: DRIVE }])
  })

  it('a versão do pacote muda quando só os links mudam', async () => {
    const id = (await nova({ titulo: 'Versão do pacote', links: [{ url: YT }] })).json()
      .id as string
    await req('POST', comA, `/eventos/${eventoId}/repertorio`, org, { musicaId: id })
    const antes = (await req('GET', comA, `/eventos/${eventoId}/repertorio/pacote`, org)).json()
      .versao as string
    const versao = (await musica(id)).versao as number
    await req('PATCH', comA, `/conteudos/musicas/${id}`, org, { versao, links: [{ url: DRIVE }] })
    const depois = (await req('GET', comA, `/eventos/${eventoId}/repertorio/pacote`, org)).json()
      .versao as string
    expect(depois).not.toBe(antes)
  })
})

describe('cadastrar direto no repertório do encontro', () => {
  const url = () => `/eventos/${eventoId}/repertorio/nova-musica`
  const itens = async (p = org) =>
    (await req('GET', comA, `/eventos/${eventoId}/repertorio`, p)).json().itens as {
      id: string
      ordem: number
      musicaId: string
      titulo: string
      etapaId: string | null
      links: unknown
    }[]

  it('cria a música na biblioteca e a põe no fim do repertório, na etapa do Louvor, numa chamada só', async () => {
    const antes = await itens()
    const r = await req('POST', comA, url(), org, {
      titulo: 'Nova direto',
      artista: 'Ministério Exemplo',
      tom: 'G',
      links: [{ url: YT, rotulo: 'Versão original' }],
    })
    expect(r.statusCode).toBe(200)
    const { musicaId, id, ordem } = r.json()
    expect(ordem).toBe(antes.length)
    const m = await musica(musicaId)
    expect(m).toMatchObject({
      titulo: 'Nova direto',
      artista: 'Ministério Exemplo',
      tom: 'G',
      links: [{ url: YT, rotulo: 'Versão original' }],
    })
    const depois = await itens()
    const item = depois.find((i) => i.id === id)!
    expect(item.musicaId).toBe(musicaId)
    expect(item.ordem).toBe(antes.length)
    expect(item.etapaId).not.toBeNull()
    // Ela também está na biblioteca, para os próximos encontros.
    const biblioteca = (await req('GET', comA, '/conteudos/musicas', membro)).json().itens as {
      id: string
    }[]
    expect(biblioteca.some((x) => x.id === musicaId)).toBe(true)
  })

  it('cifra pede o aceite de direitos, igual à rota de músicas, e nada é criado sem ele', async () => {
    const antes = (await itens()).length
    const semAceite = await req('POST', comA, url(), org, { titulo: 'Com cifra', cifra: '[G]a' })
    expect(semAceite.statusCode).toBe(400)
    expect(semAceite.json().erro).toBe('direitos_nao_confirmados')
    expect((await itens()).length).toBe(antes)
    const comAceite = await req('POST', comA, url(), org, {
      titulo: 'Com cifra',
      cifra: '[G]a',
      direitosConfirmados: true,
    })
    expect(comAceite.statusCode).toBe(200)
    const { rows } = await b.su.query(
      'select direito_confirmado_em from uj.musicas where id = $1',
      [comAceite.json().musicaId],
    )
    expect(rows[0].direito_confirmado_em).not.toBeNull()
  })

  it('link fora da regra: 400 e nenhuma música nem item', async () => {
    const antes = (await itens()).length
    const total = async () =>
      (
        await b.su.query('select count(*)::int as n from uj.musicas where comunidade_id = $1', [
          comA,
        ])
      ).rows[0].n as number
    const musicasAntes = await total()
    const r = await req('POST', comA, url(), org, {
      titulo: 'Recusada',
      links: [{ url: 'https://exemplo.test/x' }],
    })
    expect(r.statusCode).toBe(400)
    expect((await itens()).length).toBe(antes)
    expect(await total()).toBe(musicasAntes)
  })

  it('é uma transação só: se o repertório falha, a música não fica na biblioteca', async () => {
    const musicasAntes = (
      await b.su.query('select count(*)::int as n from uj.musicas where comunidade_id = $1', [comA])
    ).rows[0].n as number
    // Etapa que não é deste encontro: o item é recusado (404) depois de a música ser inserida.
    const etapaDeB = (
      await b.su.query('select id from uj.etapas where comunidade_id = $1 limit 1', [comB])
    ).rows[0].id as string
    const r = await req('POST', comA, url(), org, { titulo: 'Desfeita', etapaId: etapaDeB })
    expect(r.statusCode).toBe(404)
    const musicasDepois = (
      await b.su.query('select count(*)::int as n from uj.musicas where comunidade_id = $1', [comA])
    ).rows[0].n as number
    expect(musicasDepois).toBe(musicasAntes)
  })

  it('só quem organiza: o membro leva 403 e nada é criado', async () => {
    const antes = (await itens()).length
    const r = await req('POST', comA, url(), membro, { titulo: 'Do membro' })
    expect(r.statusCode).toBe(403)
    expect((await itens()).length).toBe(antes)
  })

  it('isolamento: encontro de B pela comunidade de A é 404; a organização de B não cadastra em A', async () => {
    const musicasDeA = async () =>
      (
        await b.su.query('select count(*)::int as n from uj.musicas where comunidade_id = $1', [
          comA,
        ])
      ).rows[0].n as number
    const antes = await musicasDeA()
    expect(
      (
        await req('POST', comA, `/eventos/${eventoDeB}/repertorio/nova-musica`, org, {
          titulo: 'Invasão',
        })
      ).statusCode,
    ).toBe(404)
    expect((await req('POST', comA, url(), orgB, { titulo: 'Invasão' })).statusCode).toBe(404)
    expect((await req('POST', comB, url(), org, { titulo: 'Invasão' })).statusCode).toBe(404)
    expect(await musicasDeA()).toBe(antes)
    const deB = (
      await b.su.query('select count(*)::int as n from uj.repertorio_itens where evento_id = $1', [
        eventoDeB,
      ])
    ).rows[0].n as number
    expect(deB).toBe(0)
  })

  it('o título é obrigatório e a auditoria leva só ids', async () => {
    expect((await req('POST', comA, url(), org, { titulo: '' })).statusCode).toBe(400)
    const r = await req('POST', comA, url(), org, {
      titulo: 'Auditoria',
      links: [{ url: `https://youtu.be/${SEGREDO}` }],
    })
    expect(r.statusCode).toBe(200)
    const { rows } = await b.su.query<{ acao: string; t: string }>(
      `select acao, coalesce(detalhes::text, '') as t from uj.auditoria where recurso_id in ($1, $2)`,
      [r.json().musicaId, eventoId],
    )
    expect(rows.map((x) => x.acao)).toEqual(
      expect.arrayContaining(['conteudo.criado', 'repertorio.item_adicionado']),
    )
    expect(rows.map((x) => x.t).join(' ')).not.toContain(SEGREDO)
  })
})
