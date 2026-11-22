import { AURORA } from '@uj/tokens'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

/*
 * Geometria da Aurora, comum ao nativo (FundoAurora.tsx) e à web
 * (FundoAurora.web.tsx). Fica num arquivo sem sufixo de plataforma: na web,
 * importar './FundoAurora' resolve para o próprio FundoAurora.web.tsx, e o
 * hook chegava como undefined (tela em branco).
 */

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
  const { aumentarContraste, reduzirTransparencia } = usePreferenciasDeAcessibilidade()
  const { top } = useSafeAreaInsets()
  // O contraste do status foi medido com o brilho nesta posição em relação ao cabeçalho.
  const deslocamento = top - AURORA.areaSeguraDeReferencia
  // Aumentar contraste e Reduzir transparência: fundo chapado e opaco, sem brilho (D67).
  if (aumentarContraste || reduzirTransparencia || intensidade <= 0) return null
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
