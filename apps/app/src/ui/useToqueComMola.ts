/* eslint-disable no-restricted-syntax -- opacidade aqui é a camada de toque animada, não estado (D63) */
import { CURVAS_DE_ACESSO, MOLAS_DE_ACESSO, MOVIMENTO_DE_ACESSO } from '@uj/tokens'
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'

const PADRAO = Easing.bezier(...CURVAS_DE_ACESSO.padrao)
const SAIDA_SUAVE = Easing.out(Easing.quad)

/**
 * Retorno ao toque (7.7). Devolve estilos animados e os dois gestos do
 * `Pressable`:
 * - `estiloDoToque`: escala 0,98 em 90 ms ao tocar e mola de volta ao soltar;
 * - `estiloDaCamada`: opacidade da camada de "pressionado" (uma `View`
 *   absoluta com a cor do estado: nada de animar cor).
 * Com "Reduzir movimento", sem escala: só a camada, em 80 ms. `escala: false`
 * serve aos links do rodapé, que só têm a camada.
 */
export function useToqueComMola({ escala = true }: { escala?: boolean } = {}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const camada = useSharedValue(0)
  const tamanho = useSharedValue(1)
  const comEscala = escala && !reduzirMovimento

  const estiloDoToque = useAnimatedStyle(() => ({ transform: [{ scale: tamanho.value }] }))
  const estiloDaCamada = useAnimatedStyle(() => ({ opacity: camada.value }))

  function aoPressionarDentro() {
    const duracao = reduzirMovimento
      ? MOVIMENTO_DE_ACESSO.toqueReduzido
      : MOVIMENTO_DE_ACESSO.toqueDentro
    camada.set(
      withTiming(1, { duration: duracao, easing: SAIDA_SUAVE, reduceMotion: ReduceMotion.Never }),
    )
    if (comEscala) {
      tamanho.set(
        withTiming(MOVIMENTO_DE_ACESSO.escalaDoToque, {
          duration: duracao,
          easing: SAIDA_SUAVE,
          reduceMotion: ReduceMotion.Never,
        }),
      )
    }
  }

  function aoPressionarFora() {
    camada.set(
      withTiming(0, {
        duration: reduzirMovimento
          ? MOVIMENTO_DE_ACESSO.toqueReduzido
          : MOVIMENTO_DE_ACESSO.toqueFora,
        easing: PADRAO,
        reduceMotion: ReduceMotion.Never,
      }),
    )
    if (comEscala) {
      tamanho.set(withSpring(1, { ...MOLAS_DE_ACESSO.toque, reduceMotion: ReduceMotion.Never }))
    }
  }

  return { estiloDoToque, estiloDaCamada, aoPressionarDentro, aoPressionarFora }
}
