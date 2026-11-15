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
 * O navegador desfoca o que está atrás (`backdrop-filter`)? Lido uma vez: o
 * suporte não muda com a página aberta.
 */
const DESFOQUE_NA_WEB =
  Platform.OS === 'web' &&
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  (CSS.supports('backdrop-filter', 'blur(1px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(1px)'))

/**
 * `backdrop-filter` na web, com a mesma saturação do material do sistema. O
 * React Native não declara a propriedade, mas o react-native-web a repassa ao
 * CSS (com o prefixo do Safari).
 */
function desfoqueDaWeb(raio: number): ViewStyle {
  const filtro = `blur(${raio}px) saturate(180%)`
  return { backdropFilter: filtro, WebkitBackdropFilter: filtro } as ViewStyle
}

/**
 * Superfície de vidro para o que flutua (seção 2.8). Vidro só com desfoque de
 * verdade; onde não há desfoque, opaco (regra 7 do CLAUDE.md). Ordem:
 * 1. "Reduzir transparência" ou "Aumentar contraste": opaco (com borda de 2 na
 *    cor do texto no Aumentar contraste);
 * 2. Liquid Glass do iOS 26, com a tinta do token (sem tinta ele vira cinza);
 * 3. iOS anterior: desfoque do expo-blur sobre a tinta do token;
 * 4. web: `backdrop-filter` com o raio do token sobre a tinta;
 * 5. Android, ou web sem `backdrop-filter`: a cor opaca do token. A tinta
 *    translúcida sem desfoque deixava o conteúdo nítido sob a barra.
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
  const desfoqueDisponivel = Platform.OS === 'ios' || DESFOQUE_NA_WEB

  if (reduzirTransparencia || aumentarContraste || !desfoqueDisponivel) {
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

  if (Platform.OS === 'web') {
    // Sem o BlurView: na web ele troca a cor de fundo pela do material dele e apaga a tinta do token.
    return (
      <View
        style={[
          { backgroundColor: token.fundo, borderColor: corDaBorda },
          desfoqueDaWeb(VIDRO[tipo].desfoque),
          estiloDaBorda,
          style,
        ]}
      >
        {children}
      </View>
    )
  }

  return (
    <BlurView
      intensity={50}
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
