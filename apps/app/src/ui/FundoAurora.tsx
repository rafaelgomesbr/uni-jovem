/* eslint-disable no-restricted-syntax -- opacidade aqui é a deriva e a abertura da aurora, não estado (D63) */
import { AURORA, CURVAS_DE_ACESSO } from '@uj/tokens'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useGeometriaDaAurora } from './geometriaDaAurora'
import type { PropsDoFundoAurora } from './propsDoFundoAurora'

export type { PropsDaAurora } from './geometriaDaAurora'
export type { PropsDoFundoAurora } from './propsDoFundoAurora'

/**
 * As duas auroras do mockup: brilho coral no canto superior direito (nascer
 * do sol) e violeta à esquerda (noite). Decorativo, atrás do conteúdo e
 * rolando com ele. Some com "Aumentar contraste" (fundo chapado). Com
 * "Reduzir transparência" fica: é fundo, não superfície translúcida. Só a
 * tela de acesso usa `movimento="ambiente"` (D63).
 */
export function FundoAurora({
  intensidade = 1,
  movimento = 'estatico',
  amanhecer = false,
  pausada = false,
}: PropsDoFundoAurora) {
  const g = useGeometriaDaAurora(intensidade)
  if (!g) return null
  const envoltorio = {
    pointerEvents: 'none',
    'aria-hidden': true,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  } as const
  if (movimento === 'estatico' && !amanhecer) {
    return (
      <View {...envoltorio} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
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
  return (
    <View {...envoltorio} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <BrilhoAnimado
        brilho="coral"
        posicao={{ top: g.coral.top, right: g.coral.right }}
        lado={g.coral.lado}
        fundo={g.coral.fundo}
        ambiente={movimento === 'ambiente'}
        amanhecer={amanhecer}
        pausada={pausada}
      />
      <BrilhoAnimado
        brilho="violeta"
        posicao={{ top: g.violeta.top, left: g.violeta.left }}
        lado={g.violeta.lado}
        fundo={g.violeta.fundo}
        ambiente={movimento === 'ambiente'}
        amanhecer={false}
        pausada={pausada}
      />
    </View>
  )
}

/** O app está em primeiro plano? A deriva para sozinha com o app em segundo plano. */
function usePrimeiroPlano(): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const ouvinte = AppState.addEventListener('change', aviso)
      return () => ouvinte.remove()
    },
    () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    () => true,
  )
}

interface PropsDoBrilho {
  brilho: 'coral' | 'violeta'
  posicao: { top: number; left?: number; right?: number }
  lado: number
  fundo: string
  ambiente: boolean
  amanhecer: boolean
  pausada: boolean
}

/**
 * Um brilho em duas camadas aninhadas: a de fora faz a abertura (o sol
 * esquentando) e a de dentro a deriva, para os dois movimentos não competirem
 * na mesma propriedade. Os dois degradês são bitmaps: mover um bitmap é o
 * trabalho mais barato do compositor. Nenhum estado muda durante a deriva.
 */
function BrilhoAnimado({
  brilho,
  posicao,
  lado,
  fundo,
  ambiente,
  amanhecer,
  pausada,
}: PropsDoBrilho) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const primeiroPlano = usePrimeiroPlano()
  const { deriva: derivas } = AURORA
  const d = derivas[brilho]
  const { abertura } = derivas
  const abrir = amanhecer && !reduzirMovimento
  const rodar = ambiente && !pausada && !reduzirMovimento && primeiroPlano
  // Dentro do componente de propósito: o roteador de teste do Expo troca o Reanimated por um
  // objeto vazio, e a aurora parada (o resto do app) não pode quebrar na importação.
  const [curvaDeAbertura] = useState(() => Easing.bezier(...CURVAS_DE_ACESSO.saida))
  const [seno] = useState(() => Easing.inOut(Easing.sin))
  const entrada = useSharedValue(abrir ? 0 : 1)
  const fase = useSharedValue(0)

  useEffect(() => {
    if (!abrir) return
    entrada.set(
      withTiming(1, {
        duration: abertura.duracao,
        easing: curvaDeAbertura,
        reduceMotion: ReduceMotion.Never,
      }),
    )
    return () => cancelAnimation(entrada)
  }, [abrir, abertura.duracao, entrada, curvaDeAbertura])

  // A deriva vai e volta `meiasVoltas` vezes (par: termina no repouso) e para. Parar a leva ao
  // repouso em 600 ms.
  useEffect(() => {
    if (rodar) {
      fase.set(
        withRepeat(
          withTiming(1, {
            duration: d.meioCiclo,
            easing: seno,
            reduceMotion: ReduceMotion.Never,
          }),
          d.meiasVoltas,
          true,
        ),
      )
    } else {
      fase.set(withTiming(0, { duration: 600, reduceMotion: ReduceMotion.Never }))
    }
    return () => cancelAnimation(fase)
  }, [rodar, d.meioCiclo, d.meiasVoltas, fase, seno])

  const estiloDaAbertura = useAnimatedStyle(() => {
    const e = entrada.value
    return {
      opacity: abertura.opacidadeInicial + (1 - abertura.opacidadeInicial) * e,
      transform: [{ scale: abertura.escalaInicial + (1 - abertura.escalaInicial) * e }],
    }
  })
  const estiloDaDeriva = useAnimatedStyle(() => {
    const f = fase.value
    return {
      opacity: 1 + (d.opacidade - 1) * f,
      transform: [
        { translateX: d.x * f },
        { translateY: d.y * f },
        { scale: 1 + (d.escala - 1) * f },
      ],
    }
  })

  return (
    <Animated.View
      style={[{ position: 'absolute', width: lado, height: lado, ...posicao }, estiloDaAbertura]}
    >
      <Animated.View
        style={[
          { width: lado, height: lado, borderRadius: lado / 2, backgroundImage: fundo },
          estiloDaDeriva,
        ]}
      />
    </Animated.View>
  )
}
