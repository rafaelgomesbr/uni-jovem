/* eslint-disable no-restricted-syntax -- opacidade aqui é animação de entrada, não estado (D65) */
import { CURVAS, MOVIMENTO_DAS_TELAS } from '@uj/tokens'
import { useEffect, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useToqueComMola } from './useToqueComMola'

/**
 * Primitivas de movimento da direção A (D65): o que as telas usam em vez de inventar
 * animação. Só `opacity` e `transform`. Com "Reduzir movimento", tudo vira dissolução de
 * 120 ms (sem deslocamento, sem escala, sem passo). Cada uma é um hook por componente:
 * nunca chame em laço nem em condição (React Compiler); para uma lista, faça um componente
 * por item.
 */

/** A curva de entrada (`saida`) e a de troca (`padrao`), criadas no uso. */
const saida = () => Easing.bezier(...CURVAS.saida)
const padrao = () => Easing.bezier(...CURVAS.padrao)

/**
 * Entrada em cascata: o bloco `ordem` (0 a 5) sobe 12 pt e aparece em 200 ms, com 30 ms de
 * passo; o último termina em 350 ms. Roda uma vez, ao montar. Com Reduzir movimento, dissolve
 * em 120 ms, sem passo. Devolve o estilo animado para um `Animated.View`.
 */
export function useEntradaEmCascata(ordem: number, { ativa = true }: { ativa?: boolean } = {}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const { cascata, dissolver } = MOVIMENTO_DAS_TELAS
  const progresso = useSharedValue(ativa ? 0 : 1)
  const posicao = Math.min(Math.max(ordem, 0), cascata.maximo)

  // O motor de animação é um sistema externo: começa ao montar e para ao sair.
  useEffect(() => {
    if (!ativa) return
    progresso.set(
      withDelay(
        reduzirMovimento ? 0 : posicao * cascata.passo,
        withTiming(1, {
          duration: reduzirMovimento ? dissolver : cascata.duracao,
          easing: saida(),
          reduceMotion: ReduceMotion.Never,
        }),
      ),
    )
    return () => cancelAnimation(progresso)
  }, [ativa, reduzirMovimento, posicao, cascata.passo, cascata.duracao, dissolver, progresso])

  const deslocamento = reduzirMovimento ? 0 : cascata.deslocamento
  return useAnimatedStyle(() => ({
    opacity: progresso.value,
    transform: [{ translateY: (1 - progresso.value) * deslocamento }],
  }))
}

interface PropsDaEntradaEmCascata {
  /** Posição na fila: 0 é o primeiro bloco; passa de 5, vale 5. */
  ordem: number
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** `useEntradaEmCascata` já embrulhado: um bloco da tela que entra na sua vez. */
export function EntradaEmCascata({ ordem, children, style }: PropsDaEntradaEmCascata) {
  const estilo = useEntradaEmCascata(ordem)
  return <Animated.View style={[style, estilo]}>{children}</Animated.View>
}

/**
 * Pressionar: a escala de 0,98 em 90 ms, a mola de volta ao soltar e a camada de
 * "pressionado" (o mesmo toque do botão, D64). Use `propsDoPressable` no `Pressable`, o
 * `estilo` no `Animated.View` que escala e a `camada` na `Animated.View` absoluta com a cor
 * do estado. Com Reduzir movimento, só a camada, em 80 ms.
 */
export function usePressionar({ escala = true }: { escala?: boolean } = {}) {
  const toque = useToqueComMola({ escala })
  return {
    estilo: toque.estiloDoToque,
    camada: toque.estiloDaCamada,
    camadaDeHover: toque.estiloDoHover,
    propsDoPressable: {
      onPressIn: toque.aoPressionarDentro,
      onPressOut: toque.aoPressionarFora,
      onHoverIn: toque.aoEntrarComPonteiro,
      onHoverOut: toque.aoSairComPonteiro,
    },
  }
}

/**
 * Revelar: o que aparece depois de um toque (uma faixa, um aviso, um bloco novo). Sobe 8 pt
 * e dissolve em 200 ms ao ficar `visivel`; ao esconder, dissolve de volta em 160 ms. Com
 * Reduzir movimento, só dissolve (120 ms). O chamador decide se o bloco continua montado.
 */
export function useRevelar(visivel: boolean) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const { toast, dissolver } = MOVIMENTO_DAS_TELAS
  // Parte sempre de 0: o que já nasce visível também entra (sobe e dissolve).
  const progresso = useSharedValue(0)

  useEffect(() => {
    progresso.set(
      withTiming(visivel ? 1 : 0, {
        duration: reduzirMovimento ? dissolver : visivel ? toast.entra : toast.sai,
        easing: visivel ? saida() : padrao(),
        reduceMotion: ReduceMotion.Never,
      }),
    )
    return () => cancelAnimation(progresso)
  }, [visivel, reduzirMovimento, dissolver, toast.entra, toast.sai, progresso])

  const deslocamento = reduzirMovimento ? 0 : toast.deslocamento
  return useAnimatedStyle(() => ({
    opacity: progresso.value,
    transform: [{ translateY: (1 - progresso.value) * deslocamento }],
  }))
}

interface PropsDaTransicaoDeAba {
  /** A aba está à frente? Ao ficar `true`, a tela dissolve (160 ms); sai em 120 ms. */
  ativa: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * Transição entre abas: "estas telas são pares, não pai e filho". A tela nova dissolve em
 * 160 ms (`padrao`); a que sai, em 120 ms. Nada desliza. Com Reduzir movimento, 120 ms. Na
 * tela de aba: `<TransicaoDeAba ativa={useIsFocused()}>`.
 */
export function TransicaoDeAba({ ativa, children, style }: PropsDaTransicaoDeAba) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const { abaDissolve, abaDissolveSai, dissolver } = MOVIMENTO_DAS_TELAS
  const progresso = useSharedValue(ativa ? 1 : 0)

  useEffect(() => {
    progresso.set(
      withTiming(ativa ? 1 : 0, {
        duration: reduzirMovimento ? dissolver : ativa ? abaDissolve : abaDissolveSai,
        easing: padrao(),
        reduceMotion: ReduceMotion.Never,
      }),
    )
    return () => cancelAnimation(progresso)
  }, [ativa, reduzirMovimento, abaDissolve, abaDissolveSai, dissolver, progresso])

  const estilo = useAnimatedStyle(() => ({ opacity: progresso.value }))
  return <Animated.View style={[{ flex: 1 }, style, estilo]}>{children}</Animated.View>
}
