import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import type { ReactNode } from 'react'
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

interface PropsDoVidro {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * Superfície de vidro para o que flutua (cabeçalho, barras). Ordem:
 * 1. "Reduzir transparência" ou "Aumentar contraste": opaco, sempre.
 * 2. Liquid Glass nativo (iOS 26 em diante).
 * 3. Desfoque do expo-blur sobre a cor translúcida do tema (no Android, só a cor).
 */
export function Vidro({ children, style }: PropsDoVidro) {
  const { cores, escuro } = useTema()
  const { reduzirTransparencia, aumentarContraste } = usePreferenciasDeAcessibilidade()

  if (reduzirTransparencia || aumentarContraste) {
    return (
      <View
        style={[
          {
            backgroundColor: cores.superficieElevada,
            borderColor: aumentarContraste ? cores.texto : cores.borda,
            borderWidth: aumentarContraste ? 2 : 1,
          },
          style,
        ]}
      >
        {children}
      </View>
    )
  }

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={escuro ? 'dark' : 'light'}
        style={[{ overflow: 'hidden' }, style]}
      >
        {children}
      </GlassView>
    )
  }

  return (
    <BlurView
      intensity={Platform.OS === 'android' ? 0 : 40}
      tint={escuro ? 'dark' : 'light'}
      style={[
        {
          overflow: 'hidden',
          backgroundColor: cores.vidroFundo,
          borderColor: cores.vidroBorda,
          borderWidth: 1,
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  )
}
