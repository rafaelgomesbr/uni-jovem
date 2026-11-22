/* eslint-disable no-restricted-syntax -- opacidade aqui é o pulso do ponto "ao vivo", animação e não estado (D65) */
import { MOVIMENTO_DAS_TELAS } from '@uj/tokens'
import { useEffect } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

/**
 * O ponto de "ao vivo": opacidade de 1 a 0,4 em 1,6 s, sem fim enquanto montado, parado com
 * "Reduzir movimento". É decorativo: o texto "Ao vivo" ao lado diz o mesmo.
 */
export function PontoAoVivo({ lado = 8, cor }: { lado?: number; cor?: string }) {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const opacidade = useSharedValue(1)
  const { ciclo, opacidadeMinima } = MOVIMENTO_DAS_TELAS.ponto

  // O pulso é um relógio externo: começa ao montar e para ao sair ou com Reduzir movimento.
  useEffect(() => {
    if (reduzirMovimento) {
      opacidade.set(1)
      return
    }
    const meio = {
      duration: ciclo / 2,
      easing: Easing.inOut(Easing.ease),
      reduceMotion: ReduceMotion.Never,
    }
    opacidade.set(
      withRepeat(withSequence(withTiming(opacidadeMinima, meio), withTiming(1, meio)), -1),
    )
    return () => cancelAnimation(opacidade)
  }, [reduzirMovimento, ciclo, opacidadeMinima, opacidade])

  const estilo = useAnimatedStyle(() => ({ opacity: opacidade.value }))
  return (
    <Animated.View
      testID="ponto-ao-vivo"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: lado,
          height: lado,
          borderRadius: lado / 2,
          backgroundColor: cor ?? cores.primaria,
        },
        estilo,
      ]}
    />
  )
}
