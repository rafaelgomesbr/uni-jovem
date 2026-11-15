import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import {
  emBase64,
  FABRICANTE_SECRETO,
  imagem,
  jpegComGps,
  pngQueDeclara,
} from '../apoio/imagens.ts'
import { pessoaComSessao, SENHA_PADRAO, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Foto de perfil e logotipo da comunidade (D33, migração 0018): tipo pelo
 * conteúdo, regravação sem metadados, limites, acesso só dentro da comunidade,
 * permissão do logotipo, ETag e 304, exclusão e exportação.
 */

const config = carregarConfig(envDeTeste())

let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comA: string
let comB: string
let adminA: Pessoa
let membroA: Pessoa
let organizadorA: Pessoa
let pessoaB: Pessoa
let vMembroA: string
let vPessoaB: string

type Metodo = 'GET' | 'PUT' | 'DELETE'
const req = (
  metodo: Metodo,
  url: string,
  p: Pessoa | null,
  corpo?: object,
  cabecalhos: Record<string, string> = {},
) =>
  app.inject({
    method: metodo,
    url,
    headers: { ...(p ? p.auth : {}), ...cabecalhos },
    ...(corpo ? { payload: corpo } : {}),
  })

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio: correioDesligado(),
    fatorDeLimitePorIp: 100,
  })
  await app.ready()
  comA = await criarComunidade(b, 'Comunidade A')
  comB = await criarComunidade(b, 'Comunidade B')
  adminA = await pessoaComSessao(b, app, config, 'Admin A')
  membroA = await pessoaComSessao(b, app, config, 'Membro A')
  organizadorA = await pessoaComSessao(b, app, config, 'Organizador A')
  pessoaB = await pessoaComSessao(b, app, config, 'Pessoa B')
  await vincular(b, adminA.id, comA, 'admin')
  vMembroA = await vincular(b, membroA.id, comA, 'membro')
  await vincular(b, organizadorA.id, comA, 'organizador')
  vPessoaB = await vincular(b, pessoaB.id, comB, 'admin')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

// ================================================================ envio e regravação

describe('foto de perfil: envio e regravação', () => {
  it('JSON com base64 vira WebP de até 512 px, servido com ETag e cache privado', async () => {
    const p = await pessoaComSessao(b, app, config, 'Envia Foto')
    const r = await req('PUT', '/api/v1/eu/foto', p, {
      imagem: emBase64(await imagem('png', 1200, 800)),
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      temFoto: true,
      tipo: 'image/webp',
      largura: 512,
      altura: 341,
    })
    const versao = r.json().fotoVersao as string
    expect(versao).toMatch(/^[0-9a-f]{16}$/)

    const g = await req('GET', '/api/v1/eu/foto', p)
    expect(g.statusCode).toBe(200)
    expect(g.headers['content-type']).toBe('image/webp')
    expect(g.headers['cache-control']).toBe('private, no-cache')
    expect(g.headers['x-content-type-options']).toBe('nosniff')
    const bytes = g.rawPayload
    expect(g.headers['etag']).toBe(`"${sha256(bytes)}"`)
    expect(sha256(bytes).startsWith(versao)).toBe(true)
    expect(bytes.length).toBeLessThanOrEqual(300 * 1024)
    const meta = await sharp(bytes).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 512, 341])

    const eu = (await req('GET', '/api/v1/eu', p)).json()
    expect(eu.conta).toMatchObject({ temFoto: true, fotoVersao: versao })
  })

  it('aceita o prefixo data: (o tipo declarado nele é ignorado) e imagem pequena não é ampliada', async () => {
    const p = await pessoaComSessao(b, app, config, 'Prefixo Data')
    const r = await req('PUT', '/api/v1/eu/foto', p, {
      imagem: `data:image/gif;base64,${emBase64(await imagem('webp', 100, 80))}`,
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ largura: 100, altura: 80, tipo: 'image/webp' })
  })

  it('remove o EXIF com GPS (e aplica a orientação dele antes)', async () => {
    const p = await pessoaComSessao(b, app, config, 'Foto Com Gps')
    // Orientação 6: a câmera gravou deitada; a foto "de pé" é 800 × 1200.
    const entrada = await jpegComGps(1200, 800, 6)
    const antes = await sharp(entrada).metadata()
    expect(antes.exif).toBeDefined()
    expect(antes.orientation).toBe(6)
    expect(entrada.includes('Exif\0\0')).toBe(true)
    expect(entrada.includes(FABRICANTE_SECRETO)).toBe(true)

    const r = await req('PUT', '/api/v1/eu/foto', p, { imagem: emBase64(entrada) })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ largura: 341, altura: 512 })

    const guardada = (
      await b.su.query<{ conteudo: Buffer }>(
        'select conteudo from uj.fotos_contas where conta_id = $1',
        [p.id],
      )
    ).rows[0]!.conteudo
    const servida = (await req('GET', '/api/v1/eu/foto', p)).rawPayload
    expect(servida.equals(guardada)).toBe(true)
    for (const marca of ['Exif', 'EXIF', 'XMP ', 'ICCP', FABRICANTE_SECRETO]) {
      expect(guardada.includes(marca), marca).toBe(false)
    }
    const depois = await sharp(guardada).metadata()
    expect(depois.exif).toBeUndefined()
    expect(depois.xmp).toBeUndefined()
    expect(depois.icc).toBeUndefined()
    expect(depois.orientation).toBeUndefined()
  })

  it('tipo falso é recusado pelo conteúdo: texto renomeado, GIF, SVG (415)', async () => {
    const p = await pessoaComSessao(b, app, config, 'Tipo Falso')
    const casos = [
      `data:image/jpeg;base64,${emBase64(Buffer.from('isto é um texto renomeado para foto.jpg'))}`,
      emBase64(await imagem('gif', 40, 40)),
      emBase64(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>')),
      emBase64(Buffer.from('%PDF-1.7 não é imagem')),
    ]
    for (const imagemFalsa of casos) {
      const r = await req('PUT', '/api/v1/eu/foto', p, { imagem: imagemFalsa })
      expect(r.statusCode, imagemFalsa.slice(0, 30)).toBe(415)
      expect(r.json().erro).toBe('tipo_de_imagem_nao_aceito')
    }
    expect(
      (await b.su.query('select 1 from uj.fotos_contas where conta_id = $1', [p.id])).rows,
    ).toEqual([])
  })

  it('imagem corrompida ou base64 inválido é recusado (400), sem gravar nada', async () => {
    const p = await pessoaComSessao(b, app, config, 'Imagem Corrompida')
    const jpeg = await imagem('jpeg', 300, 300)
    const png = await imagem('png', 300, 300)
    const casos = [
      // JPEG cortado no meio: a assinatura está certa, os pixels não.
      emBase64(jpeg.subarray(0, Math.floor(jpeg.length / 2))),
      // Assinatura de PNG seguida de lixo.
      emBase64(Buffer.concat([png.subarray(0, 8), Buffer.alloc(200, 0x41)])),
      // PNG com os dados de pixel danificados.
      emBase64(Buffer.concat([png.subarray(0, 60), Buffer.alloc(64, 0xff), png.subarray(124)])),
      'isto não é base64 !!!',
    ]
    for (const corrompida of casos) {
      const r = await req('PUT', '/api/v1/eu/foto', p, { imagem: corrompida })
      expect(r.statusCode, corrompida.slice(0, 30)).toBe(400)
      expect(r.json().erro).toBe('imagem_invalida')
    }
    expect(
      (await b.su.query('select 1 from uj.fotos_contas where conta_id = $1', [p.id])).rows,
    ).toEqual([])
  })

  it('tamanho acima do limite é recusado (413): mais de 2 MB, corpo acima do teto e "pixel flood"', async () => {
    const p = await pessoaComSessao(b, app, config, 'Grande Demais')
    // JPEG válido seguido de enchimento até 2 MB + 1 byte.
    const jpeg = await imagem('jpeg', 64, 64)
    const doisMbEUm = Buffer.concat([jpeg, Buffer.alloc(2 * 1024 * 1024 + 1 - jpeg.length)])
    const r1 = await req('PUT', '/api/v1/eu/foto', p, { imagem: emBase64(doisMbEUm) })
    expect(r1.statusCode).toBe(413)
    expect(r1.json().erro).toBe('imagem_grande_demais')

    // Corpo acima de 3 MB: o Fastify recusa antes de ler o JSON.
    const r2 = await req('PUT', '/api/v1/eu/foto', p, { imagem: 'A'.repeat(4 * 1024 * 1024) })
    expect(r2.statusCode).toBe(413)
    expect(r2.json().erro).toBe('grande_demais')

    // Poucos bytes declarando 50 000 × 50 000 pixels.
    const r3 = await req('PUT', '/api/v1/eu/foto', p, {
      imagem: emBase64(pngQueDeclara(50_000, 50_000)),
    })
    expect(r3.statusCode).toBe(413)
    expect(r3.json().erro).toBe('imagem_grande_demais')

    expect(
      (await b.su.query('select 1 from uj.fotos_contas where conta_id = $1', [p.id])).rows,
    ).toEqual([])
  })

  it('o banco recusa conteúdo que não é WebP/JPEG ou com hash que não confere', async () => {
    const p = await pessoaComSessao(b, app, config, 'Direto No Banco')
    const lixo = Buffer.from('nao e imagem nenhuma, so texto')
    await expect(
      b.comoApi(
        { contaId: p.id },
        `insert into uj.fotos_contas (conta_id, conteudo, tipo, hash)
         values ($1, $2, 'image/webp', sha256($2))`,
        [p.id, lixo],
      ),
    ).rejects.toMatchObject({ code: '23514' })
    const webp = await imagem('webp', 20, 20)
    await expect(
      b.comoApi(
        { contaId: p.id },
        `insert into uj.fotos_contas (conta_id, conteudo, tipo, hash)
         values ($1, $2, 'image/webp', sha256('outra coisa'::bytea))`,
        [p.id, webp],
      ),
    ).rejects.toMatchObject({ code: '23514' })
    // E a foto de outra conta, nem com conteúdo válido (RLS).
    await expect(
      b.comoApi(
        { contaId: p.id },
        `insert into uj.fotos_contas (conta_id, conteudo, tipo, hash)
         values ($1, $2, 'image/webp', sha256($2))`,
        [membroA.id, webp],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('remover a foto é idempotente e audita só o fato, sem conteúdo', async () => {
    const p = await pessoaComSessao(b, app, config, 'Remove Foto')
    await req('PUT', '/api/v1/eu/foto', p, { imagem: emBase64(await imagem('jpeg', 50, 50)) })
    const d1 = await req('DELETE', '/api/v1/eu/foto', p)
    expect(d1.statusCode).toBe(200)
    expect(d1.json()).toEqual({ temFoto: false, fotoVersao: null })
    expect((await req('DELETE', '/api/v1/eu/foto', p)).statusCode).toBe(200)
    expect((await req('GET', '/api/v1/eu/foto', p)).statusCode).toBe(404)
    expect((await req('GET', '/api/v1/eu', p)).json().conta).toMatchObject({
      temFoto: false,
      fotoVersao: null,
    })
    const { rows } = await b.su.query<{ acao: string; detalhes: unknown; comunidade_id: string }>(
      `select acao, detalhes, comunidade_id from uj.auditoria
        where conta_id = $1 and acao = 'conta.foto_alterada' order by id`,
      [p.id],
    )
    expect(rows).toEqual([
      { acao: 'conta.foto_alterada', detalhes: { removida: false }, comunidade_id: null },
      { acao: 'conta.foto_alterada', detalhes: { removida: true }, comunidade_id: null },
    ])
  })

  it('limite de escrita por conta: depois de 20 envios ou remoções na hora, 429 com Retry-After', async () => {
    const p = await pessoaComSessao(b, app, config, 'Muitas Trocas')
    for (let i = 0; i < 20; i++) {
      expect((await req('DELETE', '/api/v1/eu/foto', p)).statusCode).toBe(200)
    }
    const r = await req('PUT', '/api/v1/eu/foto', p, {
      imagem: emBase64(await imagem('jpeg', 50, 50)),
    })
    expect(r.statusCode).toBe(429)
    expect(r.json().erro).toBe('muitas_escritas')
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('sem sessão: 401 antes de ler o corpo', async () => {
    const r = await req('PUT', '/api/v1/eu/foto', null, { imagem: 'A'.repeat(4 * 1024 * 1024) })
    expect(r.statusCode).toBe(401)
    expect((await req('GET', '/api/v1/eu/foto', null)).statusCode).toBe(401)
    expect((await req('DELETE', '/api/v1/eu/foto', null)).statusCode).toBe(401)
  })
})

// ================================================================ foto vista pelos outros

describe('foto de outra pessoa: só dentro da comunidade', () => {
  let fotoDoMembro: string

  beforeAll(async () => {
    const r1 = await req('PUT', '/api/v1/eu/foto', membroA, {
      imagem: emBase64(await imagem('jpeg', 400, 400)),
    })
    expect(r1.statusCode).toBe(200)
    fotoDoMembro = r1.json().fotoVersao as string
    const r2 = await req('PUT', '/api/v1/eu/foto', pessoaB, {
      imagem: emBase64(await imagem('png', 400, 400)),
    })
    expect(r2.statusCode).toBe(200)
  })

  it('quem é da comunidade vê a foto de um vínculo ativo, e a lista traz temFoto e fotoVersao', async () => {
    const r = await req('GET', `/api/v1/c/${comA}/pessoas/${vMembroA}/foto`, adminA)
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toBe('image/webp')
    expect(sha256(r.rawPayload).startsWith(fotoDoMembro)).toBe(true)
    // A própria pessoa também, pelo mesmo caminho.
    expect(
      (await req('GET', `/api/v1/c/${comA}/pessoas/${vMembroA}/foto`, membroA)).statusCode,
    ).toBe(200)

    const membros = (await req('GET', `/api/v1/c/${comA}/membros`, membroA)).json().membros as {
      vinculoId: string
      temFoto: boolean
      fotoVersao: string | null
    }[]
    expect(membros.find((m) => m.vinculoId === vMembroA)).toMatchObject({
      temFoto: true,
      fotoVersao: fotoDoMembro,
    })
    const semFoto = membros.find((m) => m.vinculoId !== vMembroA)!
    expect(semFoto).toMatchObject({ temFoto: false, fotoVersao: null })
  })

  it('pessoa de outra comunidade: 404 por qualquer caminho', async () => {
    // A pede a foto de B pela comunidade A (vínculo de B no caminho).
    for (const quem of [membroA, adminA]) {
      const r = await req('GET', `/api/v1/c/${comA}/pessoas/${vPessoaB}/foto`, quem)
      expect(r.statusCode).toBe(404)
      expect(r.headers['content-type']).toContain('application/json')
    }
    // A pede pela comunidade B, da qual não faz parte.
    expect(
      (await req('GET', `/api/v1/c/${comB}/pessoas/${vPessoaB}/foto`, adminA)).statusCode,
    ).toBe(404)
    // B pede a foto de A.
    expect(
      (await req('GET', `/api/v1/c/${comB}/pessoas/${vMembroA}/foto`, pessoaB)).statusCode,
    ).toBe(404)
    expect(
      (await req('GET', `/api/v1/c/${comA}/pessoas/${vMembroA}/foto`, pessoaB)).statusCode,
    ).toBe(404)
    // Id que não é UUID ou que não existe.
    for (const id of ['nao-e-uuid', '00000000-0000-4000-8000-000000000000']) {
      expect((await req('GET', `/api/v1/c/${comA}/pessoas/${id}/foto`, adminA)).statusCode).toBe(
        404,
      )
    }
  })

  it('mesma conta nas duas comunidades: o vínculo de B não serve na comunidade A', async () => {
    const dupla = await pessoaComSessao(b, app, config, 'Pessoa Dupla')
    await vincular(b, dupla.id, comA, 'membro')
    const vEmB = await vincular(b, dupla.id, comB, 'membro')
    await req('PUT', '/api/v1/eu/foto', dupla, { imagem: emBase64(await imagem('jpeg', 60, 60)) })
    expect((await req('GET', `/api/v1/c/${comA}/pessoas/${vEmB}/foto`, adminA)).statusCode).toBe(
      404,
    )
    expect((await req('GET', `/api/v1/c/${comB}/pessoas/${vEmB}/foto`, pessoaB)).statusCode).toBe(
      200,
    )
  })

  it('vínculo desativado: a foto some para todos (404) e a lista do admin traz temFoto falso', async () => {
    const saindo = await pessoaComSessao(b, app, config, 'Vai Ser Desativada')
    const v = await vincular(b, saindo.id, comA, 'membro')
    await req('PUT', '/api/v1/eu/foto', saindo, { imagem: emBase64(await imagem('png', 60, 60)) })
    expect((await req('GET', `/api/v1/c/${comA}/pessoas/${v}/foto`, membroA)).statusCode).toBe(200)
    const d = await app.inject({
      method: 'PATCH',
      url: `/api/v1/c/${comA}/membros/${v}`,
      headers: adminA.auth,
      payload: { estado: 'desativado' },
    })
    expect(d.statusCode).toBe(200)
    expect((await req('GET', `/api/v1/c/${comA}/pessoas/${v}/foto`, membroA)).statusCode).toBe(404)
    expect((await req('GET', `/api/v1/c/${comA}/pessoas/${v}/foto`, adminA)).statusCode).toBe(404)
    const membros = (await req('GET', `/api/v1/c/${comA}/membros`, adminA)).json().membros as {
      vinculoId: string
      temFoto: boolean
    }[]
    expect(membros.find((m) => m.vinculoId === v)).toMatchObject({ temFoto: false })
    // A desativada continua vendo a própria foto em /eu/foto.
    expect((await req('GET', '/api/v1/eu/foto', saindo)).statusCode).toBe(200)
  })

  it('trocar a foto anuncia a mudança da conta no log de sincronização da comunidade', async () => {
    const { rows } = await b.su.query(
      `select 1 from uj.mudancas
        where comunidade_id = $1 and tabela = 'contas' and registro_id = $2`,
      [comA, membroA.id],
    )
    expect(rows.length).toBeGreaterThan(0)
  })
})

// ================================================================ ETag e 304

describe('ETag e 304', () => {
  it('If-None-Match igual devolve 304 sem corpo, nas três leituras', async () => {
    const p = await pessoaComSessao(b, app, config, 'Etag Pessoa')
    const vp = await vincular(b, p.id, comA, 'membro')
    await req('PUT', '/api/v1/eu/foto', p, { imagem: emBase64(await imagem('jpeg', 90, 90)) })
    await req('PUT', `/api/v1/c/${comA}/logo`, adminA, {
      imagem: emBase64(await imagem('png', 90, 90)),
    })
    const leituras: [string, Pessoa][] = [
      ['/api/v1/eu/foto', p],
      [`/api/v1/c/${comA}/pessoas/${vp}/foto`, membroA],
      [`/api/v1/c/${comA}/logo`, membroA],
    ]
    for (const [url, quem] of leituras) {
      const primeira = await req('GET', url, quem)
      expect(primeira.statusCode, url).toBe(200)
      const etag = primeira.headers['etag'] as string
      expect(etag).toMatch(/^"[0-9a-f]{64}"$/)

      for (const cabecalho of [etag, `W/${etag}`, `"${'0'.repeat(64)}", ${etag}`, '*']) {
        const r = await req('GET', url, quem, undefined, { 'if-none-match': cabecalho })
        expect(r.statusCode, `${url} ${cabecalho}`).toBe(304)
        expect(r.rawPayload.length).toBe(0)
        expect(r.headers['etag']).toBe(etag)
        expect(r.headers['cache-control']).toBe('private, no-cache')
      }
      const outra = await req('GET', url, quem, undefined, {
        'if-none-match': `"${'0'.repeat(64)}"`,
      })
      expect(outra.statusCode).toBe(200)
      expect(outra.rawPayload.length).toBeGreaterThan(0)
    }
  })

  it('depois da troca, o ETag antigo recebe a imagem nova (200)', async () => {
    const p = await pessoaComSessao(b, app, config, 'Etag Troca')
    await req('PUT', '/api/v1/eu/foto', p, { imagem: emBase64(await imagem('jpeg', 70, 70)) })
    const antiga = (await req('GET', '/api/v1/eu/foto', p)).headers['etag'] as string
    await req('PUT', '/api/v1/eu/foto', p, { imagem: emBase64(await imagem('png', 120, 60)) })
    const r = await req('GET', '/api/v1/eu/foto', p, undefined, { 'if-none-match': antiga })
    expect(r.statusCode).toBe(200)
    expect(r.headers['etag']).not.toBe(antiga)
    expect((await sharp(r.rawPayload).metadata()).width).toBe(120)
  })

  it('o ETag de uma conta não vira 304 para outra conta na mesma URL', async () => {
    const um = await pessoaComSessao(b, app, config, 'Etag Um')
    const dois = await pessoaComSessao(b, app, config, 'Etag Dois')
    await req('PUT', '/api/v1/eu/foto', um, { imagem: emBase64(await imagem('jpeg', 80, 80)) })
    await req('PUT', '/api/v1/eu/foto', dois, { imagem: emBase64(await imagem('png', 81, 81)) })
    const etagDeUm = (await req('GET', '/api/v1/eu/foto', um)).headers['etag'] as string
    const r = await req('GET', '/api/v1/eu/foto', dois, undefined, { 'if-none-match': etagDeUm })
    expect(r.statusCode).toBe(200)
  })
})

// ================================================================ logotipo

describe('logotipo da comunidade', () => {
  it('membro e organizador não trocam nem removem o logotipo (403); o admin troca', async () => {
    const corpo = { imagem: emBase64(await imagem('png', 600, 600)) }
    for (const quem of [membroA, organizadorA]) {
      const put = await req('PUT', `/api/v1/c/${comA}/logo`, quem, corpo)
      expect(put.statusCode).toBe(403)
      expect(put.json().erro).toBe('sem_permissao')
      expect((await req('DELETE', `/api/v1/c/${comA}/logo`, quem)).statusCode).toBe(403)
    }
    // Nem por fora da API: o papel do app recusa a escrita de membro (RLS).
    await expect(
      b.comoApi(
        { contaId: membroA.id, comunidadeId: comA },
        'delete from uj.logos_comunidades where comunidade_id = $1 returning 1',
        [comA],
      ),
    ).resolves.toEqual([])

    const r = await req('PUT', `/api/v1/c/${comA}/logo`, adminA, corpo)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ temLogo: true, largura: 512, altura: 512, tipo: 'image/webp' })
    const versao = r.json().logoVersao as string

    const g = await req('GET', `/api/v1/c/${comA}/logo`, membroA)
    expect(g.statusCode).toBe(200)
    expect(g.headers['content-type']).toBe('image/webp')
    expect(sha256(g.rawPayload).startsWith(versao)).toBe(true)

    const com = (await req('GET', `/api/v1/c/${comA}`, membroA)).json()
    expect(com).toMatchObject({ temLogo: true, logoVersao: versao })
    const eu = (await req('GET', '/api/v1/eu', membroA)).json()
    expect(eu.comunidades.find((c: { id: string }) => c.id === comA)).toMatchObject({
      temLogo: true,
      logoVersao: versao,
    })

    const aud = await b.su.query<{ detalhes: unknown; conta_id: string }>(
      `select detalhes, conta_id from uj.auditoria
        where comunidade_id = $1 and acao = 'comunidade.logo_alterado' order by id desc limit 1`,
      [comA],
    )
    expect(aud.rows[0]).toEqual({ detalhes: { removido: false }, conta_id: adminA.id })
    const mud = await b.su.query(
      `select 1 from uj.mudancas where comunidade_id = $1 and tabela = 'comunidades' and registro_id = $1`,
      [comA],
    )
    expect(mud.rows.length).toBeGreaterThan(0)
  })

  it('o logotipo só é servido a quem é da comunidade (404 para os outros)', async () => {
    await req('PUT', `/api/v1/c/${comA}/logo`, adminA, {
      imagem: emBase64(await imagem('jpeg', 100, 100)),
    })
    expect((await req('GET', `/api/v1/c/${comA}/logo`, pessoaB)).statusCode).toBe(404)
    expect((await req('PUT', `/api/v1/c/${comA}/logo`, pessoaB, { imagem: 'x' })).statusCode).toBe(
      404,
    )
    // Nem direto no banco, sem a comunidade no contexto.
    expect(
      await b.comoApi(
        { contaId: pessoaB.id },
        'select 1 from uj.logos_comunidades where comunidade_id = $1',
        [comA],
      ),
    ).toEqual([])
    // B sem logotipo: 404 e temLogo falso.
    expect((await req('GET', `/api/v1/c/${comB}/logo`, pessoaB)).statusCode).toBe(404)
    expect((await req('GET', `/api/v1/c/${comB}`, pessoaB)).json()).toMatchObject({
      temLogo: false,
      logoVersao: null,
    })
  })

  it('remover o logotipo: 404 depois, temLogo falso, e auditoria do fato', async () => {
    const outra = await criarComunidade(b, 'Comunidade Que Remove')
    await vincular(b, adminA.id, outra, 'admin')
    await req('PUT', `/api/v1/c/${outra}/logo`, adminA, {
      imagem: emBase64(await imagem('webp', 64, 64)),
    })
    const d = await req('DELETE', `/api/v1/c/${outra}/logo`, adminA)
    expect(d.statusCode).toBe(200)
    expect(d.json()).toEqual({ temLogo: false, logoVersao: null })
    expect((await req('GET', `/api/v1/c/${outra}/logo`, adminA)).statusCode).toBe(404)
    expect((await req('GET', `/api/v1/c/${outra}`, adminA)).json()).toMatchObject({
      temLogo: false,
    })
    const aud = await b.su.query<{ detalhes: unknown }>(
      `select detalhes from uj.auditoria
        where comunidade_id = $1 and acao = 'comunidade.logo_alterado' order by id`,
      [outra],
    )
    expect(aud.rows.map((r) => r.detalhes)).toEqual([{ removido: false }, { removido: true }])
  })

  it('comunidade suspensa: dá para ver, não para trocar (409)', async () => {
    const suspensa = await criarComunidade(b, 'Comunidade Suspensa')
    await vincular(b, adminA.id, suspensa, 'admin')
    // Como o dono do banco (o mesmo caminho dos jobs): só o Criador suspende pela API.
    await b.dono.query("update uj.comunidades set estado = 'suspensa' where id = $1", [suspensa])
    const r = await req('PUT', `/api/v1/c/${suspensa}/logo`, adminA, {
      imagem: emBase64(await imagem('png', 64, 64)),
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toBe('comunidade_suspensa')
  })
})

// ================================================================ exclusão e exportação

describe('exclusão e exportação', () => {
  it('exportar meus dados inclui a foto em base64 (e nulo sem foto)', async () => {
    const p = await pessoaComSessao(b, app, config, 'Exporta Foto')
    const sem = (await req('GET', '/api/v1/eu/exportar', p)).json()
    expect(sem.conta.foto).toBeNull()
    await req('PUT', '/api/v1/eu/foto', p, { imagem: emBase64(await imagem('jpeg', 100, 100)) })
    const r = await req('GET', '/api/v1/eu/exportar', p)
    expect(r.statusCode).toBe(200)
    const foto = r.json().conta.foto
    const servida = (await req('GET', '/api/v1/eu/foto', p)).rawPayload
    expect(foto).toMatchObject({ tipo: 'image/webp', bytes: servida.length })
    expect(Buffer.from(foto.conteudoBase64 as string, 'base64').equals(servida)).toBe(true)
    expect(r.json().leiaMe.join(' ')).toContain('conta.foto')
  })

  it('excluir a conta apaga a foto: some do banco, da lista e do caminho da comunidade', async () => {
    const p = await pessoaComSessao(b, app, config, 'Exclui Com Foto')
    const v = await vincular(b, p.id, comA, 'membro')
    await req('PUT', '/api/v1/eu/foto', p, { imagem: emBase64(await imagem('jpeg', 100, 100)) })
    expect((await req('GET', `/api/v1/c/${comA}/pessoas/${v}/foto`, membroA)).statusCode).toBe(200)

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/eu/excluir-conta',
      headers: p.auth,
      payload: { senha: SENHA_PADRAO },
    })
    expect(r.statusCode).toBe(200)
    await app.emAndamento()

    expect(
      (await b.su.query('select 1 from uj.fotos_contas where conta_id = $1', [p.id])).rows,
    ).toEqual([])
    expect((await req('GET', `/api/v1/c/${comA}/pessoas/${v}/foto`, adminA)).statusCode).toBe(404)
    const membros = (await req('GET', `/api/v1/c/${comA}/membros`, adminA)).json().membros as {
      vinculoId: string
      temFoto: boolean
    }[]
    const linha = membros.find((m) => m.vinculoId === v)
    if (linha) expect(linha.temFoto).toBe(false)
  })
})
