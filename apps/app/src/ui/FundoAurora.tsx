import { AURORA } from '@uj/tokens'
import { StyleSheet, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

/** `rgba(r,g,b,a)` com alfa 0, para o fim do gradiente. */
function transparente(rgba: string): string {
  return rgba.replace(/,\s*[\d.]+\s*\)$/, ',0)')
}

export function gradienteDaAurora(cor: string): string {
  return `radial-gradient(circle, ${cor} 0%, ${transparente(cor)} ${AURORA.paradaFinal * 100}%)`
}

/**
 * As duas auroras do mockup: brilho coral no canto superior direito (nascer
 * do sol) e violeta à esquerda (noite). Decorativo, atrás do conteúdo e
 * rolando com ele: a posição em relação ao cabeçalho é a do mockup, base do
 * teste de contraste. Com "Aumentar contraste", some (fundo chapado).
 */
export function FundoAurora() {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  if (aumentarContraste) return null
  return (
    <View
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      <View
        style={{
          position: 'absolute',
          top: AURORA.coral.topo,
          right: AURORA.coral.direita,
          width: AURORA.coral.lado,
          height: AURORA.coral.lado,
          borderRadius: AURORA.coral.lado / 2,
          backgroundImage: gradienteDaAurora(cores.auroraCoral),
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: AURORA.violeta.topo,
          left: AURORA.violeta.esquerda,
          width: AURORA.violeta.lado,
          height: AURORA.violeta.lado,
          borderRadius: AURORA.violeta.lado / 2,
          backgroundImage: gradienteDaAurora(cores.auroraVioleta),
        }}
      />
    </View>
  )
}
