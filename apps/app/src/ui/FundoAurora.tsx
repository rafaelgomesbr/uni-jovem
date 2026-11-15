import { AURORA } from '@uj/tokens'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

/** `rgba(r,g,b,a)` com o alfa multiplicado pela intensidade e a versão transparente, para o degradê. */
function degrade(cor: string, intensidade: number): string {
  const comIntensidade = cor.replace(
    /,\s*([\d.]+)\s*\)$/,
    (_, a: string) => `,${Math.round(Number(a) * intensidade * 1000) / 1000})`,
  )
  const transparente = cor.replace(/,\s*[\d.]+\s*\)$/, ',0)')
  return `radial-gradient(circle, ${comIntensidade} 0%, ${transparente} ${AURORA.paradaFinal * 100}%)`
}

export interface PropsDaAurora {
  /** 1 nas raízes de aba e na entrada; 0,6 nas telas de pilha (seção 2.3). */
  intensidade?: number
}

/** Geometria comum ao nativo e à web: a Aurora acompanha a área segura. */
export function useGeometriaDaAurora(intensidade: number) {
  const { nome } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const { top } = useSafeAreaInsets()
  // O contraste do status foi medido com o brilho nesta posição em relação ao cabeçalho.
  const deslocamento = top - AURORA.areaSeguraDeReferencia
  if (aumentarContraste || intensidade <= 0) return null
  return {
    coral: {
      top: AURORA.coral.topo + deslocamento,
      right: AURORA.coral.direita,
      lado: AURORA.coral.lado,
      fundo: degrade(AURORA.coral[nome], intensidade),
    },
    violeta: {
      top: AURORA.violeta.topo + deslocamento,
      left: AURORA.violeta.esquerda,
      lado: AURORA.violeta.lado,
      fundo: degrade(AURORA.violeta[nome], intensidade),
    },
  }
}

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
