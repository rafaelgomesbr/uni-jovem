import { CURVAS, ESPACO, MOVIMENTO_DAS_TELAS } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { EscalaDoInicio } from '@/servicos/contratoDosEventos'
import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Chip } from '@/ui/Chip'
import { DeslizarParaResponder } from '@/ui/DeslizarParaResponder'
import { Secao } from '@/ui/Secao'

import { useRespostasOtimistas } from '../escalas/respostasOtimistas'
import { descreverParte } from './momento'
import { dataCurta } from './quando'

export const MOTIVO_SEM_INTERNET = 'Precisa de internet para responder.'

interface Props {
  /** As convocações esperando resposta (já sem as que a pessoa acabou de responder). */
  itens: readonly EscalaDoInicio[]
  fuso: string
  semInternet: boolean
  aoAceitar: (item: EscalaDoInicio) => void
  aoRecusar: (item: EscalaDoInicio) => void
}

/**
 * Uma linha que encolhe em 200 ms quando a pessoa responde (a altura é a exceção declarada do
 * movimento, 9 da direção A). Com Reduzir movimento, some na hora. A linha continua montada
 * até o fim do encolher; `aoTerminar` avisa quem a tira da lista.
 */
function LinhaQueEncolhe({
  encolher,
  aoTerminar,
  children,
}: {
  encolher: boolean
  aoTerminar: () => void
  children: ReactNode
}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const altura = useSharedValue<number | null>(null)
  const progresso = useSharedValue(1)
  const medida = useRef(0)

  // A animação é um sistema externo: roda quando a resposta é dada.
  useEffect(() => {
    if (!encolher) {
      progresso.set(1)
      return
    }
    if (reduzirMovimento || medida.current === 0) {
      progresso.set(0)
      aoTerminar()
      return
    }
    progresso.set(
      withTiming(0, {
        duration: MOVIMENTO_DAS_TELAS.linhaEncolhe,
        easing: Easing.bezier(...CURVAS.padrao),
        reduceMotion: ReduceMotion.Never,
      }),
    )
    const fim = setTimeout(aoTerminar, MOVIMENTO_DAS_TELAS.linhaEncolhe)
    return () => {
      clearTimeout(fim)
      cancelAnimation(progresso)
    }
  }, [encolher, reduzirMovimento, progresso, aoTerminar])

  const estilo = useAnimatedStyle(() => ({
    opacity: progresso.value,
    ...(altura.value !== null && progresso.value < 1
      ? { height: altura.value * progresso.value, overflow: 'hidden' as const }
      : {}),
  }))

  function medir(e: LayoutChangeEvent) {
    if (progresso.value >= 1) {
      medida.current = e.nativeEvent.layout.height
      altura.set(e.nativeEvent.layout.height)
    }
  }

  return (
    <Animated.View onLayout={medir} style={estilo}>
      {children}
    </Animated.View>
  )
}

/**
 * "Para responder (n)" (3.1 do UX): as convocações de OUTROS encontros que esperam a pessoa
 * (o do cartão de cima responde dentro do cartão). Cada linha tem "Aceitar" e "Não posso ir"
 * sempre visíveis e, como atalho, deslizar para a direita aceita (a esquerda só revela "Não
 * posso ir"). O toque no nome abre o encontro. Quem responde encolhe em 200 ms (a resposta
 * em espera vem de `useRespostasOtimistas`) e volta se a pessoa desfaz. Sem internet, os botões
 * ficam desabilitados com o motivo escrito.
 */
export function ParaResponder({ itens, fuso, semInternet, aoAceitar, aoRecusar }: Props) {
  const otimistas = useRespostasOtimistas()
  // Linhas que já terminaram de encolher: só somem de vez enquanto a resposta segue em espera.
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(new Set())
  const aindaPrecisam = itens.filter((i) => !otimistas.has(i.id))
  const visiveis = itens.filter((i) => !(ocultas.has(i.id) && otimistas.has(i.id)))
  if (visiveis.length === 0) return null

  return (
    <Secao titulo={`Para responder (${aindaPrecisam.length})`}>
      <View style={{ gap: ESPACO.e12 }}>
        {visiveis.map((item) => (
          <LinhaQueEncolhe
            key={item.id}
            encolher={otimistas.has(item.id)}
            aoTerminar={() => setOcultas((atual) => new Set(atual).add(item.id))}
          >
            <DeslizarParaResponder
              titulo={descreverParte(item)}
              descricao={`${dataCurta(item.eventoInicio, fuso)} · ${item.eventoTitulo}`}
              extra={<Chip situacao="aguardando" texto="Aguardando sua resposta" />}
              aoAceitar={() => aoAceitar(item)}
              aoRecusar={() => aoRecusar(item)}
              desabilitado={semInternet}
              motivo={MOTIVO_SEM_INTERNET}
              aoPressionar={() =>
                router.push({
                  pathname: '/evento/[eventoId]',
                  params: { eventoId: item.eventoId },
                })
              }
            />
          </LinhaQueEncolhe>
        ))}
      </View>
    </Secao>
  )
}
