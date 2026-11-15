import { Platform } from 'react-native'

/**
 * Origem das páginas públicas (`/e/:idPublico`). Na web é a mesma origem do
 * app; no celular, `EXPO_PUBLIC_URL_PUBLICA` ou, na falta dela, a URL da API
 * (as páginas públicas são servidas pelo mesmo servidor da API).
 */
export function origemPublica(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin
  const url = process.env.EXPO_PUBLIC_URL_PUBLICA || process.env.EXPO_PUBLIC_API_URL || ''
  return url.replace(/\/+$/, '')
}

export function linkPublicoDoEvento(idPublico: string): string {
  return `${origemPublica()}/e/${idPublico}`
}
