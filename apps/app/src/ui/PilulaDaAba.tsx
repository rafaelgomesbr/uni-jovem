import { BARRA_DE_ABAS, CURVAS, MOVIMENTO_DAS_TELAS, RAIO } from '@uj/tokens'
import { useEffect, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useAbaAtiva } from './abaAtiva'
import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

/** O espaço entre a borda da barra e os itens: o preenchimento mais a borda de 1. */
export const RECUO_DA_BARRA = BARRA_DE_ABAS.preenchimento + 1

/**
 * A pílula luminosa da aba ativa (direção A, D65): uma só, no fundo da barra, que desliza por
 * `translateX` até a aba nova (260 ms, `cubic-bezier(0.34, 1.3, 0.5, 1)`: passa um pouco e
 * volta). Cor `abaAtivaFundo`, um anel interno de 1 pt e uma luz de 22 pt de espalhamento na
 * cor da aba. Com "Reduzir movimento", troca sem deslizar. Os itens têm largura igual, então
 * a posição é `índice × (largura útil ÷ quantidade)`. Decorativa: o estado vai nos itens.
 */
export function PilulaDaAba({ quantidade }: { quantidade: number }) {
  const { cores } = useTema()
  const { reduzirMovimento, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const indice = useAbaAtiva()
  const [largura, setLargura] = useState(0)
  const x = useSharedValue(0)
  const itemLargura = quantidade > 0 ? Math.max(0, largura - 2 * RECUO_DA_BARRA) / quantidade : 0
  const alvo = RECUO_DA_BARRA + indice * itemLargura

  // A animação é um sistema externo: acompanha a aba marcada e a largura medida.
  useEffect(() => {
    if (reduzirMovimento || largura === 0) {
      x.set(alvo)
      return
    }
    x.set(
      withTiming(alvo, {
        duration: MOVIMENTO_DAS_TELAS.pilulaDaAba,
        easing: Easing.bezier(...CURVAS.pilula),
        reduceMotion: ReduceMotion.Never,
      }),
    )
    return () => cancelAnimation(x)
  }, [alvo, largura, reduzirMovimento, x])

  const estilo = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View
      testID="area-da-pilula"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
    >
      {largura > 0 ? (
        <Animated.View
          testID="pilula-da-aba"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: RECUO_DA_BARRA,
              bottom: RECUO_DA_BARRA,
              width: itemLargura,
              borderRadius: RAIO.barra,
              backgroundColor: cores.abaAtivaFundo,
              boxShadow: aumentarContraste
                ? `inset 0px 0px 0px 2px ${cores.destaque}`
                : `inset 0px 0px 0px 1px ${cores.abaAtivaBrilho}, 0px 0px ${BARRA_DE_ABAS.luzDaPilula}px -6px ${cores.abaAtivaBrilho}`,
            },
            estilo,
          ]}
        />
      ) : null}
    </View>
  )
}
