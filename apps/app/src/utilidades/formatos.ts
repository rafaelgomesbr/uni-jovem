/** Datas sempre absolutas e em pt-BR (ex.: 14/11/2026). */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatarDataEHora(iso: string | null | undefined): string {
  if (!iso) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${formatarData(iso)} às ${hora}`
}

export function primeiroNome(nome: string | null | undefined): string {
  return nome?.trim().split(/\s+/)[0] ?? ''
}

const WHATSAPP = /^\+[1-9][0-9]{7,14}$/

/**
 * Normaliza o WhatsApp para o formato da API (`+5511912345678`). Sem DDI,
 * assume Brasil quando há 10 ou 11 dígitos. Devolve `null` se não der para entender.
 */
export function normalizarWhatsApp(entrada: string): string | null {
  const limpo = entrada.trim()
  if (!limpo) return null
  const digitos = limpo.replace(/\D/g, '')
  const candidato = limpo.startsWith('+')
    ? `+${digitos}`
    : digitos.length === 10 || digitos.length === 11
      ? `+55${digitos}`
      : `+${digitos}`
  return WHATSAPP.test(candidato) ? candidato : null
}

/** Agrupa o segredo do autenticador de 4 em 4 para facilitar a digitação. */
export function agruparDe4(texto: string): string {
  return texto
    .replace(/\s+/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim()
}
