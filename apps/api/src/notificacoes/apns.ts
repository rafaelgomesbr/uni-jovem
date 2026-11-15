import { readFile } from 'node:fs/promises'
import http2 from 'node:http2'
import { importPKCS8, SignJWT } from 'jose'
import type { MensagemPush, ResultadoDoEnvio, TransportePush } from './transportes.ts'

/**
 * iOS direto no APNs (D22), por HTTP/2 (`node:http2`) e token JWT ES256 da
 * chave .p8 (lida de APNS_CHAVE_ARQUIVO, fora do git). Contrato:
 *   https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
 *   https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns
 *
 * O JWT do provedor é renovado a cada 50 minutos (a Apple recusa mais de uma
 * hora e reclama de renovação frequente demais). Uma conexão por ambiente.
 */

export const ORIGENS_APNS = {
  producao: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const

export async function lerChaveApns(caminho: string): Promise<string> {
  try {
    return await readFile(caminho, 'utf8')
  } catch {
    throw new Error('não foi possível ler a chave do APNs')
  }
}

interface Resposta {
  status: number
  corpo: string
}

function pedir(
  sessao: http2.ClientHttp2Session,
  cabecalhos: http2.OutgoingHttpHeaders,
  corpo: string,
): Promise<Resposta> {
  return new Promise((resolver, rejeitar) => {
    const req = sessao.request(cabecalhos)
    let status = 0
    let dados = ''
    req.setEncoding('utf8')
    req.on('response', (h) => {
      status = Number(h[':status'])
    })
    req.on('data', (pedaco: string) => {
      dados += pedaco
    })
    req.on('end', () => resolver({ status, corpo: dados }))
    req.on('error', rejeitar)
    req.setTimeout(10_000, () => {
      req.close(http2.constants.NGHTTP2_CANCEL)
      rejeitar(new Error('apns_tempo'))
    })
    req.end(corpo)
  })
}

export function transporteApns(o: {
  chavePem: string
  chaveId: string
  timeId: string
  topico: string
  /** Testes: servidor HTTP/2 local no lugar da Apple. */
  origens?: { producao: string; sandbox: string }
}): TransportePush {
  const origens = o.origens ?? ORIGENS_APNS
  const sessoes = new Map<string, http2.ClientHttp2Session>()
  let provedor: { jwt: string; em: number } | null = null

  async function jwtDoProvedor(): Promise<string> {
    const agora = Math.floor(Date.now() / 1000)
    if (provedor && agora - provedor.em < 50 * 60) return provedor.jwt
    const chave = await importPKCS8(o.chavePem, 'ES256')
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: o.chaveId })
      .setIssuer(o.timeId)
      .setIssuedAt(agora)
      .sign(chave)
    provedor = { jwt, em: agora }
    return jwt
  }

  function sessao(origem: string): http2.ClientHttp2Session {
    const existente = sessoes.get(origem)
    if (existente && !existente.closed && !existente.destroyed) return existente
    const nova = http2.connect(origem)
    const esquecer = () => {
      if (sessoes.get(origem) === nova) sessoes.delete(origem)
    }
    nova.on('error', esquecer)
    nova.on('goaway', esquecer)
    nova.on('close', esquecer)
    nova.unref()
    sessoes.set(origem, nova)
    return nova
  }

  return {
    async enviar(m: MensagemPush): Promise<ResultadoDoEnvio> {
      if (!/^[0-9a-fA-F]{32,200}$/.test(m.token)) {
        return { resultado: 'token_invalido', erro: 'apns_formato' }
      }
      const origem = m.ambienteApns === 'sandbox' ? origens.sandbox : origens.producao
      let jwt: string
      try {
        jwt = await jwtDoProvedor()
      } catch {
        return { resultado: 'falhou', erro: 'apns_chave_invalida' }
      }
      const corpo = JSON.stringify({
        aps: { alert: { title: m.titulo, body: m.corpo }, sound: 'default' },
        uj: m.dados,
      })
      let r: Resposta
      try {
        r = await pedir(
          sessao(origem),
          {
            ':method': 'POST',
            ':path': `/3/device/${m.token}`,
            authorization: `bearer ${jwt}`,
            'apns-topic': o.topico,
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'apns-expiration': String(Math.floor(Date.now() / 1000) + 86_400),
            ...(m.dados['notificacaoId'] ? { 'apns-collapse-id': m.dados['notificacaoId'] } : {}),
            'content-type': 'application/json',
          },
          corpo,
        )
      } catch {
        sessoes.get(origem)?.close()
        return { resultado: 'tentar_de_novo', erro: 'apns_rede' }
      }
      if (r.status === 200) return { resultado: 'enviado' }
      const razao = ((): string => {
        try {
          return (JSON.parse(r.corpo) as { reason?: string }).reason ?? ''
        } catch {
          return ''
        }
      })()
      if (
        r.status === 410 ||
        razao === 'BadDeviceToken' ||
        razao === 'Unregistered' ||
        razao === 'DeviceTokenNotForTopic'
      ) {
        return { resultado: 'token_invalido', erro: `apns_${razao || r.status}` }
      }
      if (razao === 'ExpiredProviderToken' || razao === 'InvalidProviderToken') {
        provedor = null
        return { resultado: 'tentar_de_novo', erro: `apns_${razao}` }
      }
      if (r.status === 429 || r.status >= 500) {
        return { resultado: 'tentar_de_novo', erro: `apns_${razao || r.status}` }
      }
      return { resultado: 'falhou', erro: `apns_${razao || r.status}`.slice(0, 60) }
    },
    async encerrar() {
      for (const s of sessoes.values()) s.close()
      sessoes.clear()
    },
  }
}
