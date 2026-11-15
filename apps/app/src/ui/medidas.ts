import { ALVO_MINIMO, LARGURA_DE_MARGEM_LARGA, RITMO } from '@uj/tokens'
import { Platform, useWindowDimensions } from 'react-native'

/** Altura mínima de qualquer controle tocável: 44 pt no iOS e na web, 48 dp no Android. */
export const ALVO =
  Platform.select({ ios: ALVO_MINIMO.ios, android: ALVO_MINIMO.android }) ?? ALVO_MINIMO.web

/** Margem lateral da tela: 20 no celular, 32 em janela larga (tablet, web). */
export function useMargemDaTela(): number {
  const { width } = useWindowDimensions()
  return width >= LARGURA_DE_MARGEM_LARGA ? RITMO.margemDaTelaLarga : RITMO.margemDaTela
}
