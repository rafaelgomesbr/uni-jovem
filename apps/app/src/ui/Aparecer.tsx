import { DURACAO } from '@uj/tokens'
import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Platform, View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'

interface PropsDoAparecer {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * Entrada curta (opacidade e 6 pt de deslocamento, 200 ms) para conteúdo que
 * surge depois de um toque: formulário que abre, painel que troca. Com
 * "Reduzir movimento", aparece direto, sem animação nenhuma.
 */
export function Aparecer({ children, style }: PropsDoAparecer) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  if (reduzirMovimento) return <View style={style}>{children}</View>
  return <Animado style={style}>{children}</Animado>
}

function Animado({ children, style }: PropsDoAparecer) {
  const [progresso] = useState(() => new Animated.Value(0))
  // A animação é um sistema externo (o motor de animação): começa ao montar.
  useEffect(() => {
    const animacao = Animated.timing(progresso, {
      toValue: 1,
      duration: DURACAO.aparecer,
      useNativeDriver: Platform.OS !== 'web',
    })
    animacao.start()
    return () => animacao.stop()
  }, [progresso])
  return (
    <Animated.View
      style={[
        style,
        {
          // Animação de entrada, não estado.
          // eslint-disable-next-line no-restricted-syntax
          opacity: progresso,
          transform: [
            { translateY: progresso.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
