import { createHash } from 'node:crypto'
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'
import { publicosDaApple, type Config } from '../config.ts'

/**
 * Verificação dos ID tokens de Google e Apple. A API nunca confia no que o
 * app diz sobre a pessoa: confere a assinatura com as chaves públicas do
 * provedor (JWKS), o emissor, o público (`aud`, os IDs de cliente do nosso
 * app), a validade e, na Apple, o `nonce`. O token nunca vai para log nem
 * para a auditoria.
 */

export const PROVEDORES = ['google', 'apple'] as const
export type Provedor = (typeof PROVEDORES)[number]

export const NOME_DO_PROVEDOR: Record<Provedor, string> = { google: 'Google', apple: 'Apple' }

export interface IdentidadeDoProvedor {
  provedor: Provedor
  sub: string
  /** E-mail informado pelo provedor, em minúsculas (pode faltar). */
  email: string | null
  /** O provedor garante que a pessoa controla esse e-mail. */
  emailVerificado: boolean
  /** E-mail de retransmissão privada da Apple: nunca casa com conta. */
  retransmissaoPrivada: boolean
  /** Fim da validade do token (s), para o controle de reuso. */
  expiraEm: number
}

export type MotivoDaRecusa = 'token_invalido' | 'nonce_invalido' | 'provedor_desligado'

export class TokenDeProvedorRecusado extends Error {
  constructor(public readonly motivo: MotivoDaRecusa) {
    super(`token de provedor recusado: ${motivo}`)
    this.name = 'TokenDeProvedorRecusado'
  }
}

/** Chaves públicas por provedor. Em produção, o JWKS remoto; nos testes, um local. */
export type ChavesDosProvedores = Record<Provedor, JWTVerifyGetKey>

const EMISSORES: Record<Provedor, string[]> = {
  google: ['https://accounts.google.com', 'accounts.google.com'],
  apple: ['https://appleid.apple.com'],
}

const JWKS: Record<Provedor, string> = {
  google: 'https://www.googleapis.com/oauth2/v3/certs',
  apple: 'https://appleid.apple.com/auth/keys',
}

export function chavesRemotas(): ChavesDosProvedores {
  // O jose guarda as chaves em memória e só busca de novo quando aparece um
  // `kid` desconhecido (com intervalo mínimo), então o provedor não é chamado a cada login.
  return {
    google: createRemoteJWKSet(new URL(JWKS.google), { timeoutDuration: 5000 }),
    apple: createRemoteJWKSet(new URL(JWKS.apple), { timeoutDuration: 5000 }),
  }
}

/** A Apple manda alguns booleanos como texto ("true"). */
function verdadeiro(valor: unknown): boolean {
  return valor === true || valor === 'true'
}

/** O app manda à Apple o SHA-256 (hex) do nonce cru; a API recebe o cru e confere. */
export function hashDoNonce(nonce: string): string {
  return createHash('sha256').update(nonce, 'utf8').digest('hex')
}

export interface VerificadorDeProvedores {
  /** Provedores com configuração (o app só mostra o botão desses). */
  ligado(provedor: Provedor): boolean
  verificar(
    provedor: Provedor,
    token: string,
    opcoes?: { nonce?: string | undefined },
  ): Promise<IdentidadeDoProvedor>
}

export function criarVerificadorDeProvedores(
  config: Config,
  chaves: ChavesDosProvedores = chavesRemotas(),
): VerificadorDeProvedores {
  const publicos: Record<Provedor, string[]> = {
    google: config.GOOGLE_CLIENT_IDS,
    apple: publicosDaApple(config),
  }

  return {
    ligado: (provedor) => publicos[provedor].length > 0,

    async verificar(provedor, token, opcoes = {}) {
      if (publicos[provedor].length === 0) throw new TokenDeProvedorRecusado('provedor_desligado')
      let payload: JWTPayload
      try {
        ;({ payload } = await jwtVerify(token, chaves[provedor], {
          algorithms: ['RS256'],
          issuer: EMISSORES[provedor],
          audience: publicos[provedor],
          requiredClaims: ['sub', 'exp', 'iat'],
          // Relógio do servidor e do provedor podem divergir um pouco.
          clockTolerance: 30,
        }))
      } catch (e) {
        if (e instanceof errors.JOSEError || e instanceof TypeError) {
          throw new TokenDeProvedorRecusado('token_invalido')
        }
        throw e
      }

      if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 255) {
        throw new TokenDeProvedorRecusado('token_invalido')
      }

      if (provedor === 'apple') {
        // Sem nonce não há como saber que o token foi pedido por este app agora.
        const nonce = opcoes.nonce
        if (
          !nonce ||
          typeof payload['nonce'] !== 'string' ||
          payload['nonce'] !== hashDoNonce(nonce)
        ) {
          throw new TokenDeProvedorRecusado('nonce_invalido')
        }
      }

      const email =
        typeof payload['email'] === 'string' && payload['email'].length <= 254
          ? payload['email'].trim().toLowerCase()
          : null
      return {
        provedor,
        sub: payload.sub,
        email,
        emailVerificado: email !== null && verdadeiro(payload['email_verified']),
        retransmissaoPrivada:
          provedor === 'apple' &&
          (verdadeiro(payload['is_private_email']) ||
            (email?.endsWith('@privaterelay.appleid.com') ?? false)),
        expiraEm: payload.exp!,
      }
    },
  }
}

/**
 * Um ID token vale por alguns minutos; quem o interceptar (log de proxy,
 * aparelho comprometido) não consegue usá-lo de novo aqui. Em memória, por
 * processo: o servidor roda uma instância (docs/RISCOS.md).
 */
export class TokensJaUsados {
  private readonly usados = new Map<string, number>()

  /** `true` na primeira vez; `false` se o mesmo token já passou por aqui. */
  registrar(token: string, expiraEmS: number, agoraS = Math.floor(Date.now() / 1000)): boolean {
    for (const [chave, fim] of this.usados) if (fim < agoraS) this.usados.delete(chave)
    const chave = createHash('sha256').update(token).digest('base64url')
    if (this.usados.has(chave)) return false
    this.usados.set(chave, expiraEmS + 60)
    return true
  }
}
