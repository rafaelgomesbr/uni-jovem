import { VIDRO } from '@uj/tokens'
import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import type { ReactNode } from 'react'
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

interface PropsDoVidro {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  /** `barra`: barra de abas, cabeçalho compacto e barra de ação. `folha`: folha. */
  tipo?: keyof Pick<typeof VIDRO, 'barra' | 'folha'>
  /** Só a borda de cima (barra de ação) ou a de baixo (cabeçalho compacto). */
  borda?: 'toda' | 'cima' | 'baixo'
}

/**
 * Superfície de vidro para o que flutua (seção 2.8). Ordem:
 * 1. "Reduzir transparência" ou "Aumentar contraste": opaco (com borda de 2 na
 *    cor do texto no Aumentar contraste);
 * 2. Liquid Glass do iOS 26, com a tinta do token (sem tinta ele vira cinza);
 * 3. desfoque do expo-blur sobre a cor do token (no Android, só a cor).
 */
export function Vidro({ children, style, tipo = 'barra', borda = 'toda' }: PropsDoVidro) {
  const { cores, nome, escuro } = useTema()
  const { reduzirTransparencia, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const token = VIDRO[tipo][nome]
  const largura = aumentarContraste ? 2 : 1
  const estiloDaBorda: ViewStyle =
    borda === 'toda'
      ? { borderWidth: largura }
      : borda === 'cima'
        ? { borderTopWidth: largura }
        : { borderBottomWidth: largura }
  const corDaBorda = aumentarContraste ? cores.texto : token.borda

  if (reduzirTransparencia || aumentarContraste) {
    return (
      <View
        style={[{ backgroundColor: token.opaco, borderColor: corDaBorda }, estiloDaBorda, style]}
      >
        {children}
      </View>
    )
  }

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={token.fundo}
        colorScheme={escuro ? 'dark' : 'light'}
        style={[{ overflow: 'hidden', borderColor: corDaBorda }, estiloDaBorda, style]}
      >
        {children}
      </GlassView>
    )
  }

  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 50 : 0}
      tint={escuro ? 'dark' : 'light'}
      style={[
        { overflow: 'hidden', backgroundColor: token.fundo, borderColor: corDaBorda },
        estiloDaBorda,
        style,
      ]}
    >
      {children}
    </BlurView>
  )
}
