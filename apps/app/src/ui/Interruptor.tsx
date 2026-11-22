/* eslint-disable no-restricted-syntax -- opacidade aqui é a camada animada do trilho e do polegar, não estado (D64) */
import { ALTURA, ESPACO, MOLAS_DE_ACESSO, MOVIMENTO_DOS_CONTROLES } from '@uj/tokens'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useEffect } from 'react'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { ALFA_DESABILITADO, comOpacidade } from './cor'
import { useAnelDeFoco } from './foco'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDoInterruptor {
  rotulo: string
  /** Diz o estado em texto ("Ligado, todos os dias às 07:00"). Padrão: "Ligado" ou "Desligado". */
  descricao?: string
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  desabilitado?: boolean
}

const LARGURA_DO_TRILHO = ALTURA.interruptorLargura
const ALTURA_DO_TRILHO = ALTURA.interruptorAltura
const BORDA_DO_TRILHO = 2
const LADO_DO_POLEGAR = 24
/** O polegar desligado é um ponto de 14 (24 reduzido a 58%); ligado, o disco inteiro. */
const ESCALA_DESLIGADO = 14 / LADO_DO_POLEGAR
/** Quanto o polegar anda: o trilho, menos as duas bordas e o espaço de 2 de cada lado, menos o disco. */
const CURSO = LARGURA_DO_TRILHO - 2 * BORDA_DO_TRILHO - 2 * 2 - LADO_DO_POLEGAR

/**
 * Interruptor (seção 2.12.8, D64): trilho próprio de 52 por 32 à direita de uma
 * linha de 56, com o estado também em texto. O `Switch` nativo desligado
 * sumia no escuro (1,28:1): aqui o desligado é um trilho vazado com borda de 2
 * em `campoBorda` (3:1) e um ponto de 14; o ligado, trilho `primaria` com disco
 * de 24 em `sobrePrimaria` e um check (a forma diz o estado além da cor). O
 * polegar anda e cresce com mola; com "Reduzir movimento", 80 ms lineares.
 * Para notificações, versículo, Face ID e afins.
 */
export function Interruptor({
  rotulo,
  descricao,
  ligado,
  aoMudar,
  desabilitado = false,
}: PropsDoInterruptor) {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const anel = useAnelDeFoco(cores.foco)
  const estado = descricao ?? (ligado ? 'Ligado' : 'Desligado')
  const progresso = useSharedValue(ligado ? 1 : 0)
  useEffect(() => {
    progresso.set(
      reduzirMovimento
        ? withTiming(ligado ? 1 : 0, {
            duration: MOVIMENTO_DOS_CONTROLES.interruptorReduzido,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.Never,
          })
        : withSpring(ligado ? 1 : 0, {
            ...MOLAS_DE_ACESSO.toque,
            reduceMotion: ReduceMotion.Never,
          }),
    )
  }, [ligado, reduzirMovimento, progresso])

  const estiloDoPolegar = useAnimatedStyle(() => ({
    transform: [
      { translateX: progresso.value * CURSO },
      { scale: ESCALA_DESLIGADO + (1 - ESCALA_DESLIGADO) * progresso.value },
    ],
  }))
  const estiloDoPreenchimento = useAnimatedStyle(() => ({ opacity: Math.min(progresso.value, 1) }))
  const estiloDoPontoDesligado = useAnimatedStyle(() => ({
    opacity: Math.max(1 - progresso.value, 0),
  }))
  const estiloDoDiscoLigado = useAnimatedStyle(() => ({ opacity: Math.min(progresso.value, 1) }))

  const corDaBorda = desabilitado ? cores.tonalBorda : cores.campoBorda
  const corDoPreenchimento = desabilitado ? comOpacidade(cores.primaria, 0.4) : cores.primaria
  const corDoPonto = desabilitado ? cores.tonalBorda : cores.campoBorda
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityHint={estado}
      aria-checked={ligado}
      aria-disabled={desabilitado}
      disabled={desabilitado}
      onPress={() => aoMudar(!ligado)}
      onFocus={anel.onFocus}
      onBlur={anel.onBlur}
      style={{
        minHeight: ALTURA.linha,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        paddingVertical: ESPACO.e8,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Texto
          variante="tituloItem"
          style={desabilitado ? { color: comOpacidade(cores.texto, ALFA_DESABILITADO) } : null}
        >
          {rotulo}
        </Texto>
        <Texto variante="legenda" cor="textoSuave">
          {estado}
        </Texto>
      </View>
      {/* O trilho é desenho: o papel `switch` da linha já diz tudo ao leitor de tela. */}
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        testID="interruptor-trilho"
        style={[
          {
            width: LARGURA_DO_TRILHO,
            height: ALTURA_DO_TRILHO,
            borderRadius: ALTURA_DO_TRILHO / 2,
            borderWidth: BORDA_DO_TRILHO,
            borderColor: corDaBorda,
            justifyContent: 'center',
            paddingHorizontal: 2,
          },
          anel.estilo,
        ]}
      >
        <Animated.View
          testID="interruptor-preenchimento"
          style={[
            {
              position: 'absolute',
              top: -BORDA_DO_TRILHO,
              left: -BORDA_DO_TRILHO,
              right: -BORDA_DO_TRILHO,
              bottom: -BORDA_DO_TRILHO,
              borderRadius: ALTURA_DO_TRILHO / 2,
              backgroundColor: corDoPreenchimento,
            },
            estiloDoPreenchimento,
          ]}
        />
        <Animated.View
          testID="interruptor-polegar"
          style={[
            {
              width: LADO_DO_POLEGAR,
              height: LADO_DO_POLEGAR,
              borderRadius: LADO_DO_POLEGAR / 2,
              alignItems: 'center',
              justifyContent: 'center',
            },
            estiloDoPolegar,
          ]}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: LADO_DO_POLEGAR,
                height: LADO_DO_POLEGAR,
                borderRadius: LADO_DO_POLEGAR / 2,
                backgroundColor: corDoPonto,
              },
              estiloDoPontoDesligado,
            ]}
          />
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: LADO_DO_POLEGAR,
                height: LADO_DO_POLEGAR,
                borderRadius: LADO_DO_POLEGAR / 2,
                backgroundColor: cores.sobrePrimaria,
                alignItems: 'center',
                justifyContent: 'center',
              },
              estiloDoDiscoLigado,
            ]}
          >
            <Icone nome="check" cor={cores.primaria} tamanho={14} peso="forte" />
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  )
}
