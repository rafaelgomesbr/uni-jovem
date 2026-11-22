import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { novoBanco, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { emBase64, imagem } from '../apoio/imagens.ts'
import { pessoaComSessao, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Prévia pública do código da comunidade (D66, migração 0028): `POST
 * /api/auth/codigo/previa`. Só o necessário (nome, cor, logotipo, pessoas, modo
 * de entrada e próximo encontro público), o mesmo 404 para tudo que não é um
 * código que entra, limite por IP e nada de dado pessoal.
 */

const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let admin: Pessoa
let id: string
let codigo: string
let limitado: ReturnType<typeof criarServidor>

const CORPO = { cor: '#5B4BDB', aceiteDoTermoDoAdmin: true, consentimentoFe: true }
const previa = (corpo: unknown, servidor = app) =>
  servidor.inject({ method: 'POST', url: '/api/auth/codigo/previa', payload: corpo as object })

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  admin = await pessoaComSessao(b, app, config, 'Administradora Secreta')
  await b.su.query(
    "update uj.contas set faixa_etaria = '18_mais', whatsapp = '+5511999990000' where id = $1",
    [admin.id],
  )
  const r = await app.inject({
    method: 'POST',
    url: '/api/v1/comunidades',
    headers: admin.auth,
    payload: { nome: 'Jovens Esperança', cidade: 'Campinas', ...CORPO },
  })
  expect(r.statusCode).toBe(200)
  id = r.json().id
  codigo = r.json().codigo
})

afterAll(async () => {
  await limitado?.close()
  await app.close()
  await b.encerrar()
})

describe('prévia do código', () => {
  it('sem conta: nome, cor, pessoas, modo de entrada e nada além disso', async () => {
    const r = await previa({ codigo })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      comunidade: {
        nome: 'Jovens Esperança',
        cor: '#5B4BDB',
        temLogo: false,
        pessoas: 1,
        modoEntrada: 'codigo_com_aprovacao',
        proximoEncontro: null,
      },
    })
    // Nada pessoal, nada de identificador, cidade, contato ou administrador.
    const corpo = r.body
    expect(corpo).not.toMatch(/Campinas|Secreta|5511|@|"id"|idPublico/)
    expect(r.headers['cache-control']).toBe('no-store')
  })

  it('aceita o código como a pessoa o digita (minúsculo, com espaço ou traço)', async () => {
    const digitado = `${codigo.slice(0, 4)} ${codigo.slice(4)}`.toLowerCase()
    expect((await previa({ codigo: digitado })).statusCode).toBe(200)
    expect((await previa({ codigo: `${codigo.slice(0, 4)}-${codigo.slice(4)}` })).statusCode).toBe(
      200,
    )
  })

  it('conta só quem está ativo e mostra o logotipo e o modo direto', async () => {
    const ana = await pessoaComSessao(b, app, config, 'Ana')
    const desativada = await pessoaComSessao(b, app, config, 'Desativada')
    await b.dono.query(
      `insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, 'membro')`,
      [ana.id, id],
    )
    await b.dono.query(
      `insert into uj.vinculos (conta_id, comunidade_id, papel, estado) values ($1, $2, 'membro', 'desativado')`,
      [desativada.id, id],
    )
    const logo = await app.inject({
      method: 'PUT',
      url: `/api/v1/c/${id}/logo`,
      headers: admin.auth,
      payload: { imagem: emBase64(await imagem('png', 32, 32)) },
    })
    expect(logo.statusCode).toBe(200)
    await b.su.query(`update uj.comunidades set modo_entrada = 'codigo_direto' where id = $1`, [id])
    expect((await previa({ codigo })).json().comunidade).toMatchObject({
      pessoas: 2,
      temLogo: true,
      modoEntrada: 'codigo_direto',
    })
  })

  it('próximo encontro público: só de comunidade verificada, publicado e futuro; interno nunca', async () => {
    const evento = async (
      titulo: string,
      quando: string,
      visibilidade: string,
      status = 'publicado',
    ) =>
      b.dono.query(
        `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, status,
                                 criado_por, visibilidade)
         values ($1, $2, 'Outra', now() + $3::interval, 60, 'America/Sao_Paulo', $4, $5, $6)`,
        [id, titulo, quando, status, admin.id, visibilidade],
      )
    await evento('Encontro interno', '1 day', 'interna')
    // Comunidade nova (não verificada) não tem página pública: nem o evento aparece na prévia.
    expect((await previa({ codigo })).json().comunidade.proximoEncontro).toBeNull()
    await b.dono.query(`update uj.comunidades set verificacao = 'verificada' where id = $1`, [id])
    expect((await previa({ codigo })).json().comunidade.proximoEncontro).toBeNull()
    await evento('Público em rascunho', '2 days', 'publica', 'rascunho')
    await evento('Público já passou', '-2 days', 'publica')
    expect((await previa({ codigo })).json().comunidade.proximoEncontro).toBeNull()
    await evento('Noite aberta', '10 days', 'publica')
    await evento('Noite aberta depois', '20 days', 'publica')
    const p = (await previa({ codigo })).json().comunidade.proximoEncontro
    expect(p).toMatchObject({ titulo: 'Noite aberta', fuso: 'America/Sao_Paulo' })
    expect(Object.keys(p).sort()).toEqual(['fuso', 'inicio', 'titulo'])
    // Desverificada, a página pública some, e a prévia também deixa de mostrar o encontro.
    await b.dono.query(`update uj.comunidades set verificacao = 'nova' where id = $1`, [id])
    expect((await previa({ codigo })).json().comunidade.proximoEncontro).toBeNull()
    await b.dono.query(`update uj.comunidades set verificacao = 'verificada' where id = $1`, [id])
  })

  it('o mesmo 404 para código desconhecido, mal formado ou trocado', async () => {
    const desconhecido = await previa({ codigo: 'ZZZZ2222' })
    expect(desconhecido.statusCode).toBe(404)
    const respostas = [
      desconhecido,
      await previa({ codigo: 'abc' }),
      await previa({ codigo: 'ÇÇÇÇÇÇÇÇ' }),
      await previa({ codigo: `${codigo}${codigo}` }),
    ]
    // Troca do código: o antigo deixa de valer na hora.
    const troca = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${id}/codigo/trocar`,
      headers: admin.auth,
    })
    expect(troca.statusCode).toBe(200)
    respostas.push(await previa({ codigo }))
    const novo = troca.json().codigo as string
    expect((await previa({ codigo: novo })).statusCode).toBe(200)
    for (const r of respostas) {
      expect(r.statusCode).toBe(404)
      expect(r.json()).toEqual(desconhecido.json())
    }
    expect(desconhecido.json().erro).toBe('nao_encontrado')
    await b.su.query(
      `update uj.comunidades set modo_entrada = 'codigo_com_aprovacao' where id = $1`,
      [id],
    )
  })

  it('comunidade suspensa ou arquivada não tem prévia', async () => {
    const atual = (
      await app.inject({ method: 'GET', url: `/api/v1/c/${id}/codigo`, headers: admin.auth })
    ).json().codigo as string
    expect((await previa({ codigo: atual })).statusCode).toBe(200)
    await b.dono.query(`update uj.comunidades set estado = 'suspensa' where id = $1`, [id])
    expect((await previa({ codigo: atual })).statusCode).toBe(404)
    await b.dono.query(`update uj.comunidades set estado = 'ativa' where id = $1`, [id])
  })

  it('corpo inválido: 400 humano, sem consultar o banco', async () => {
    for (const corpo of [{}, { codigo: 123 }, { codigo: 'x'.repeat(41) }]) {
      const r = await previa(corpo)
      expect(r.statusCode).toBe(400)
      expect(r.json().erro).toBe('dados_invalidos')
    }
  })

  it('limite por IP: depois de 20 tentativas em 15 min, 429 com Retry-After', async () => {
    limitado = criarServidor(config, {
      api: b.api,
      auth: b.auth,
      correio: correioDesligado(),
      // O IP dos testes é um só: sem o fator, vale o limite de verdade.
    })
    await limitado.ready()
    let ultimo = 0
    for (let i = 0; i < 20; i++)
      ultimo = (await previa({ codigo: 'ZZZZ2222' }, limitado)).statusCode
    expect(ultimo).toBe(404)
    const barrado = await previa({ codigo: 'ZZZZ2222' }, limitado)
    expect(barrado.statusCode).toBe(429)
    expect(barrado.headers['retry-after']).toBeDefined()
    expect(barrado.json().erro).toBe('muitas_tentativas')
  })

  it('não grava nada: nem auditoria, nem sessão, nem o código em tabela alguma', async () => {
    const antes = (await b.su.query('select count(*)::int as n from uj.auditoria')).rows[0].n
    await previa({ codigo })
    expect((await b.su.query('select count(*)::int as n from uj.auditoria')).rows[0].n).toBe(antes)
  })

  it('banco: o papel da API executa a função, mas ela não devolve comunidade com hmac errado', async () => {
    const linhas = await b.comoApi(
      { contaId: null, comunidadeId: null },
      `select * from uj.previa_do_codigo(sha256('nada'::bytea))`,
    )
    expect(linhas).toEqual([])
  })
})
