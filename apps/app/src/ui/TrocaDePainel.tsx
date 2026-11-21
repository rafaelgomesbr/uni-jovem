/* eslint-disable no-restricted-syntax -- opacidade aqui é a troca animada entre painéis, não estado (D63) */
import { CURVAS_DE_ACESSO, MOVIMENTO_DE_ACESSO } from '@uj/tokens'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'

export type PainelDaEntrada = 'inicio' | 'email'

const PADRAO = Easing.bezier(...CURVAS_DE_ACESSO.padrao)

/** A fase da troca (0 = acessos, 1 = e-mail) e se o movimento está reduzido. */
const ContextoDaFase = createContext<{ fase: SharedValue<number>; reduzido: boolean } | null>(null)

interface PropsDaTrocaDePainel {
  /** Qual camada está ativa. A rota (`?modo=email`) é a fonte de verdade. */
  painel: PainelDaEntrada
  /** A camada dos acessos (palco e botões): fica por baixo. */
  inicio: ReactNode
  /** A camada do painel de e-mail: ancorada no topo, por cima. */
  email: ReactNode
  /** O painel assentou (fim da animação): quem chama leva o foco ao campo ou ao botão. */
  aoAssentar?: (painel: PainelDaEntrada) => void
}

/**
 * Duas camadas de geometria fixa, comandadas por uma única fase (7.5): nada
 * muda de altura na troca, então não há salto de layout. A camada que sai
 * perde o toque e some para o leitor de tela na hora (nada de botão invisível
 * focável); na web recebe `display: none` ao fim, para o Tab pular. Ida em
 * 280 ms, volta em 240; com "Reduzir movimento", só dissolve de 120 ms.
 */
export function TrocaDePainel({ painel, inicio, email, aoAssentar }: PropsDaTrocaDePainel) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const fase = useSharedValue(0)
  // Qual painel já assentou (fim da animação): só então a camada que saiu é retirada.
  const [assentado, setAssentado] = useState<PainelDaEntrada>('inicio')
  // O foco só se move quando o painel muda de verdade: abrir já no painel de e-mail leva ao campo;
  // abrir nos acessos (o estado inicial) não rouba o foco de ninguém.
  const painelAnterior = useRef<PainelDaEntrada>('inicio')

  useEffect(() => {
    const alvo = painel === 'email' ? 1 : 0
    const duracao = reduzirMovimento
      ? MOVIMENTO_DE_ACESSO.dissolver
      : alvo
        ? MOVIMENTO_DE_ACESSO.painelIda
        : MOVIMENTO_DE_ACESSO.painelVolta
    // As duas camadas existem durante a troca; a que saiu é retirada ao fim.
    const mudou = painelAnterior.current !== painel
    painelAnterior.current = painel
    const assentou = (fim: boolean) => {
      if (!fim) return
      setAssentado(painel)
      if (mudou) aoAssentar?.(painel)
    }
    fase.set(
      withTiming(
        alvo,
        { duration: duracao, easing: PADRAO, reduceMotion: ReduceMotion.Never },
        (fim) => {
          'worklet'
          scheduleOnRN(assentou, !!fim)
        },
      ),
    )
    return () => cancelAnimation(fase)
    // O aviso de que assentou é do momento; mudar a função não reinicia a troca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painel, reduzirMovimento, fase])

  const estiloDoEmail = useAnimatedStyle(() => ({
    opacity: reduzirMovimento ? fase.value : interpolate(fase.value, [0.45, 1], [0, 1], 'clamp'),
    transform: [{ translateY: reduzirMovimento ? 0 : 12 * (1 - fase.value) }],
  }))

  const ativo = painel
  const oculta = (camada: PainelDaEntrada): object => ({
    pointerEvents: ativo === camada ? 'auto' : 'none',
    'aria-hidden': ativo !== camada,
    importantForAccessibility: ativo === camada ? 'auto' : 'no-hide-descendants',
    accessibilityElementsHidden: ativo !== camada,
  })
  // Na web, a camada retirada some de vez (o Tab não a alcança).
  const retirar = (camada: PainelDaEntrada): StyleProp<ViewStyle> =>
    Platform.OS === 'web' && assentado === painel && painel !== camada ? { display: 'none' } : null

  return (
    <ContextoDaFase.Provider value={{ fase, reduzido: reduzirMovimento }}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, retirar('inicio')]} {...oculta('inicio')}>
          {inicio}
        </View>
        <Animated.View
          style={[StyleSheet.absoluteFill, retirar('email'), estiloDoEmail]}
          {...oculta('email')}
        >
          {email}
        </Animated.View>
      </View>
    </ContextoDaFase.Provider>
  )
}

interface PropsDaFaseDoPainel {
  children: ReactNode
  /** `sai`: some enquanto a fase vai a 1 (palco e acessos); `entra`: aparece (sol mini). */
  tipo: 'sai' | 'entra'
  /** Até onde da fase (0 a 1) o esmaecer vai: o palco some em 0,5; os acessos, em 0,4. */
  ate?: number
  /** Para `entra`: a partir de onde da fase o elemento começa a aparecer. */
  de?: number
  /** Deslocamento vertical no fim (palco -12, acessos +12). */
  dy?: number
  /** Escala no fim (o sol grande vai a 0,92). */
  escala?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Um pedaço da camada dos acessos que esmaece e se desloca conforme a fase da
 * troca (o palco, os acessos, o sol mini). Sem a troca em volta, fica parado.
 */
export function FaseDoPainel({
  children,
  tipo,
  ate = 0.5,
  de = 0.6,
  dy = 0,
  escala = 1,
  style,
}: PropsDaFaseDoPainel) {
  const contexto = useContext(ContextoDaFase)
  const parada = useSharedValue(0)
  const fase = contexto?.fase ?? parada
  const reduzido = contexto?.reduzido ?? false
  const estilo = useAnimatedStyle(() => {
    const f = fase.value
    const opacidade =
      tipo === 'sai'
        ? interpolate(f, [0, ate], [1, 0], 'clamp')
        : interpolate(f, [de, 1], [0, 1], 'clamp')
    return {
      opacity: reduzido ? (tipo === 'sai' ? 1 - f : f) : opacidade,
      transform: reduzido ? [] : [{ translateY: dy * f }, { scale: 1 + (escala - 1) * f }],
    }
  })
  return <Animated.View style={[style, estilo]}>{children}</Animated.View>
}
