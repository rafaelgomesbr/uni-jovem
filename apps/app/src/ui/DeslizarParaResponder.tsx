/* eslint-disable no-restricted-syntax -- opacidade aqui é o fundo revelado pelo gesto, animação e não estado (D65) */
import { DESLIZAR, ESPACO, RAIO } from '@uj/tokens'
import { useRef, useState, type ReactNode } from 'react'
import { Pressable, View, type LayoutChangeEvent } from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Botao, ParDeBotoes } from './Botao'
import { decisaoDoDeslize, limitarArrasto, repousoDaDecisao } from './decisaoDoDeslize'
import { Icone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { ProvedorDeSuperficie, useTema } from './tema'

export interface PropsDoDeslizarParaResponder {
  /** O que se responde: "Louvor, sábado 28". */
  titulo: string
  /** Data, local, "Aguardando sua resposta" (em `meta` suave). */
  descricao?: string
  /** Um chip da situação, ao lado do texto (use `Chip situacao="aguardando"`). */
  extra?: ReactNode
  /**
   * Coluna à esquerda do conteúdo (a hora, na Agenda do dia, D79): a linha que pede resposta
   * tem o MESMO esqueleto da linha comum, e os botões ficam na coluna do título.
   */
  inicio?: ReactNode
  aoAceitar: () => void
  aoRecusar: () => void
  /** O texto do botão e do fundo que o gesto revela ("Aceitar"). */
  rotuloDeAceitar?: string
  /** "Não posso ir". */
  rotuloDeRecusar?: string
  /** Sem internet, por exemplo: nada responde. Diga o `motivo` em palavras. */
  desabilitado?: boolean
  motivo?: string
  /** Toque no título abre o detalhe. */
  aoPressionar?: () => void
}

/**
 * A linha de uma convocação que se responde (direção A, D65; padrão 5.4 do UX): "Aceitar" e
 * "Não posso ir" SEMPRE visíveis como botões, e o deslizar como atalho de quem tem três
 * pendências. NUNCA é o único caminho.
 *
 * - Para a direita: o fundo `aceitarFundo` aparece com o ícone de check e a PALAVRA "Aceitar"
 *   (cor nunca é o único sinal). Soltando além de 40% da largura, aceita (`aoAceitar`), e a
 *   tela mostra o `mostrarDesfazer`.
 * - Para a esquerda: abre o fundo `recusarFundo` com o botão "Não posso ir". Só envia se a
 *   pessoa tocar nele: recusar custa mais caro de errar.
 * - Reduzir movimento: o gesto continua, a linha vai e volta sem transição.
 * - Leitor de tela: o título expõe as ações "Aceitar" e "Não posso ir" (VoiceOver e TalkBack),
 *   e os botões visíveis seguem focáveis.
 *
 * Usa `react-native-gesture-handler` e Reanimated. O componente traz o próprio
 * `GestureHandlerRootView`, então funciona em qualquer ponto da árvore.
 */
export function DeslizarParaResponder({
  titulo,
  descricao,
  extra,
  inicio,
  aoAceitar,
  aoRecusar,
  rotuloDeAceitar = 'Aceitar',
  rotuloDeRecusar = 'Não posso ir',
  desabilitado = false,
  motivo,
  aoPressionar,
}: PropsDoDeslizarParaResponder) {
  const { cores } = useTema()
  const { reduzirMovimento, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const x = useSharedValue(0)
  const largura = useSharedValue(1)
  const aberta = useSharedValue(false)
  const [respondida, setRespondida] = useState(false)
  const respondidaRef = useRef(false)

  function aceitar() {
    // Só uma resposta por linha: o gesto e o botão não se somam.
    if (respondidaRef.current) return
    respondidaRef.current = true
    setRespondida(true)
    aoAceitar()
  }
  function aceitarDepois() {
    setTimeout(aceitar, reduzirMovimento ? 0 : DESLIZAR.atrasoDoAceite)
  }
  function recusar() {
    if (respondidaRef.current) return
    respondidaRef.current = true
    setRespondida(true)
    aoRecusar()
  }

  const duracao = reduzirMovimento ? 0 : DESLIZAR.duracao
  const pan = usePanGesture({
    testID: 'deslizar-para-responder',
    enabled: !desabilitado && !respondida,
    // Quase na horizontal e mais de 8 pt para valer; subir ou descer logo cede à rolagem.
    activeOffsetX: [-DESLIZAR.inicio.distancia, DESLIZAR.inicio.distancia],
    failOffsetY: [-DESLIZAR.inicio.cancelaNaVertical, DESLIZAR.inicio.cancelaNaVertical],
    onUpdate: (e) => {
      'worklet'
      const base = aberta.value ? -largura.value * DESLIZAR.aberturaDaEsquerda : 0
      x.set(limitarArrasto(base + e.translationX, largura.value))
    },
    onDeactivate: () => {
      'worklet'
      const decisao = decisaoDoDeslize(x.value, largura.value)
      x.set(
        withTiming(repousoDaDecisao(decisao, largura.value), {
          duration: duracao,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          reduceMotion: ReduceMotion.Never,
        }),
      )
      aberta.set(decisao === 'revelar')
      if (decisao === 'aceitar') scheduleOnRN(aceitarDepois)
    },
  })

  const estiloDaFrente = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const estiloDoFundoDeAceitar = useAnimatedStyle(() => ({ opacity: x.value > 4 ? 1 : 0 }))
  const estiloDoFundoDeRecusar = useAnimatedStyle(() => ({ opacity: x.value < -4 ? 1 : 0 }))

  function medir(e: LayoutChangeEvent) {
    largura.set(e.nativeEvent.layout.width)
  }
  function fechar() {
    x.set(withTiming(0, { duration: duracao, reduceMotion: ReduceMotion.Never }))
    aberta.set(false)
  }

  const acoesDeAcessibilidade = desabilitado
    ? []
    : [
        { name: 'aceitar', label: rotuloDeAceitar },
        { name: 'recusar', label: rotuloDeRecusar },
      ]

  return (
    <GestureHandlerRootView>
      <ProvedorDeSuperficie superficie="opaca">
        <View
          testID="linha-de-resposta"
          onLayout={medir}
          style={{
            borderRadius: RAIO.medio,
            overflow: 'hidden',
            backgroundColor: cores.superficie,
            borderWidth: aumentarContraste ? 2 : 1,
            borderColor: aumentarContraste ? cores.texto : cores.superficieBorda,
          }}
        >
          {/* Os fundos revelados pelo gesto são enfeite do dedo: os botões visíveis e as ações do título cobrem tudo. */}
          <Animated.View
            testID="fundo-de-aceitar"
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: cores.aceitarFundo,
                flexDirection: 'row',
                alignItems: 'center',
                gap: ESPACO.e8,
                paddingHorizontal: ESPACO.e16,
              },
              estiloDoFundoDeAceitar,
            ]}
          >
            <Icone nome="check" cor={cores.sucesso} tamanho={20} peso="forte" />
            <Texto variante="rotulo">{rotuloDeAceitar}</Texto>
          </Animated.View>
          <Animated.View
            testID="fundo-de-recusar"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: cores.recusarFundo,
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingHorizontal: ESPACO.e16,
              },
              estiloDoFundoDeRecusar,
            ]}
          >
            <Pressable
              testID="revelado-recusar"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              disabled={desabilitado}
              onPress={() => {
                fechar()
                recusar()
              }}
              style={{ minHeight: ALVO, minWidth: ALVO, justifyContent: 'center' }}
            >
              <Texto variante="rotulo" cor="erro">
                {rotuloDeRecusar}
              </Texto>
            </Pressable>
          </Animated.View>

          <GestureDetector gesture={pan}>
            <Animated.View
              testID="frente-da-resposta"
              style={[
                {
                  backgroundColor: cores.superficie,
                  paddingTop: ESPACO.e12,
                  paddingHorizontal: ESPACO.e16,
                  paddingBottom: ESPACO.e12,
                  gap: ESPACO.e8,
                },
                estiloDaFrente,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e12 }}>
                {inicio}
                <View style={{ flex: 1, gap: ESPACO.e8 }}>
                  {/* O `extra` (chip da situação, "Você: Louvor") fica FORA do botão do título: o rótulo
                  do botão esconde os filhos, e a situação é lida como o que ela é, um item à parte. */}
                  <View style={{ gap: ESPACO.e6 }}>
                    <Pressable
                      accessibilityRole={aoPressionar ? 'button' : 'text'}
                      accessibilityLabel={[titulo, descricao].filter(Boolean).join('. ')}
                      accessibilityActions={acoesDeAcessibilidade}
                      onAccessibilityAction={(e) => {
                        if (e.nativeEvent.actionName === 'aceitar') aceitar()
                        if (e.nativeEvent.actionName === 'recusar') recusar()
                      }}
                      disabled={!aoPressionar}
                      onPress={aoPressionar}
                      style={{
                        minHeight: ALVO,
                        justifyContent: inicio ? 'flex-start' : 'center',
                        gap: ESPACO.e2,
                      }}
                    >
                      <Texto variante="tituloItem">{titulo}</Texto>
                      {descricao ? (
                        <Texto variante="meta" cor="textoSuave">
                          {descricao}
                        </Texto>
                      ) : null}
                    </Pressable>
                    {extra}
                  </View>
                  <ParDeBotoes larguraMinima={150}>
                    <Botao
                      titulo={rotuloDeRecusar}
                      variante="secundario"
                      tamanho="medio"
                      desabilitado={desabilitado || respondida}
                      aoPressionar={recusar}
                    />
                    <Botao
                      titulo={rotuloDeAceitar}
                      variante="primario"
                      tamanho="medio"
                      desabilitado={desabilitado || respondida}
                      aoPressionar={aceitar}
                    />
                  </ParDeBotoes>
                  {desabilitado && motivo ? (
                    <View
                      style={{ flexDirection: 'row', gap: ESPACO.e6, alignItems: 'flex-start' }}
                    >
                      <Icone nome="cadeado" cor={cores.textoSuave} tamanho={14} />
                      <Texto variante="legenda" cor="textoSuave" style={{ flex: 1 }}>
                        {motivo}
                      </Texto>
                    </View>
                  ) : null}
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </ProvedorDeSuperficie>
    </GestureHandlerRootView>
  )
}
