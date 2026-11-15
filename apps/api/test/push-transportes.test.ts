import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import http2 from 'node:http2'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodeJwt, decodeProtectedHeader } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { transporteApns } from '../src/notificacoes/apns.ts'
import { transporteFcm, type ContaDeServico } from '../src/notificacoes/fcm.ts'
import {
  transporteEmArquivo,
  transportePorPlataforma,
  type MensagemPush,
} from '../src/notificacoes/transportes.ts'

/**
 * Transportes de push contra servidores falsos locais (sem rede, sem chave
 * real): o formato do pedido, o JWT e a tradução das respostas de erro.
 */

const mensagem = (extra: Partial<MensagemPush> = {}): MensagemPush => ({
  token: 'a'.repeat(64),
  plataforma: 'ios',
  ambienteApns: 'producao',
  titulo: 'Novo aviso',
  corpo: 'Há um aviso novo na sua comunidade.',
  dados: { comunidadeId: 'c1', tipo: 'avisos', notificacaoId: 'n1' },
  ...extra,
})

describe('FCM HTTP v1', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const conta: ContaDeServico = {
    project_id: 'uni-jovem-teste',
    client_email: 'push@uni-jovem-teste.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    token_uri: 'https://oauth.teste/token',
  }

  function falso(respostaDoEnvio: () => Response) {
    const pedidos: { url: string; init: RequestInit }[] = []
    const buscar = (async (url: string, init: RequestInit) => {
      pedidos.push({ url, init })
      if (url === conta.token_uri) {
        return new Response(JSON.stringify({ access_token: 'acesso-1', expires_in: 3600 }))
      }
      return respostaDoEnvio()
    }) as unknown as typeof fetch
    return { pedidos, buscar }
  }

  it('troca o JWT RS256 da conta de serviço por token e envia com visibilidade privada', async () => {
    const f = falso(() => new Response('{}', { status: 200 }))
    const t = transporteFcm({ conta, buscar: f.buscar })
    expect(
      await t.enviar(mensagem({ plataforma: 'android', token: 'token-fcm-1234567890' })),
    ).toEqual({ resultado: 'enviado' })
    const oauth = new URLSearchParams(String(f.pedidos[0]!.init.body))
    expect(oauth.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    const jwt = oauth.get('assertion')!
    expect(decodeProtectedHeader(jwt).alg).toBe('RS256')
    expect(decodeJwt(jwt)).toMatchObject({
      iss: conta.client_email,
      aud: conta.token_uri,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    })
    expect(f.pedidos[1]!.url).toBe(
      'https://fcm.googleapis.com/v1/projects/uni-jovem-teste/messages:send',
    )
    const corpo = JSON.parse(String(f.pedidos[1]!.init.body))
    expect(corpo.message.token).toBe('token-fcm-1234567890')
    expect(corpo.message.android.notification.visibility).toBe('PRIVATE')
    expect((f.pedidos[1]!.init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer acesso-1',
    )
    // O token de acesso é reaproveitado.
    await t.enviar(mensagem({ plataforma: 'android' }))
    expect(f.pedidos.filter((p) => p.url === conta.token_uri)).toHaveLength(1)
  })

  it('UNREGISTERED expurga o token; 503 tenta de novo; 400 falha sem expurgar', async () => {
    const naoRegistrado = falso(
      () =>
        new Response(
          JSON.stringify({
            error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] },
          }),
          { status: 404 },
        ),
    )
    expect(
      (await transporteFcm({ conta, buscar: naoRegistrado.buscar }).enviar(mensagem())).resultado,
    ).toBe('token_invalido')
    const fora = falso(() => new Response('{}', { status: 503 }))
    expect((await transporteFcm({ conta, buscar: fora.buscar }).enviar(mensagem())).resultado).toBe(
      'tentar_de_novo',
    )
    const ruim = falso(
      () =>
        new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 }),
    )
    expect((await transporteFcm({ conta, buscar: ruim.buscar }).enviar(mensagem())).resultado).toBe(
      'falhou',
    )
  })
})

describe('APNs por HTTP/2', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const chavePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  let servidor: http2.Http2Server
  let origem: string
  const recebidos: { cabecalhos: http2.IncomingHttpHeaders; corpo: string }[] = []
  let proximaResposta: { status: number; corpo?: string } = { status: 200 }

  beforeAll(async () => {
    servidor = http2.createServer()
    servidor.on('stream', (fluxo, cabecalhos) => {
      let corpo = ''
      fluxo.setEncoding('utf8')
      fluxo.on('data', (p: string) => (corpo += p))
      fluxo.on('end', () => {
        recebidos.push({ cabecalhos, corpo })
        fluxo.respond({ ':status': proximaResposta.status })
        fluxo.end(proximaResposta.corpo ?? '')
      })
    })
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r))
    origem = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise<void>((r) => servidor.close(() => r()))
  })

  const transporte = () =>
    transporteApns({
      chavePem,
      chaveId: 'FXV5399926',
      timeId: '8DVJ2U5ZKX',
      topico: 'com.solerte.unijovem.hml',
      origens: { producao: origem, sandbox: origem },
    })

  it('envia com JWT ES256 do provedor, tópico e tipo alerta', async () => {
    proximaResposta = { status: 200 }
    const t = transporte()
    expect(await t.enviar(mensagem())).toEqual({ resultado: 'enviado' })
    await t.encerrar!()
    const r = recebidos.at(-1)!
    expect(r.cabecalhos[':path']).toBe(`/3/device/${'a'.repeat(64)}`)
    expect(r.cabecalhos['apns-topic']).toBe('com.solerte.unijovem.hml')
    expect(r.cabecalhos['apns-push-type']).toBe('alert')
    const jwt = String(r.cabecalhos['authorization']).replace(/^bearer /, '')
    expect(decodeProtectedHeader(jwt)).toMatchObject({ alg: 'ES256', kid: 'FXV5399926' })
    expect(decodeJwt(jwt).iss).toBe('8DVJ2U5ZKX')
    const corpo = JSON.parse(r.corpo)
    expect(corpo.aps.alert).toEqual({
      title: 'Novo aviso',
      body: 'Há um aviso novo na sua comunidade.',
    })
  })

  it('410 e BadDeviceToken expurgam; 503 tenta de novo; token fora do formato nem sai', async () => {
    const t = transporte()
    proximaResposta = { status: 410, corpo: JSON.stringify({ reason: 'Unregistered' }) }
    expect((await t.enviar(mensagem())).resultado).toBe('token_invalido')
    proximaResposta = { status: 400, corpo: JSON.stringify({ reason: 'BadDeviceToken' }) }
    expect((await t.enviar(mensagem())).resultado).toBe('token_invalido')
    proximaResposta = { status: 503, corpo: JSON.stringify({ reason: 'ServiceUnavailable' }) }
    expect((await t.enviar(mensagem())).resultado).toBe('tentar_de_novo')
    const antes = recebidos.length
    expect((await t.enviar(mensagem({ token: 'nao-hex' }))).resultado).toBe('token_invalido')
    expect(recebidos.length).toBe(antes)
    await t.encerrar!()
  })
})

describe('transporte em arquivo e por plataforma', () => {
  it('grava o que seria enviado, sem o token inteiro', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'uj-push-arquivo-'))
    const arquivo = join(pasta, 'push.jsonl')
    await transporteEmArquivo(arquivo).enviar(mensagem())
    const linha = JSON.parse((await readFile(arquivo, 'utf8')).trim())
    expect(linha.token).toBe(`…${'a'.repeat(6)}`)
    expect(linha.titulo).toBe('Novo aviso')
    await rm(pasta, { recursive: true, force: true })
  })

  it('plataforma sem configuração falha sem repetir', async () => {
    const t = transportePorPlataforma({})
    expect(await t.enviar(mensagem())).toEqual({
      resultado: 'falhou',
      erro: 'plataforma_sem_configuracao',
    })
  })
})
