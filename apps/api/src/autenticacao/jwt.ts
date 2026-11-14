import { jwtVerify, SignJWT, errors } from 'jose'

/**
 * Token de acesso: JWT HS256 de 15 minutos, só em memória no cliente. Ele não
 * carrega papel nem comunidade (isso muda a qualquer momento e é lido do banco
 * a cada pedido); carrega quem é, de qual sessão, quando a pessoa provou o
 * segundo fator pela última vez (`mfa`) e, para o Criador, a prova de
 * plataforma (`prv`) que o banco exige para poderes de plataforma.
 *
 * Revogação: a API confere a sessão no banco a cada pedido autenticado; o
 * token sozinho não basta depois que a sessão é revogada.
 */

export const DURACAO_ACESSO_S = 15 * 60
export const JANELA_2FA_RECENTE_S = 10 * 60
export const DURACAO_DESAFIO_S = 5 * 60
const EMISSOR = 'unijovem'
const PUBLICO = 'unijovem-api'
const PUBLICO_DESAFIO = 'unijovem-desafio'

export interface ConteudoDoAcesso {
  contaId: string
  sessaoId: string
  /** Epoch (s) da última prova de segundo fator nesta sessão, se houver. */
  mfaEm: number | null
  /** Prova de plataforma do Criador (valor cru; o banco guarda só o hash). */
  prova: string | null
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
    ...(conteudo.prova ? { prv: conteudo.prova } : {}),
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
    const prv = payload['prv']
    return {
      ok: true,
      conteudo: {
        contaId: payload.sub,
        sessaoId: payload['sid'],
        mfaEm: typeof mfa === 'number' ? mfa : null,
        prova: typeof prv === 'string' ? prv : null,
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

// ------------------------------------------------------------ desafio de segundo fator

/** Depois da senha certa, quem tem 2FA recebe um desafio de 5 min para o código. */
export interface Desafio {
  contaId: string
  aparelho: string | null
  plataforma: 'ios' | 'android' | 'web'
  /** Marca da senha vigente: trocar a senha invalida desafios em aberto. */
  versaoDaSenha: string
}

export async function emitirDesafio(
  segredo: string,
  d: Desafio,
  agoraS: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  return new SignJWT({ apa: d.aparelho, pla: d.plataforma, sv: d.versaoDaSenha })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(d.contaId)
    .setIssuer(EMISSOR)
    .setAudience(PUBLICO_DESAFIO)
    .setIssuedAt(agoraS)
    .setExpirationTime(agoraS + DURACAO_DESAFIO_S)
    .sign(chave(segredo))
}

export async function verificarDesafio(
  segredo: string,
  token: string,
  agoraS: number = Math.floor(Date.now() / 1000),
): Promise<Desafio | null> {
  try {
    const { payload } = await jwtVerify(token, chave(segredo), {
      algorithms: ['HS256'],
      issuer: EMISSOR,
      audience: PUBLICO_DESAFIO,
      currentDate: new Date(agoraS * 1000),
    })
    const pla = payload['pla']
    const sv = payload['sv']
    if (
      typeof payload.sub !== 'string' ||
      typeof sv !== 'string' ||
      (pla !== 'ios' && pla !== 'android' && pla !== 'web')
    ) {
      return null
    }
    const apa = payload['apa']
    return {
      contaId: payload.sub,
      aparelho: typeof apa === 'string' ? apa : null,
      plataforma: pla,
      versaoDaSenha: sv,
    }
  } catch {
    return null
  }
}
