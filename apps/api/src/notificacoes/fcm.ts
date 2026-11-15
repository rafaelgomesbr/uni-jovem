import { readFile } from 'node:fs/promises'
import { importPKCS8, SignJWT } from 'jose'
import type { MensagemPush, ResultadoDoEnvio, TransportePush } from './transportes.ts'

/**
 * Android pela API FCM HTTP v1 (D21), sem SDK: OAuth 2.0 de conta de serviço
 * (JWT RS256 assinado com `jose`, trocado por um token de acesso) e um POST
 * por mensagem. Contrato:
 *   https://firebase.google.com/docs/cloud-messaging/send/v1-api
 *   https://developers.google.com/identity/protocols/oauth2/service-account#httprest
 *
 * A chave da conta de serviço vem de um arquivo (FCM_CONTA_SERVICO_ARQUIVO),
 * fora do git, lido na partida; nunca vai para log.
 */

export interface ContaDeServico {
  project_id: string
  client_email: string
  private_key: string
  private_key_id?: string
  token_uri: string
}

const ESCOPO = 'https://www.googleapis.com/auth/firebase.messaging'
const TOKEN_URI_PADRAO = 'https://oauth2.googleapis.com/token'

export async function lerContaDeServico(caminho: string): Promise<ContaDeServico> {
  let bruto: unknown
  try {
    bruto = JSON.parse(await readFile(caminho, 'utf8'))
  } catch {
    // Sem detalhe: a mensagem do JSON.parse poderia ecoar parte da chave.
    throw new Error('não foi possível ler o arquivo da conta de serviço do Firebase')
  }
  const c = bruto as Partial<ContaDeServico>
  if (!c.project_id || !c.client_email || !c.private_key) {
    throw new Error('arquivo da conta de serviço do Firebase incompleto')
  }
  return {
    project_id: c.project_id,
    client_email: c.client_email,
    private_key: c.private_key,
    ...(c.private_key_id ? { private_key_id: c.private_key_id } : {}),
    token_uri: c.token_uri ?? TOKEN_URI_PADRAO,
  }
}

interface ErroFcm {
  error?: { status?: string; details?: { errorCode?: string }[] }
}

export function transporteFcm(o: {
  conta: ContaDeServico
  buscar?: typeof fetch
  /** Base da API (testes). */
  urlBase?: string
}): TransportePush {
  const buscar = o.buscar ?? fetch
  const urlBase = o.urlBase ?? 'https://fcm.googleapis.com'
  let acesso: { token: string; ate: number } | null = null

  async function tokenDeAcesso(): Promise<string> {
    const agora = Math.floor(Date.now() / 1000)
    if (acesso && acesso.ate > agora + 60) return acesso.token
    const chave = await importPKCS8(o.conta.private_key, 'RS256')
    const declaracao = await new SignJWT({ scope: ESCOPO })
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
        ...(o.conta.private_key_id ? { kid: o.conta.private_key_id } : {}),
      })
      .setIssuer(o.conta.client_email)
      .setSubject(o.conta.client_email)
      .setAudience(o.conta.token_uri)
      .setIssuedAt(agora)
      .setExpirationTime(agora + 3600)
      .sign(chave)
    const r = await buscar(o.conta.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: declaracao,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) throw new Error(`oauth_${r.status}`)
    const j = (await r.json()) as { access_token?: string; expires_in?: number }
    if (!j.access_token) throw new Error('oauth_sem_token')
    acesso = { token: j.access_token, ate: agora + (j.expires_in ?? 3600) }
    return acesso.token
  }

  return {
    async enviar(m: MensagemPush): Promise<ResultadoDoEnvio> {
      let token: string
      try {
        token = await tokenDeAcesso()
      } catch (e) {
        return { resultado: 'tentar_de_novo', erro: (e as Error).message.slice(0, 40) }
      }
      let r: Response
      try {
        r = await buscar(`${urlBase}/v1/projects/${o.conta.project_id}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token: m.token,
              notification: { title: m.titulo, body: m.corpo },
              data: m.dados,
              android: {
                priority: 'HIGH',
                ttl: '86400s',
                // Na tela bloqueada segura, o Android mostra só "conteúdo oculto".
                notification: { visibility: 'PRIVATE' },
              },
            },
          }),
          signal: AbortSignal.timeout(10_000),
        })
      } catch {
        return { resultado: 'tentar_de_novo', erro: 'fcm_rede' }
      }
      if (r.ok) return { resultado: 'enviado' }
      const corpo = (await r.json().catch(() => ({}))) as ErroFcm
      const codigo =
        corpo.error?.details?.find((d) => d.errorCode)?.errorCode ?? corpo.error?.status ?? ''
      if (r.status === 404 || codigo === 'UNREGISTERED' || codigo === 'SENDER_ID_MISMATCH') {
        return { resultado: 'token_invalido', erro: `fcm_${codigo || r.status}` }
      }
      if (r.status === 401) {
        acesso = null
        return { resultado: 'tentar_de_novo', erro: 'fcm_401' }
      }
      if (r.status === 429 || r.status >= 500) {
        return { resultado: 'tentar_de_novo', erro: `fcm_${r.status}` }
      }
      return { resultado: 'falhou', erro: `fcm_${codigo || r.status}`.slice(0, 60) }
    },
  }
}
