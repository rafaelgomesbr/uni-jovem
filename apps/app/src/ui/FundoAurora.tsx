import { StyleSheet, View } from 'react-native'

import { useGeometriaDaAurora, type PropsDaAurora } from './geometriaDaAurora'

export type { PropsDaAurora } from './geometriaDaAurora'

/**
 * As duas auroras do mockup: brilho coral no canto superior direito (nascer
 * do sol) e violeta à esquerda (noite). Decorativo, atrás do conteúdo e
 * rolando com ele. Some com "Aumentar contraste" (fundo chapado). Com
 * "Reduzir transparência" fica: é fundo, não superfície translúcida.
 */
export function FundoAurora({ intensidade = 1 }: PropsDaAurora) {
  const g = useGeometriaDaAurora(intensidade)
  if (!g) return null
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
          top: g.coral.top,
          right: g.coral.right,
          width: g.coral.lado,
          height: g.coral.lado,
          borderRadius: g.coral.lado / 2,
          backgroundImage: g.coral.fundo,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: g.violeta.top,
          left: g.violeta.left,
          width: g.violeta.lado,
          height: g.violeta.lado,
          borderRadius: g.violeta.lado / 2,
          backgroundImage: g.violeta.fundo,
        }}
      />
    </View>
  )
}
