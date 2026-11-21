/* eslint-disable no-restricted-syntax -- opacidade aqui é animação de entrada, não estado (D63) */
import { CURVAS_DE_ACESSO, ENTRADA_CURTA, MOVIMENTO_DE_ACESSO } from '@uj/tokens'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
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

/**
 * Como a tela de acesso entra:
 * - `completa`: a cascata de abertura de 780 ms, uma vez por abertura do app;
 * - `curta`: o conteúdo desliza 16 pt em 260 ms (retorno, troca entre Entrar e
 *   Criar conta, convite pendente); o sol e a aurora não repetem;
 * - `imediata`: sem movimento nenhum (painel de e-mail já aberto).
 * Com "Reduzir movimento" qualquer modo vira um único dissolve de 120 ms.
 */
export type ModoDeRevelacao = 'completa' | 'curta' | 'imediata'

const ContextoDeRevelacao = createContext<ModoDeRevelacao>('imediata')
export const ProvedorDeRevelacao = ContextoDeRevelacao.Provider
export function useModoDeRevelacao(): ModoDeRevelacao {
  return useContext(ContextoDeRevelacao)
}

const SAIDA = Easing.bezier(...CURVAS_DE_ACESSO.saida)

interface PropsDoRevelar {
  children: ReactNode
  /** Cascata completa: atraso e duração de cada elemento (`CASCATA_DE_ABERTURA`). */
  atraso?: number
  duracao?: number
  /** Cascata completa: sobe de `dy` pt até o lugar. */
  dy?: number
  /** Entrada curta: posição na fila (30 ms de passo). */
  ordem?: number
  /** Entrada curta: +1 ao avançar, -1 ao voltar. */
  direcao?: 1 | -1
  style?: StyleProp<ViewStyle>
}

/**
 * Revela o filho (opacidade mais deslocamento) conforme o modo da tela. Cada
 * elemento da cascata é um `Revelar`: um componente, um hook (o React Compiler
 * não aceita hook em laço). Parte já do lugar final, então nada ocupa espaço
 * em movimento e o toque nunca é bloqueado.
 */
export function Revelar({
  children,
  atraso = 0,
  duracao = 320,
  dy = 12,
  ordem = 0,
  direcao = 1,
  style,
}: PropsDoRevelar) {
  const modo = useModoDeRevelacao()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const animar = modo !== 'imediata'
  const progresso = useSharedValue(animar ? 0 : 1)

  useEffect(() => {
    if (!animar) return
    const tempo = reduzirMovimento
      ? { duracao: MOVIMENTO_DE_ACESSO.dissolver, atraso: 0 }
      : modo === 'curta'
        ? { duracao: ENTRADA_CURTA.duracao, atraso: ordem * ENTRADA_CURTA.passo }
        : { duracao, atraso }
    progresso.set(
      withDelay(
        tempo.atraso,
        withTiming(1, {
          duration: tempo.duracao,
          easing: SAIDA,
          reduceMotion: ReduceMotion.Never,
        }),
      ),
    )
    return () => cancelAnimation(progresso)
  }, [animar, reduzirMovimento, modo, ordem, duracao, atraso, progresso])

  const deslocamento = reduzirMovimento ? 0 : modo === 'curta' ? ENTRADA_CURTA.deslocamento : dy
  const horizontal = modo === 'curta'
  const sinal = direcao

  const estilo = useAnimatedStyle(() => {
    const p = progresso.value
    const resto = (1 - p) * deslocamento
    return {
      opacity: p,
      transform: horizontal ? [{ translateX: sinal * resto }] : [{ translateY: resto }],
    }
  })

  return <Animated.View style={[style, estilo]}>{children}</Animated.View>
}
