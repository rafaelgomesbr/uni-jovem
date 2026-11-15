/**
 * Anúncio para o leitor de tela, nas três plataformas por um caminho só.
 * iOS: a região viva (`accessibilityLiveRegion`) e o papel `alert` não falam
 * nada no VoiceOver; o anúncio vai pela fila do sistema, sem cortar o que já
 * está sendo lido. Android: o mesmo anúncio do TalkBack. Web: `anunciar.web.ts`.
 */
import { AccessibilityInfo, Platform } from 'react-native'

export function anunciar(texto: string): void {
  const limpo = texto.trim()
  if (!limpo) return
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibilityWithOptions(limpo, { queue: true })
  } else {
    AccessibilityInfo.announceForAccessibility(limpo)
  }
}
