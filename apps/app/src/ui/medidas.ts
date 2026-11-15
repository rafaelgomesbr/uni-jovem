import { ALVO_MINIMO } from '@uj/tokens'
import { Platform } from 'react-native'

/** Altura mínima de qualquer controle tocável: 44 pt no iOS e na web, 48 dp no Android. */
export const ALVO =
  Platform.select({ ios: ALVO_MINIMO.ios, android: ALVO_MINIMO.android }) ?? ALVO_MINIMO.web
