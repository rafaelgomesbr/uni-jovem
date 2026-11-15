import * as Clipboard from 'expo-clipboard'
import { Linking, Share } from 'react-native'

/** Copia para a área de transferência. Devolve `false` se o sistema recusar. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(texto)
  } catch {
    return false
  }
}

export function linkDoWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

export async function abrirLink(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Folha de compartilhamento do sistema (WhatsApp aparece nela). Na web, usa o
 * compartilhamento do navegador; sem ele, copia o texto. Devolve o que houve.
 */
export async function compartilharTexto(
  texto: string,
): Promise<'compartilhado' | 'copiado' | 'falhou'> {
  try {
    await Share.share({ message: texto })
    return 'compartilhado'
  } catch {
    return (await copiarTexto(texto)) ? 'copiado' : 'falhou'
  }
}
