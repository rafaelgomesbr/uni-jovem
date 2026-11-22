/* eslint-disable no-restricted-syntax -- opacidade aqui é a luz de fundo que acompanha o relógio, animação e não estado (D67) */
import {
  CURVAS,
  LUZ_DE_BASE,
  LUZ_POR_MOMENTO,
  MOVIMENTO_DAS_TELAS,
  type MomentoDoDia,
} from '@uj/tokens'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

/** A mesma cor com o alfa em zero, para o degradê terminar transparente. */
export function transparente(cor: string): string {
  return cor.replace(/,\s*[\d.]+\s*\)$/, ',0)')
}

/** `radial-gradient(ellipse at 50% 58%, cor 0%, transparente 68%)`, como no protótipo. */
function elipse(cor: string): string {
  return `radial-gradient(ellipse at 50% ${Math.round(LUZ_DE_BASE.centroY * 100)}%, ${cor} 0%, ${transparente(cor)} ${Math.round(LUZ_DE_BASE.paradaFinal * 100)}%)`
}

interface PropsDaElipse {
  cor: string
  opacidade: number
  y: number
  testID: string
}

/** Uma elipse de luz: opacidade e deslocamento vão ao valor do momento em 900 ms, `nasce`. */
function Elipse({ cor, opacidade, y, testID }: PropsDaElipse) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const o = useSharedValue(opacidade)
  const dy = useSharedValue(y)

  // A animação é um sistema externo: o relógio do encontro move a luz, nunca o toque.
  useEffect(() => {
    const config = {
      duration: reduzirMovimento ? MOVIMENTO_DAS_TELAS.dissolver : MOVIMENTO_DAS_TELAS.luz,
      easing: Easing.bezier(...CURVAS.nasce),
      reduceMotion: ReduceMotion.Never,
    }
    o.set(withTiming(opacidade, config))
    if (reduzirMovimento) dy.set(y)
    else dy.set(withTiming(y, config))
    return () => {
      cancelAnimation(o)
      cancelAnimation(dy)
    }
  }, [opacidade, y, reduzirMovimento, o, dy])

  const estilo = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: dy.value }],
  }))
  return (
    <Animated.View
      testID={testID}
      style={[
        {
          position: 'absolute',
          left: -LUZ_DE_BASE.sangriaLateral,
          right: -LUZ_DE_BASE.sangriaLateral,
          bottom: -LUZ_DE_BASE.sangriaInferior,
          height: LUZ_DE_BASE.altura,
          backgroundImage: elipse(cor),
        },
        estilo,
      ]}
    />
  )
}

/**
 * A luz de base da Aurora viva (direção A, D65): duas elipses saindo por baixo da tela, que
 * sobem com o relógio do encontro. `longe` (0,30, 70 pt abaixo), `vespera`, `dia`, `agora`
 * (0,95, 26 pt acima) e `fim` (o horizonte apaga e o poente rosado acende). Fica atrás de
 * tudo e ancorada na tela, não no conteúdo que rola. Decorativa. Some com "Aumentar
 * contraste" e com "Reduzir transparência" (fundo chapado e opaco). Regra de layout: nenhum texto pequeno fora de cartão nos
 * últimos 96 pt (a margem do `textoSuave` ali é de 4,5:1, medida em `pares.ts`).
 */
export function LuzDeBase({ momento = 'longe' }: { momento?: MomentoDoDia }) {
  const { cores } = useTema()
  const { aumentarContraste, reduzirTransparencia } = usePreferenciasDeAcessibilidade()
  // Fundo chapado e opaco: sem brilho (Aumentar contraste e Reduzir transparência, D67).
  if (aumentarContraste || reduzirTransparencia) return null
  const luz = LUZ_POR_MOMENTO[momento]
  return (
    <View
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }}
    >
      <Elipse
        testID="luz-horizonte"
        cor={cores.brilhoHorizonte}
        opacidade={luz.horizonte.opacidade}
        y={luz.horizonte.y}
      />
      <Elipse
        testID="luz-poente"
        cor={cores.brilhoPoente}
        opacidade={luz.poente.opacidade}
        y={luz.poente.y}
      />
    </View>
  )
}
