/**
 * Utilitários das páginas públicas: telefone brasileiro, Turnstile e datas.
 */

/**
 * Normaliza telefone para E.164. Aceita "(11) 91234-5678", "11912345678",
 * "+55 11 91234-5678". Número sem DDI é tratado como brasileiro.
 */
export function normalizarTelefone(entrada: string): string | null {
  const limpo = entrada.trim()
  const digitos = limpo.replace(/\D/g, '')
  if (limpo.startsWith('+')) {
    return /^[1-9]\d{7,14}$/.test(digitos) ? `+${digitos}` : null
  }
  if (/^55\d{10,11}$/.test(digitos)) return `+${digitos}`
  if (/^\d{10,11}$/.test(digitos)) return `+55${digitos}`
  return null
}

/** Mostra só o fim do telefone (listas e confirmações). */
export function mascararTelefone(e164: string | null): string | null {
  if (!e164) return null
  return `•••• ${e164.slice(-4)}`
}

export const URL_DO_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Confere o desafio anti-robô do Cloudflare Turnstile. Sem segredo configurado
 * (só em desenvolvimento: a configuração exige o segredo em HML e produção),
 * não há verificação.
 */
export async function verificarTurnstile(
  segredo: string | undefined,
  resposta: string | undefined,
  ip: string,
  buscar: typeof fetch = fetch,
): Promise<boolean> {
  if (!segredo) return true
  if (!resposta) return false
  try {
    const corpo = new URLSearchParams({ secret: segredo, response: resposta, remoteip: ip })
    const r = await buscar(URL_DO_TURNSTILE, {
      method: 'POST',
      body: corpo,
      signal: AbortSignal.timeout(5_000),
    })
    const j = (await r.json()) as { success?: boolean }
    return j.success === true
  } catch {
    return false
  }
}

export function dataPorExtenso(instante: Date, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: fuso,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instante)
}
