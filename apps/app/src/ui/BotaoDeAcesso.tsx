/* eslint-disable no-restricted-syntax -- opacidade aqui é animação (indicador, check, esmaecer), não estado (D63) */
import { ESPACO, MOLAS_DE_ACESSO, MOVIMENTO_DE_ACESSO, RAIO } from '@uj/tokens'
import { useEffect, type Ref } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Abalar } from './Abalar'
import { aparenciaDoAcesso, type MarcaDoAcesso, type NivelDoAcesso } from './aparenciaDoAcesso'
import { useAnelDeFoco, type NoDeView } from './foco'
import { Icone } from './Icone'
import { LogoDaApple } from './LogoDaApple'
import { LogoDoGoogle } from './LogoDoGoogle'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useToqueComMola } from './useToqueComMola'
import { soNaWeb } from './web'

export type { MarcaDoAcesso, NivelDoAcesso } from './aparenciaDoAcesso'

/** O espaço do logotipo, do indicador e do check: os três ocupam o mesmo quadrado de 20. */
const LADO_DO_LOGO = 20

export interface PropsDoBotaoDeAcesso {
  marca: MarcaDoAcesso
  nivel: NivelDoAcesso
  /** O texto é sempre o do botão ("Continuar com a Apple"): é também o nome para o leitor de tela. */
  titulo: string
  /** "Usado da última vez": texto com ícone, 8 acima do botão (a cor nunca é o único sinal). */
  selo?: string
  carregando?: boolean
  /** Depois de entrar: o indicador vira um check (a conta abriu). */
  sucesso?: boolean
  inativo?: boolean
  /** Por que está inativo (lido pelo leitor de tela e mostrado embaixo). */
  motivo?: string
  /** Cada vez que sobe, o botão balança 4 pt (falha do provedor). */
  disparoDeErro?: number
  /** Só o catálogo: desenha o estado sem toque. */
  estadoDeVitrine?: 'pressionado' | 'foco'
  aoPressionar: () => void
  ref?: Ref<NoDeView>
}

/**
 * Botão de acesso (D63), no lugar do `BotaoDeAcessoRapido`: 56 de altura (48 o
 * terciário), raio 14, logotipo oficial à esquerda do texto, três níveis de
 * peso e retorno ao toque (escala 0,98 com mola e camada de pressionado).
 * Carregando, o indicador troca o logotipo depois de 250 ms (resposta rápida
 * não pisca), no mesmo tamanho, e o rótulo continua o mesmo para o leitor de
 * tela. A Apple fica nas cores oficiais; o Google, nos temas da marca.
 */
export function BotaoDeAcesso({
  marca,
  nivel,
  titulo,
  selo,
  carregando = false,
  sucesso = false,
  inativo = false,
  motivo,
  disparoDeErro = 0,
  estadoDeVitrine,
  aoPressionar,
  ref,
}: PropsDoBotaoDeAcesso) {
  const { cores, escuro, elevacao } = useTema()
  const { reduzirMovimento, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const anel = useAnelDeFoco(cores.foco)
  const toque = useToqueComMola()
  const a = aparenciaDoAcesso({ marca, nivel, cores, escuro })
  const bloqueado = inativo || carregando || sucesso
  const mostrarMotivo = !!motivo && inativo && !carregando
  const terciario = nivel === 'terciario'
  const comBorda = aumentarContraste && !terciario
  const logoSobAcao = marca === 'acao'

  // Indicador depois de 250 ms; o check do sucesso; os demais botões esmaecem enquanto um trabalha.
  const indicador = useSharedValue(0)
  const check = useSharedValue(0)
  const apagado = useSharedValue(1)
  useEffect(() => {
    if (carregando) {
      indicador.set(
        withDelay(
          MOVIMENTO_DE_ACESSO.esperaDoIndicador,
          withTiming(1, { duration: 140, reduceMotion: ReduceMotion.Never }),
        ),
      )
    } else {
      indicador.set(withTiming(0, { duration: 100, reduceMotion: ReduceMotion.Never }))
    }
    return () => cancelAnimation(indicador)
  }, [carregando, indicador])
  useEffect(() => {
    if (sucesso) {
      check.set(
        reduzirMovimento
          ? withTiming(1, {
              duration: MOVIMENTO_DE_ACESSO.dissolver,
              reduceMotion: ReduceMotion.Never,
            })
          : withSpring(1, { ...MOLAS_DE_ACESSO.check, reduceMotion: ReduceMotion.Never }),
      )
    } else {
      check.set(0)
    }
    return () => cancelAnimation(check)
  }, [sucesso, reduzirMovimento, check])
  useEffect(() => {
    apagado.set(
      withTiming(inativo && !carregando ? 0.6 : 1, {
        duration: reduzirMovimento ? MOVIMENTO_DE_ACESSO.toqueReduzido : 140,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      }),
    )
    return () => cancelAnimation(apagado)
  }, [inativo, carregando, reduzirMovimento, apagado])

  const estiloDoApagado = useAnimatedStyle(() => ({ opacity: apagado.value }))
  const estiloDoLogo = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(indicador.value, check.value),
  }))
  const estiloDoIndicador = useAnimatedStyle(() => ({
    opacity: indicador.value * (1 - check.value),
  }))
  const estiloDoCheck = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: 0.6 + 0.4 * Math.min(check.value, 1) }],
  }))

  const camadaDeVitrine = estadoDeVitrine === 'pressionado'
  const caixaDoLogo = {
    width: LADO_DO_LOGO,
    height: LADO_DO_LOGO,
    alignItems: 'center',
    justifyContent: 'center',
  } as const
  const sobAcao = { position: 'absolute', left: ESPACO.e20 } as const

  const logo =
    a.logo === 'apple' ? (
      <LogoDaApple cor={a.texto} tamanho={LADO_DO_LOGO} />
    ) : a.logo === 'google' ? (
      <LogoDoGoogle tamanho={LADO_DO_LOGO} />
    ) : a.logo === 'email' ? (
      <Icone nome="email" cor={a.texto} tamanho={LADO_DO_LOGO} />
    ) : a.logo === 'faceId' ? (
      <Icone nome="faceId" cor={a.texto} tamanho={LADO_DO_LOGO} />
    ) : null

  return (
    <Animated.View style={[{ alignSelf: 'stretch' }, estiloDoApagado]}>
      {selo ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: ESPACO.e6,
            marginBottom: ESPACO.e8,
          }}
        >
          <Icone nome="relogio" cor={cores.textoSuave} tamanho={14} />
          <Texto variante="legenda" cor="textoSuave" peso="medio">
            {selo}
          </Texto>
        </View>
      ) : null}
      <Abalar disparo={disparoDeErro} tipo="botao">
        <Animated.View style={toque.estiloDoToque}>
          <Pressable
            ref={ref}
            accessibilityRole="button"
            accessibilityLabel={titulo}
            {...(mostrarMotivo ? { accessibilityHint: motivo } : {})}
            aria-disabled={bloqueado}
            aria-busy={carregando}
            disabled={bloqueado}
            onPress={aoPressionar}
            onPressIn={toque.aoPressionarDentro}
            onPressOut={toque.aoPressionarFora}
            onFocus={anel.onFocus}
            onBlur={anel.onBlur}
            {...soNaWeb({ 'data-acesso': marca })}
            style={[
              {
                minHeight: a.altura,
                overflow: 'hidden',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: ESPACO.e12,
                paddingHorizontal: ESPACO.e20,
                paddingVertical: ESPACO.e8,
                borderRadius: RAIO.controle,
                backgroundColor: a.fundo,
                borderWidth: comBorda ? 2 : a.borda ? 1 : 0,
                borderColor: comBorda ? a.texto : (a.borda ?? 'transparent'),
              },
              a.sombra && elevacao.cartao !== 'none' ? { boxShadow: elevacao.cartao } : null,
              anel.estilo,
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: a.camada },
                camadaDeVitrine ? { opacity: 1 } : toque.estiloDaCamada,
              ]}
            />
            {logo || logoSobAcao || carregando || sucesso ? (
              <View style={logoSobAcao ? sobAcao : undefined}>
                <View style={caixaDoLogo}>
                  {logo ? (
                    <Animated.View style={[StyleSheet.absoluteFill, caixaDoLogo, estiloDoLogo]}>
                      {logo}
                    </Animated.View>
                  ) : null}
                  <Animated.View
                    style={[StyleSheet.absoluteFill, caixaDoLogo, estiloDoIndicador]}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                  >
                    <ActivityIndicator color={a.texto} size="small" />
                  </Animated.View>
                  <Animated.View
                    style={[StyleSheet.absoluteFill, caixaDoLogo, estiloDoCheck]}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                  >
                    <Icone nome="check" cor={a.texto} tamanho={LADO_DO_LOGO} peso="forte" />
                  </Animated.View>
                </View>
              </View>
            ) : null}
            <Texto
              variante="botao"
              style={[
                { color: a.texto, flexShrink: 1 },
                terciario && aumentarContraste ? { textDecorationLine: 'underline' } : null,
              ]}
              centralizado
            >
              {titulo}
            </Texto>
          </Pressable>
        </Animated.View>
      </Abalar>
      {mostrarMotivo ? (
        <Texto variante="legenda" cor="textoSuave" style={{ marginTop: ESPACO.e6 }}>
          {motivo}
        </Texto>
      ) : null}
    </Animated.View>
  )
}
