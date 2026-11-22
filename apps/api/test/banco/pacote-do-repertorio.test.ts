import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Pacote do repertório para usar sem internet (D66, fatia 2 do modo músico):
 * `GET /eventos/:eventoId/repertorio/pacote`. Quem recebe (organização e quem
 * toca no encontro), versão e ETag (304 sem corpo), validade, isolamento A e B
 * e a cifra só dentro da comunidade (sem cache, sem auditoria).
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let org: Pessoa
let orgB: Pessoa
let violao: Pessoa
let recusou: Pessoa
let plateia: Pessoa
let eventoId: string
let rascunhoId: string
const v: Record<string, string> = {}

const CIFRA = '{key: G}\n[G]Sobre a rocha eu [D]firmo\n[Em]Quando o vento [C]vem'
const DIA = 86_400_000

type Metodo = 'GET' | 'POST' | 'PATCH'
const req = (
  metodo: Metodo,
  com: string,
  caminho: string,
  p: Pessoa,
  corpo?: object,
  headers: Record<string, string> = {},
) =>
  app.inject({
    method: metodo,
    url: `/api/v1/c/${com}${caminho}`,
    headers: { ...p.auth, ...headers },
    ...(corpo ? { payload: corpo } : {}),
  })

const pacote = (p: Pessoa, id = eventoId, headers: Record<string, string> = {}, com = comA) =>
  req('GET', com, `/eventos/${id}/repertorio/pacote`, p, undefined, headers)

async function novaMusica(titulo: string, cifra = CIFRA): Promise<{ id: string; versao: number }> {
  const r = await req('POST', comA, '/conteudos/musicas', org, {
    titulo,
    tom: 'G',
    cifra,
    link: 'https://youtu.be/exemplo123',
    direitosConfirmados: true,
  })
  expect(r.statusCode).toBe(200)
  return { id: r.json().id, versao: r.json().versao ?? 1 }
}

async function novoEncontro(titulo: string, publicar: boolean): Promise<string> {
  const r = await req('POST', comA, '/eventos', org, {
    titulo,
    categoria: 'Programação de sábado',
    inicio: new Date(Date.now() + 6 * DIA).toISOString(),
    duracaoMin: 120,
  })
  const id = r.json().id as string
  await req('POST', comA, `/eventos/${id}/etapas`, org, { titulo: 'Louvor', duracaoMin: 20 })
  if (publicar) await req('POST', comA, `/eventos/${id}/status`, org, { status: 'publicado' })
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
  violao = await pessoaComSessao(b, app, config, 'Violonista')
  recusou = await pessoaComSessao(b, app, config, 'Recusou')
  plateia = await pessoaComSessao(b, app, config, 'Plateia')
  await vincular(b, org.id, comA, 'organizador')
  await vincular(b, orgB.id, comB, 'organizador')
  v['violao'] = await vincular(b, violao.id, comA, 'membro')
  v['recusou'] = await vincular(b, recusou.id, comA, 'membro')
  await vincular(b, plateia.id, comA, 'membro')

  eventoId = await novoEncontro('Sábado do pacote', true)
  rascunhoId = await novoEncontro('Rascunho do pacote', false)
  const m1 = await novaMusica('Sobre a rocha')
  const m2 = await novaMusica('Grande é o Senhor', '{key: A}\n[A]Grande é o [E]Senhor')
  v['musica1'] = m1.id
  v['musica2'] = m2.id
  for (const [id, tom] of [
    [m1.id, 'A'],
    [m2.id, null],
  ] as const) {
    const r = await req('POST', comA, `/eventos/${eventoId}/repertorio`, org, {
      musicaId: id,
      ...(tom ? { tomDoDia: tom } : {}),
    })
    expect(r.statusCode).toBe(200)
  }
  await req('POST', comA, `/eventos/${rascunhoId}/repertorio`, org, { musicaId: m1.id })
  for (const [pessoa, estado] of [
    [v['violao'], 'pendente'],
    [v['recusou'], 'recusada'],
  ] as const) {
    await b.dono.query(
      `insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id, funcao, estado)
       values ($1, $2, $3, 'Violão', $4), ($1, $5, $3, 'Violão', $4)`,
      [comA, eventoId, pessoa, estado, rascunhoId],
    )
  }
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

describe('quem recebe o pacote', () => {
  it('a organização recebe tudo: músicas, cifras, tons do dia e link, na ordem', async () => {
    const r = await pacote(org)
    expect(r.statusCode).toBe(200)
    const j = r.json()
    expect(j.evento).toMatchObject({
      id: eventoId,
      titulo: 'Sábado do pacote',
      status: 'publicado',
    })
    expect(j.itens.map((i: { titulo: string }) => i.titulo)).toEqual([
      'Sobre a rocha',
      'Grande é o Senhor',
    ])
    expect(j.itens[0]).toMatchObject({
      ordem: 0,
      tomDoDia: 'A',
      tomOriginal: 'G',
      cifra: CIFRA,
      link: 'https://youtu.be/exemplo123',
      musicaId: v['musica1'],
    })
    expect(j.itens[1]).toMatchObject({ ordem: 1, tomDoDia: null })
    expect(j.minhaParte).toEqual([])
    expect(j.versao).toMatch(/^[0-9a-f]{32}$/)
    expect(j.validadeDias).toBeGreaterThan(0)
    expect(new Date(j.validoAte).getTime()).toBeGreaterThan(Date.now())
  })

  it('quem toca neste encontro (aceita, pendente ou com troca pedida) recebe, com a sua parte', async () => {
    const r = await pacote(violao)
    expect(r.statusCode).toBe(200)
    expect(r.json().minhaParte).toEqual([{ funcao: 'Violão', estado: 'pendente' }])
    expect(r.json().itens[0].cifra).toBe(CIFRA)
    await b.dono.query(
      `update uj.atribuicoes set estado = 'substituicao_pedida' where vinculo_id = $1`,
      [v['violao']],
    )
    expect((await pacote(violao)).statusCode).toBe(200)
    await b.dono.query(`update uj.atribuicoes set estado = 'confirmada' where vinculo_id = $1`, [
      v['violao'],
    ])
    expect((await pacote(violao)).json().minhaParte[0].estado).toBe('confirmada')
  })

  it('quem recusou e quem não toca recebem 403 (a lista sem cifra segue aberta)', async () => {
    for (const p of [recusou, plateia]) {
      const r = await pacote(p)
      expect(r.statusCode).toBe(403)
      expect(r.json().erro).toBe('fora_do_louvor')
      expect(r.body).not.toContain('Sobre a rocha')
      expect(r.body).not.toContain('[G]')
    }
    const lista = await req('GET', comA, `/eventos/${eventoId}/repertorio`, plateia)
    expect(lista.statusCode).toBe(200)
    expect(JSON.stringify(lista.json())).not.toContain('Sobre a rocha eu')
  })

  it('a função de banda vale mesmo sem a etapa Louvor: convocado ao encontro todo como Bateria', async () => {
    const outro = await pessoaComSessao(b, app, config, 'Baterista')
    const vOutro = await vincular(b, outro.id, comA, 'membro')
    await b.dono.query(
      `insert into uj.atribuicoes (comunidade_id, evento_id, vinculo_id, funcao, estado)
       values ($1, $2, $3, 'Bateria', 'confirmada')`,
      [comA, eventoId, vOutro],
    )
    expect((await pacote(outro)).statusCode).toBe(200)
  })

  it('rascunho: a organização vê; quem toca ainda não (404, o encontro não está no ar)', async () => {
    expect((await pacote(org, rascunhoId)).statusCode).toBe(200)
    expect((await pacote(violao, rascunhoId)).statusCode).toBe(404)
  })

  it('repertório vazio: itens vazios, não erro', async () => {
    const vazio = await novoEncontro('Sem músicas', true)
    const r = await pacote(org, vazio)
    expect(r.statusCode).toBe(200)
    expect(r.json().itens).toEqual([])
  })
})

describe('versão e ETag', () => {
  it('o ETag é a versão; com If-None-Match igual, 304 sem corpo (e sem cifra no ar)', async () => {
    const r = await pacote(org)
    const etag = r.headers['etag'] as string
    expect(etag).toBe(`"${r.json().versao}"`)
    const igual = await pacote(org, eventoId, { 'if-none-match': etag })
    expect(igual.statusCode).toBe(304)
    expect(igual.body).toBe('')
    expect(igual.headers['etag']).toBe(etag)
    // Para quem toca, a versão é a do SEU pacote (a parte dele entra no conteúdo).
    const dele = await pacote(violao)
    expect(dele.headers['etag']).not.toBe(etag)
    expect(
      (await pacote(violao, eventoId, { 'if-none-match': dele.headers['etag'] as string }))
        .statusCode,
    ).toBe(304)
    // Sem cabeçalho condicional: `?versao=` com a versão conhecida devolve só "inalterado".
    const igualPorConsulta = await req(
      'GET',
      comA,
      `/eventos/${eventoId}/repertorio/pacote?versao=${r.json().versao}`,
      org,
    )
    expect(igualPorConsulta.statusCode).toBe(200)
    expect(igualPorConsulta.json()).toEqual({ versao: r.json().versao, inalterado: true })
    const diferente = await req(
      'GET',
      comA,
      `/eventos/${eventoId}/repertorio/pacote?versao=${'0'.repeat(32)}`,
      org,
    )
    expect(diferente.json().itens).toHaveLength(2)
    // Versão de outro pacote não vale: manda o conteúdo.
    expect((await pacote(violao, eventoId, { 'if-none-match': etag })).statusCode).toBe(200)
  })

  it('mudar o tom do dia, a ordem ou a cifra muda a versão; o resto não', async () => {
    const v0 = (await pacote(org)).json().versao as string
    // Chamar de novo, sem mudar nada: mesma versão (o "geradoEm" não entra).
    expect((await pacote(org)).json().versao).toBe(v0)

    const itens = (await req('GET', comA, `/eventos/${eventoId}/repertorio`, org)).json().itens as {
      id: string
      versao: number
    }[]
    const tom = await req('PATCH', comA, `/eventos/${eventoId}/repertorio/${itens[1]!.id}`, org, {
      tomDoDia: 'B',
    })
    expect(tom.statusCode).toBe(200)
    const v1 = (await pacote(org)).json().versao as string
    expect(v1).not.toBe(v0)

    const ordem = await app.inject({
      method: 'PUT',
      url: `/api/v1/c/${comA}/eventos/${eventoId}/repertorio/ordem`,
      headers: org.auth,
      payload: { ids: [itens[1]!.id, itens[0]!.id] },
    })
    expect(ordem.statusCode).toBe(200)
    const v2 = (await pacote(org)).json()
    expect(v2.versao).not.toBe(v1)
    expect(v2.itens.map((i: { titulo: string }) => i.titulo)).toEqual([
      'Grande é o Senhor',
      'Sobre a rocha',
    ])

    const cifra = await req('PATCH', comA, `/conteudos/musicas/${v['musica1']}`, org, {
      versao: 1,
      cifra: '{key: G}\n[G]Outra letra',
      direitosConfirmados: true,
    })
    expect(cifra.statusCode).toBe(200)
    const v3 = (await pacote(org)).json()
    expect(v3.versao).not.toBe(v2.versao)
    expect(v3.itens.find((i: { titulo: string }) => i.titulo === 'Sobre a rocha').cifra).toContain(
      'Outra letra',
    )
  })
})

describe('direitos autorais e privacidade', () => {
  it('sem cache, sem auditoria da leitura e sem cifra em lugar nenhum além da resposta', async () => {
    const antes = (await b.su.query('select count(*)::int as n from uj.auditoria')).rows[0].n
    const r = await pacote(org)
    expect(r.headers['cache-control']).toBe('no-store')
    expect((await b.su.query('select count(*)::int as n from uj.auditoria')).rows[0].n).toBe(antes)
    // O log de mudanças e a auditoria só têm ids: nenhuma linha leva letra de música.
    const { rows } = await b.su.query<{ t: string }>(
      `select (select string_agg(detalhes::text, ' ') from uj.auditoria) as t`,
    )
    expect(rows[0]!.t ?? '').not.toMatch(/Sobre a rocha|Outra letra|firmo/)
  })
})

describe('isolamento', () => {
  it('B não alcança o pacote de A (404), e A não alcança o de B', async () => {
    expect((await pacote(orgB, eventoId, {}, comA)).statusCode).toBe(404)
    expect((await pacote(orgB, eventoId, {}, comB)).statusCode).toBe(404)
    expect((await pacote(org, eventoId, {}, comB)).statusCode).toBe(404)
    const deB = await b.dono.query<{ id: string }>(
      `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, status, criado_por)
       values ($1, 'Encontro de B', 'Outra', now() + interval '2 days', 60, 'America/Sao_Paulo', 'publicado', $2)
       returning id`,
      [comB, orgB.id],
    )
    expect((await pacote(org, deB.rows[0]!.id)).statusCode).toBe(404)
    expect((await pacote(orgB, deB.rows[0]!.id, {}, comB)).statusCode).toBe(200)
  })

  it('o banco barra música de B no repertório de A, mesmo com a API contornada', async () => {
    const musicaDeB = await b.dono.query<{ id: string }>(
      `insert into uj.musicas (comunidade_id, titulo, criado_por) values ($1, 'Música de B', $2) returning id`,
      [comB, orgB.id],
    )
    await expect(
      b.dono.query(
        `insert into uj.repertorio_itens (comunidade_id, evento_id, musica_id, ordem) values ($1, $2, $3, 9)`,
        [comA, eventoId, musicaDeB.rows[0]!.id],
      ),
    ).rejects.toMatchObject({ code: '23503' })
    expect((await pacote(org)).body).not.toContain('Música de B')
  })

  it('sem sessão: 401', async () => {
    const r = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${comA}/eventos/${eventoId}/repertorio/pacote`,
    })
    expect(r.statusCode).toBe(401)
  })
})
