import { MOVIMENTO_DE_ACESSO } from '@uj/tokens'
import { useEffect, useRef, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'

const SAIDA_SUAVE = Easing.out(Easing.quad)

interface PropsDoAbalar {
  children: ReactNode
  /** Cada vez que sobe, o filho balança (erro ao enviar). Zero não balança. */
  disparo: number
  /** `campo` balança 5 pt em 260 ms; `botao`, 4 pt em 240 ms. */
  tipo?: 'campo' | 'botao'
  style?: StyleProp<ViewStyle>
}

/**
 * Balanço do erro (7.8): vai e volta na horizontal e assenta. Só acontece ao
 * enviar, nunca ao sair do campo, e nunca bloqueia o toque. O balanço é só
 * visual: quem avisa o erro é o anúncio do leitor de tela. Com "Reduzir
 * movimento" não há balanço.
 */
export function Abalar({ children, disparo, tipo = 'campo', style }: PropsDoAbalar) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const deslocamento = useSharedValue(0)
  const anterior = useRef(disparo)

  useEffect(() => {
    if (disparo === anterior.current) return
    anterior.current = disparo
    if (reduzirMovimento || disparo === 0) return
    const { etapas } =
      tipo === 'campo' ? MOVIMENTO_DE_ACESSO.balancoDoCampo : MOVIMENTO_DE_ACESSO.balancoDoBotao
    const [a, b, c, d] = etapas.map((etapa) =>
      withTiming(etapa.dx, {
        duration: etapa.duracao,
        easing: SAIDA_SUAVE,
        reduceMotion: ReduceMotion.Never,
      }),
    ) as [number, number, number, number]
    deslocamento.set(withSequence(a, b, c, d))
    return () => cancelAnimation(deslocamento)
  }, [disparo, reduzirMovimento, tipo, deslocamento])

  const estilo = useAnimatedStyle(() => ({ transform: [{ translateX: deslocamento.value }] }))
  return <Animated.View style={[style, estilo]}>{children}</Animated.View>
}
