import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { aoNotificar, type EventosDeNotificacao } from '../../src/notificacoes/ganchos.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let com: string
let admin: Pessoa
let org: Pessoa
let ana: Pessoa
let bia: Pessoa
let vinculoDaBia: string

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
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
  com = await criarComunidade(b, 'Jovens Conteúdo')
  admin = await pessoaComSessao(b, app, config, 'Admin')
  org = await pessoaComSessao(b, app, config, 'Organizadora')
  ana = await pessoaComSessao(b, app, config, 'Ana')
  bia = await pessoaComSessao(b, app, config, 'Bia')
  await vincular(b, admin.id, com, 'admin')
  await vincular(b, org.id, com, 'organizador')
  await vincular(b, ana.id, com, 'membro')
  vinculoDaBia = await vincular(b, bia.id, com, 'membro')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

// ==================================================================== sugestões

describe('sugestões', () => {
  it('anônima: organizadores e admin não sabem quem foi; a autora sabe; o sistema guarda', async () => {
    const r = await req('POST', '/sugestoes', ana, {
      titulo: 'Mais louvor',
      texto: 'Que tal dois cânticos a mais?',
      anonima: true,
    })
    expect(r.statusCode).toBe(200)
    const id = r.json().id as string
    expect(r.json()).toMatchObject({ status: 'recebida', anonima: true })

    for (const quem of [org, admin]) {
      const lista = (await req('GET', '/sugestoes', quem)).json().sugestoes
      const s = lista.find((x: { id: string }) => x.id === id)
      expect(s).toMatchObject({ anonima: true, autorNome: null, minha: false })
      expect(JSON.stringify(s)).not.toContain('Ana')
      expect(JSON.stringify(s)).not.toContain(ana.id)
      expect((await req('GET', `/sugestoes/${id}`, quem)).json().autorNome).toBeNull()
    }
    const daAutora = (await req('GET', `/sugestoes/${id}`, ana)).json()
    expect(daAutora).toMatchObject({ autorNome: 'Ana', minha: true })

    // Outra pessoa da comunidade não vê sugestão alheia.
    expect(
      (await req('GET', '/sugestoes', bia)).json().sugestoes.map((x: { id: string }) => x.id),
    ).not.toContain(id)
    expect((await req('GET', `/sugestoes/${id}`, bia)).statusCode).toBe(404)

    // No banco, a API não consegue nem pedir a coluna da autoria.
    const erro = await b
      .comoApi({ contaId: admin.id, comunidadeId: com }, 'select autor_conta_id from uj.sugestoes')
      .then(
        () => '',
        (e: Error) => e.message,
      )
    expect(erro).toMatch(/permission denied/)
    // Nem pelo log de mudanças ou pela auditoria.
    const mud = await b.comoApi<{ conta_alvo: string | null }>(
      { contaId: admin.id, comunidadeId: com },
      "select conta_alvo from uj.mudancas where tabela = 'sugestoes' and registro_id = $1",
      [id],
    )
    expect(mud.length).toBeGreaterThan(0)
    expect(mud.every((m) => m.conta_alvo === null)).toBe(true)
    const aud = await b.su.query(
      'select count(*)::int as n from uj.auditoria where recurso_id = $1',
      [id],
    )
    expect(aud.rows[0].n).toBe(0)
    // Mas o sistema guarda a autoria.
    const { rows } = await b.su.query('select autor_conta_id from uj.sugestoes where id = $1', [id])
    expect(rows[0].autor_conta_id).toBe(ana.id)
  })

  it('não anônima mostra a autora para quem modera', async () => {
    const id = (
      await req('POST', '/sugestoes', bia, { titulo: 'Retiro', texto: 'Um retiro em março' })
    ).json().id
    expect((await req('GET', `/sugestoes/${id}`, org)).json()).toMatchObject({
      anonima: false,
      autorNome: 'Bia',
    })
  })

  it('moderação a partir de organizador, com resposta para a autora', async () => {
    const id = (
      await req('POST', '/sugestoes', ana, { titulo: 'Lanche', texto: 'Lanche depois do culto' })
    ).json().id
    expect((await req('PATCH', `/sugestoes/${id}`, bia, { status: 'aceita' })).statusCode).toBe(403)
    expect((await req('PATCH', `/sugestoes/${id}`, ana, { status: 'aceita' })).statusCode).toBe(403)
    const r = await req('PATCH', `/sugestoes/${id}`, org, {
      status: 'em_analise',
      resposta: 'Vamos ver o orçamento.',
    })
    expect(r.json()).toMatchObject({ status: 'em_analise', resposta: 'Vamos ver o orçamento.' })
    // Versão antiga: conflito.
    expect(
      (await req('PATCH', `/sugestoes/${id}`, org, { status: 'aceita', versao: 1 })).statusCode,
    ).toBe(409)
    const vista = (await req('GET', `/sugestoes/${id}`, ana)).json()
    expect(vista).toMatchObject({
      status: 'em_analise',
      resposta: 'Vamos ver o orçamento.',
      respondidaPorNome: 'Organizadora',
    })
    const filtradas = (await req('GET', '/sugestoes?status=em_analise', org)).json().sugestoes
    expect(filtradas.map((x: { id: string }) => x.id)).toContain(id)
    expect((await req('DELETE', `/sugestoes/${id}`, ana)).statusCode).toBe(403)
    expect((await req('DELETE', `/sugestoes/${id}`, org)).json()).toEqual({ ok: true })
  })
})

// ==================================================================== avisos

describe('avisos', () => {
  it('rascunho só para organizadores; publicar avisa a F14 e libera para membros', async () => {
    const anunciados: EventosDeNotificacao['aviso_publicado'][] = []
    const parar = aoNotificar('aviso_publicado', (d) => anunciados.push(d))
    try {
      expect(
        (await req('POST', '/avisos', ana, { titulo: 'Tentativa', texto: 'Não pode' })).statusCode,
      ).toBe(403)
      const criado = await req('POST', '/avisos', org, {
        titulo: 'Ensaio no sábado',
        texto: 'Ensaio às 15h no salão.',
      })
      expect(criado.json()).toMatchObject({ estado: 'rascunho', fixado: false })
      const id = criado.json().id as string
      expect(anunciados).toEqual([])
      expect((await req('GET', `/avisos/${id}`, ana)).statusCode).toBe(404)
      expect(
        (await req('GET', '/avisos', ana)).json().avisos.map((a: { id: string }) => a.id),
      ).not.toContain(id)
      // Fixar só depois de publicar.
      expect(
        (await req('PATCH', `/avisos/${id}`, org, { versao: 1, fixado: true })).statusCode,
      ).toBe(409)

      const publicado = await req('POST', `/avisos/${id}/publicar`, org)
      expect(publicado.json()).toMatchObject({ estado: 'publicado' })
      expect(publicado.json().publicadoEm).not.toBeNull()
      expect(anunciados).toEqual([{ comunidadeId: com, avisoId: id, contaId: org.id }])
      // Publicar de novo não anuncia de novo.
      await req('POST', `/avisos/${id}/publicar`, org)
      expect(anunciados).toHaveLength(1)

      const fixado = await req('PATCH', `/avisos/${id}`, org, {
        versao: publicado.json().versao + 1,
        fixado: true,
      })
      expect(fixado.statusCode).toBe(200)
      const doMembro = (await req('GET', '/avisos', ana)).json().avisos
      expect(doMembro[0]).toMatchObject({ id, fixado: true, autorNome: 'Organizadora' })
      expect((await req('GET', '/inicio', ana)).json().avisos[0]).toMatchObject({
        id,
        fixado: true,
      })

      // Membro não edita nem despublica.
      expect((await req('POST', `/avisos/${id}/despublicar`, ana)).statusCode).toBe(403)
      const despublicado = await req('POST', `/avisos/${id}/despublicar`, org)
      expect(despublicado.json()).toMatchObject({ estado: 'despublicado', fixado: false })
      expect((await req('GET', `/avisos/${id}`, ana)).statusCode).toBe(404)
      expect((await req('GET', '/inicio', ana)).json().avisos).toEqual([])
      expect((await req('DELETE', `/avisos/${id}`, org)).json()).toEqual({ ok: true })
    } finally {
      parar()
    }
  })

  it('aviso vencido some para membros e continua para organizadores', async () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString()
    const id = (
      await req('POST', '/avisos', org, {
        titulo: 'Inscrições abertas',
        texto: 'Até ontem.',
        publicar: true,
        visivelAte: ontem,
      })
    ).json().id
    expect((await req('GET', `/avisos/${id}`, ana)).statusCode).toBe(404)
    expect((await req('GET', `/avisos/${id}`, org)).statusCode).toBe(200)
  })
})

// ==================================================================== conteúdos

describe('conteúdos', () => {
  it('organizador cadastra música, músico e quem toca; membro só lê', async () => {
    expect((await req('POST', '/conteudos/musicas', ana, { titulo: 'Tentativa' })).statusCode).toBe(
      403,
    )
    const musica = await req('POST', '/conteudos/musicas', org, {
      titulo: 'Grande é o Senhor',
      artista: 'Ministério Exemplo',
      tom: 'G',
      link: 'https://exemplo.test/musica',
      cifra: 'G D Em C',
    })
    expect(musica.statusCode).toBe(200)
    const musicaId = musica.json().id as string
    expect(
      (await req('POST', '/conteudos/musicas', org, { titulo: 'X', link: 'http://inseguro' }))
        .statusCode,
    ).toBe(400)

    const musico = await req('POST', '/conteudos/musicos', org, {
      nome: 'Bia',
      instrumentos: ['violão', 'voz'],
      vinculoId: vinculoDaBia,
    })
    const musicoId = musico.json().id as string
    // Vínculo de outra comunidade: recusado pelo banco.
    const outra = await criarComunidade(b, 'Outra')
    const estranha = await pessoaComSessao(b, app, config, 'Estranha')
    const vinculoEstranho = await vincular(b, estranha.id, outra, 'membro')
    expect(
      (
        await req('POST', '/conteudos/musicos', org, {
          nome: 'Estranha',
          vinculoId: vinculoEstranho,
        })
      ).statusCode,
    ).toBe(400)

    expect(
      (await req('PUT', `/conteudos/musicas/${musicaId}/musicos`, ana, { musicoIds: [musicoId] }))
        .statusCode,
    ).toBe(403)
    const quem = await req('PUT', `/conteudos/musicas/${musicaId}/musicos`, org, {
      musicoIds: [musicoId, musicoId],
    })
    expect(quem.json()).toEqual({ musicos: [{ id: musicoId, nome: 'Bia' }] })

    const lista = (await req('GET', '/conteudos/musicas', ana)).json().itens
    expect(lista[0]).toMatchObject({
      id: musicaId,
      titulo: 'Grande é o Senhor',
      tom: 'G',
      musicos: [{ id: musicoId, nome: 'Bia' }],
    })
    expect(lista[0].cifra).toBeUndefined()
    expect((await req('GET', `/conteudos/musicas/${musicaId}`, ana)).json().cifra).toBe('G D Em C')
    expect((await req('GET', `/conteudos/musicos/${musicoId}`, ana)).json().instrumentos).toEqual([
      'violão',
      'voz',
    ])

    // Edição com versão; versão velha = 409.
    const editado = await req('PATCH', `/conteudos/musicas/${musicaId}`, org, {
      versao: 1,
      tom: 'A',
      arquivada: true,
    })
    expect(editado.json()).toMatchObject({ versao: 2 })
    expect(
      (await req('PATCH', `/conteudos/musicas/${musicaId}`, org, { versao: 1, tom: 'C' }))
        .statusCode,
    ).toBe(409)
    expect(
      (await req('PATCH', `/conteudos/musicas/${musicaId}`, ana, { versao: 2, tom: 'C' }))
        .statusCode,
    ).toBe(403)

    // Excluir o músico tira ele da música.
    expect((await req('DELETE', `/conteudos/musicos/${musicoId}`, org)).json()).toEqual({
      ok: true,
    })
    expect((await req('GET', `/conteudos/musicas/${musicaId}`, ana)).json().musicos).toEqual([])
  })

  it('palestrantes e dinâmicas: cadastro, leitura e exclusão', async () => {
    const p = await req('POST', '/conteudos/palestrantes', org, {
      nome: 'Pr. Exemplo',
      temas: 'Juventude e propósito',
      origem: 'Igreja Central',
    })
    const d = await req('POST', '/conteudos/dinamicas', org, {
      titulo: 'Quebra-gelo',
      objetivo: 'Integrar quem chegou',
      instrucoes: 'Em roda, cada um diz o nome e uma comida.',
      duracaoMin: 10,
    })
    expect(p.statusCode).toBe(200)
    expect(d.statusCode).toBe(200)
    expect((await req('GET', '/conteudos/palestrantes', ana)).json().itens[0]).toMatchObject({
      nome: 'Pr. Exemplo',
      ativo: true,
    })
    const dinamicas = (await req('GET', '/conteudos/dinamicas', ana)).json().itens
    expect(dinamicas[0]).toMatchObject({ titulo: 'Quebra-gelo', duracaoMin: 10 })
    expect(dinamicas[0].instrucoes).toBeUndefined()
    expect((await req('DELETE', `/conteudos/dinamicas/${d.json().id}`, ana)).statusCode).toBe(403)
    expect((await req('DELETE', `/conteudos/dinamicas/${d.json().id}`, admin)).statusCode).toBe(200)
  })
})
