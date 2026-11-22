/* eslint-disable no-restricted-syntax -- opacidade aqui é a camada de toque animada, não estado (D63) */
import { CURVAS_DE_ACESSO, MOLAS_DE_ACESSO, MOVIMENTO_DOS_CONTROLES } from '@uj/tokens'
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'

// As curvas nascem no uso, não na importação: o botão é importado por quase todo o app.
const padrao = () => Easing.bezier(...CURVAS_DE_ACESSO.padrao)
const saidaSuave = () => Easing.out(Easing.quad)

/**
 * Retorno ao toque (7.7). Devolve estilos animados e os dois gestos do
 * `Pressable`:
 * - `estiloDoToque`: escala 0,98 em 90 ms ao tocar e mola de volta ao soltar;
 * - `estiloDaCamada`: opacidade da camada de "pressionado" (uma `View`
 *   absoluta com a cor do estado: nada de animar cor).
 * - `estiloDoHover`: opacidade da camada com o ponteiro em cima (web), 120 ms
 *   (0 com "Reduzir movimento").
 * Com "Reduzir movimento", sem escala: só a camada, em 80 ms. `escala: false`
 * serve aos links do rodapé, que só têm a camada. Vale para todos os controles
 * (D64): botão, botão de acesso, botão de ícone.
 */
export function useToqueComMola({ escala = true }: { escala?: boolean } = {}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const camada = useSharedValue(0)
  const tamanho = useSharedValue(1)
  const hover = useSharedValue(0)
  const comEscala = escala && !reduzirMovimento

  const estiloDoToque = useAnimatedStyle(() => ({ transform: [{ scale: tamanho.value }] }))
  const estiloDaCamada = useAnimatedStyle(() => ({ opacity: camada.value }))
  const estiloDoHover = useAnimatedStyle(() => ({ opacity: hover.value }))

  function aoPressionarDentro() {
    const duracao = reduzirMovimento
      ? MOVIMENTO_DOS_CONTROLES.toqueReduzido
      : MOVIMENTO_DOS_CONTROLES.toqueDentro
    camada.set(
      withTiming(1, { duration: duracao, easing: saidaSuave(), reduceMotion: ReduceMotion.Never }),
    )
    if (comEscala) {
      tamanho.set(
        withTiming(MOVIMENTO_DOS_CONTROLES.escalaDoToque, {
          duration: duracao,
          easing: saidaSuave(),
          reduceMotion: ReduceMotion.Never,
        }),
      )
    }
  }

  function aoPressionarFora() {
    camada.set(
      withTiming(0, {
        duration: reduzirMovimento
          ? MOVIMENTO_DOS_CONTROLES.toqueReduzido
          : MOVIMENTO_DOS_CONTROLES.toqueFora,
        easing: padrao(),
        reduceMotion: ReduceMotion.Never,
      }),
    )
    if (comEscala) {
      tamanho.set(withSpring(1, { ...MOLAS_DE_ACESSO.toque, reduceMotion: ReduceMotion.Never }))
    }
  }

  function mudarHover(para: number) {
    hover.set(
      withTiming(para, {
        duration: reduzirMovimento ? 0 : MOVIMENTO_DOS_CONTROLES.hover,
        easing: saidaSuave(),
        reduceMotion: ReduceMotion.Never,
      }),
    )
  }

  return {
    estiloDoToque,
    estiloDaCamada,
    estiloDoHover,
    aoPressionarDentro,
    aoPressionarFora,
    aoEntrarComPonteiro: () => mudarHover(1),
    aoSairComPonteiro: () => mudarHover(0),
  }
}
