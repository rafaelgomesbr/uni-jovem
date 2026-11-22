/* eslint-disable no-restricted-syntax -- opacidade e escala aqui são a animação do halo, não estado (D65) */
import { CURVAS, ESPACO, RAIO } from '@uj/tokens'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { useSessao } from '@/estado/sessao'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Icone } from '@/ui/Icone'
import { useRevelar } from '@/ui/primitivasDeMovimento'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { DURACAO_DO_ENCANTO_MS, reivindicarEncanto, type TipoDeEncanto } from './encantos'

/** Um encanto em cena: o tipo e o texto já com a parte da pessoa na frase. */
export interface EncantoEmCena {
  tipo: TipoDeEncanto
  texto: string
}

/**
 * O encanto do Início em cena. `mostrar` pede à regra "uma vez por conta, um por sessão" e só
 * mexe na tela se ela deixar (devolve `true`); `encerrar` tira a faixa. Nada aqui bloqueia o
 * toque: a faixa é uma região de status e some sozinha em 4 s.
 */
export function useEncantoDoInicio() {
  const { conta } = useSessao()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const contaId = conta?.id
  const [emCena, setEmCena] = useState<EncantoEmCena | null>(null)
  // O sol e o halo se mexem por 1,5 s; com Reduzir movimento nunca (só a faixa de texto fica).
  const [animando, setAnimando] = useState(false)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)

  // O relógio é externo à tela: some com ela.
  useEffect(
    () => () => {
      if (relogio.current) clearTimeout(relogio.current)
    },
    [],
  )

  const mostrar = useCallback(
    async (tipo: TipoDeEncanto, texto: string): Promise<boolean> => {
      if (!(await reivindicarEncanto(contaId, tipo))) return false
      setEmCena({ tipo, texto })
      if (!reduzirMovimento) {
        setAnimando(true)
        if (relogio.current) clearTimeout(relogio.current)
        relogio.current = setTimeout(() => setAnimando(false), 1_500)
      }
      return true
    },
    [contaId, reduzirMovimento],
  )
  const encerrar = useCallback(() => setEmCena(null), [])
  return { emCena, animando, mostrar, encerrar }
}

/**
 * A faixa de texto do encanto: o sol pequeno e a frase, 4 s, recolhe em 200 ms. É o encanto
 * inteiro para quem usa Reduzir movimento (a animação do halo e do sol não existe para eles).
 * Região `status`: o leitor de tela lê a frase uma vez, sem roubar o foco.
 */
export function FaixaDoEncanto({ texto, aoTerminar }: { texto: string; aoTerminar: () => void }) {
  const { cores } = useTema()
  const [visivel, setVisivel] = useState(true)
  const estilo = useRevelar(visivel)

  // O relógio da faixa é externo à tela: a faixa some sozinha e depois avisa quem a montou.
  useEffect(() => {
    const sair = setTimeout(() => setVisivel(false), DURACAO_DO_ENCANTO_MS)
    const fim = setTimeout(aoTerminar, DURACAO_DO_ENCANTO_MS + 200)
    return () => {
      clearTimeout(sair)
      clearTimeout(fim)
    }
  }, [aoTerminar])

  return (
    <Animated.View
      testID="faixa-do-encanto"
      role="status"
      accessibilityLiveRegion="polite"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e8,
          minHeight: 44,
          paddingHorizontal: ESPACO.e4,
        },
        estilo,
      ]}
    >
      <Icone nome="sol" cor={cores.destaque} tamanho={20} />
      <Texto variante="rotulo" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </Animated.View>
  )
}

/**
 * O halo do primeiro "Aceitar" (encanto 1): um brilho coral atrás do cartão que nasce em 600
 * ms (opacidade de 0 a 0,35, escala de 0,8 a 1) e some em 400 ms. Com Reduzir movimento não
 * existe: fica só a faixa de texto. Decorativo e sem toque.
 */
export function HaloDoEncanto({ ativo }: { ativo: boolean }) {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const progresso = useSharedValue(0)

  // A animação é um sistema externo: roda quando o encanto liga.
  useEffect(() => {
    if (!ativo || reduzirMovimento) return
    progresso.set(0)
    progresso.set(
      withSequence(
        withTiming(1, {
          duration: 600,
          easing: Easing.bezier(...CURVAS.nasce),
          reduceMotion: ReduceMotion.Never,
        }),
        withTiming(0, {
          duration: 400,
          easing: Easing.bezier(...CURVAS.padrao),
          reduceMotion: ReduceMotion.Never,
        }),
      ),
    )
    return () => cancelAnimation(progresso)
  }, [ativo, reduzirMovimento, progresso])

  const estilo = useAnimatedStyle(() => ({
    opacity: 0.35 * progresso.value,
    transform: [{ scale: 0.8 + 0.2 * Math.min(1, progresso.value) }],
  }))

  if (!ativo || reduzirMovimento) return null
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: -24, right: -24, top: -24, bottom: -24 }}
    >
      <Animated.View
        testID="halo-do-encanto"
        style={[
          {
            flex: 1,
            borderRadius: RAIO.barra,
            backgroundImage: `radial-gradient(circle at 80% 20%, ${cores.brilhoHorizonte}, transparent 70%)`,
          },
          estilo,
        ]}
      />
    </View>
  )
}
