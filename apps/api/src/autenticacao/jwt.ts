import { jwtVerify, SignJWT, errors } from 'jose'

/**
 * Token de acesso: JWT HS256 de 15 minutos, só em memória no cliente. Ele não
 * carrega papel nem comunidade (isso muda a qualquer momento e é lido do banco
 * a cada pedido); carrega quem é, de qual sessão, e quando a pessoa provou o
 * segundo fator pela última vez (`mfa`), para as ações que exigem 2FA recente.
 *
 * Revogação: o access token vive no máximo 15 min; a sessão revogada deixa de
 * renovar, e a API confere a sessão no banco nas rotas sensíveis.
 */

export const DURACAO_ACESSO_S = 15 * 60
export const JANELA_2FA_RECENTE_S = 10 * 60
const EMISSOR = 'unijovem'
const PUBLICO = 'unijovem-api'

export interface ConteudoDoAcesso {
  contaId: string
  sessaoId: string
  /** Epoch (s) da última prova de segundo fator nesta sessão, se houver. */
  mfaEm: number | null
}

function chave(segredo: string): Uint8Array {
  return new TextEncoder().encode(segredo)
}

export async function emitirAcesso(
  segredo: string,
  conteudo: ConteudoDoAcesso,
  agoraS: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const jwt = new SignJWT({
    sid: conteudo.sessaoId,
    ...(conteudo.mfaEm ? { mfa: conteudo.mfaEm } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(conteudo.contaId)
    .setIssuer(EMISSOR)
    .setAudience(PUBLICO)
    .setIssuedAt(agoraS)
    .setExpirationTime(agoraS + DURACAO_ACESSO_S)
  return jwt.sign(chave(segredo))
}

export type ResultadoDoAcesso =
  { ok: true; conteudo: ConteudoDoAcesso } | { ok: false; motivo: 'expirado' | 'invalido' }

export async function verificarAcesso(
  segredo: string,
  token: string,
  agoraS: number = Math.floor(Date.now() / 1000),
): Promise<ResultadoDoAcesso> {
  try {
    const { payload } = await jwtVerify(token, chave(segredo), {
      algorithms: ['HS256'],
      issuer: EMISSOR,
      audience: PUBLICO,
      currentDate: new Date(agoraS * 1000),
    })
    if (typeof payload.sub !== 'string' || typeof payload['sid'] !== 'string') {
      return { ok: false, motivo: 'invalido' }
    }
    const mfa = payload['mfa']
    return {
      ok: true,
      conteudo: {
        contaId: payload.sub,
        sessaoId: payload['sid'],
        mfaEm: typeof mfa === 'number' ? mfa : null,
      },
    }
  } catch (e) {
    return { ok: false, motivo: e instanceof errors.JWTExpired ? 'expirado' : 'invalido' }
  }
}

export function doisFatoresRecente(
  conteudo: ConteudoDoAcesso,
  agoraS: number = Math.floor(Date.now() / 1000),
): boolean {
  return conteudo.mfaEm !== null && agoraS - conteudo.mfaEm <= JANELA_2FA_RECENTE_S
}
