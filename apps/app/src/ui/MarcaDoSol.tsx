/* eslint-disable no-restricted-syntax -- opacidade aqui é animação de entrada, não estado (D63) */
import {
  CASCATA_DE_ABERTURA,
  CURVAS_DE_ACESSO,
  GEOMETRIA_DO_SOL,
  MARCA_DO_SOL,
  MOVIMENTO_DE_ACESSO,
  PROPORCAO_DO_HALO,
} from '@uj/tokens'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Line,
} from 'react-native-svg'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import {
  barrasDoSol,
  caminhoDoCorpo,
  CENTRO_DO_SOL,
  FRACAO_DO_HORIZONTE,
  raiosDoSol,
  VIEWBOX_DO_SOL,
} from './geometriaDoSol'
import { useTema } from './tema'

const SAIDA = Easing.bezier(...CURVAS_DE_ACESSO.saida)

interface PropsDaPeca {
  lado: number
  animar: boolean
  atraso: number
  duracao: number
  /** Escala inicial (1 = sem escala). */
  escala?: number
  escalaX?: number
  /** Sobe de baixo: deslocamento inicial em pt. */
  dy?: number
  /** O fim da opacidade, em fração da duração (o corpo do sol aparece nos primeiros 40%). */
  fracaoDaOpacidade?: number
  /** Ponto de partida da escala, em pt dentro do quadrado do sol. */
  origem?: { x: number; y: number }
  children: ReactNode
}

/**
 * Uma peça do sol que nasce: opacidade mais escala ou deslocamento, a partir
 * do estado final (nada muda de tamanho nem de lugar no layout). Com "Reduzir
 * movimento", só dissolve em 120 ms.
 */
function PecaAnimada({
  lado,
  animar,
  atraso,
  duracao,
  escala = 1,
  escalaX = 1,
  dy = 0,
  fracaoDaOpacidade = 1,
  origem,
  children,
}: PropsDaPeca) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const progresso = useSharedValue(animar ? 0 : 1)

  useEffect(() => {
    if (!animar) return
    progresso.set(
      withDelay(
        reduzirMovimento ? 0 : atraso,
        withTiming(1, {
          duration: reduzirMovimento ? MOVIMENTO_DE_ACESSO.dissolver : duracao,
          easing: SAIDA,
          reduceMotion: ReduceMotion.Never,
        }),
      ),
    )
    return () => cancelAnimation(progresso)
  }, [animar, reduzirMovimento, atraso, duracao, progresso])

  const movimentar = !reduzirMovimento
  const estilo = useAnimatedStyle(() => {
    const p = progresso.value
    return {
      opacity: Math.min(1, p / fracaoDaOpacidade),
      transform: movimentar
        ? [
            { translateY: dy * (1 - p) },
            { scaleX: escalaX + (1 - escalaX) * p },
            { scale: escala + (1 - escala) * p },
          ]
        : [],
    }
  })

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, top: 0, width: lado, height: lado },
        origem ? { transformOrigin: [origem.x, origem.y] } : null,
        estilo,
      ]}
    >
      {children}
    </Animated.View>
  )
}

function Halo({
  lado,
  animar,
  pulso,
  cor,
  id,
}: {
  lado: number
  animar: boolean
  pulso: number
  cor: string
  id: string
}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const progresso = useSharedValue(animar ? 0 : 1)
  const resposta = useSharedValue(1)
  const pulsoAnterior = useRef(pulso)
  const tamanhoDoHalo = lado * PROPORCAO_DO_HALO

  useEffect(() => {
    if (!animar) return
    const { atraso, duracao } = CASCATA_DE_ABERTURA.halo
    progresso.set(
      withDelay(
        reduzirMovimento ? 0 : atraso,
        withTiming(1, {
          duration: reduzirMovimento ? MOVIMENTO_DE_ACESSO.dissolver : duracao,
          easing: SAIDA,
          reduceMotion: ReduceMotion.Never,
        }),
      ),
    )
    return () => cancelAnimation(progresso)
  }, [animar, reduzirMovimento, progresso])

  // O sucesso faz o halo respirar uma vez: 1, 1,12 e 1 em 360 ms (sem Reduzir movimento).
  useEffect(() => {
    if (pulso === pulsoAnterior.current) return
    pulsoAnterior.current = pulso
    if (reduzirMovimento) return
    const meio = {
      duration: MOVIMENTO_DE_ACESSO.dissolver + 60,
      easing: SAIDA,
      reduceMotion: ReduceMotion.Never,
    }
    resposta.set(withSequence(withTiming(1.12, meio), withTiming(1, meio)))
    return () => cancelAnimation(resposta)
  }, [pulso, reduzirMovimento, resposta])

  const movimentar = !reduzirMovimento
  const estilo = useAnimatedStyle(() => {
    const p = progresso.value
    const escala = (movimentar ? 0.8 + 0.2 * p : 1) * resposta.value
    return { opacity: p, transform: [{ scale: escala }] }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: tamanhoDoHalo,
          height: tamanhoDoHalo,
          left: lado * CENTRO_DO_SOL.x - tamanhoDoHalo / 2,
          top: lado * CENTRO_DO_SOL.y - tamanhoDoHalo / 2,
        },
        estilo,
      ]}
    >
      <Svg width={tamanhoDoHalo} height={tamanhoDoHalo}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={semAlfa(cor)} stopOpacity={Number(alfaDa(cor))} />
            <Stop offset="1" stopColor={semAlfa(cor)} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50%" cy="50%" r="50%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  )
}

/** O alfa de um `rgba(r,g,b,a)`. */
function alfaDa(cor: string): string {
  return /,\s*([\d.]+)\s*\)$/.exec(cor)?.[1] ?? '1'
}

/** O `rgb(r,g,b)` de um `rgba(r,g,b,a)`, para o `stopColor` (o alfa vai em `stopOpacity`). */
function semAlfa(cor: string): string {
  const m = /^rgba\(([^)]*),[^,]*\)$/.exec(cor)
  return m ? `rgb(${m[1]})` : cor
}

interface PropsDaMarcaDoSol {
  /** Lado do quadrado do sol: 112, 96, 88, 72 ou 56 na entrada, 32 no painel. */
  lado: number
  /** `abertura`: o sol nasce (780 ms); `estatica`: já no lugar, sem movimento. */
  etapa?: 'abertura' | 'estatica'
  /** Cada vez que sobe, o halo respira uma vez (o sucesso). */
  pulso?: number
  /** O halo é um desenho à parte, maior que o sol: o sol mini dispensa. */
  halo?: boolean
}

/**
 * A marca (D63): o sol do ícone do app, sem o quadrado, redesenhado em SVG em
 * peças separadas (halo, 2 barras de horizonte, corpo e 5 raios) para nascer
 * de trás do horizonte. É decorativo: o nome do app em texto faz o papel de
 * título. O corpo é recortado pelo horizonte (contêiner com `overflow`).
 */
export function MarcaDoSol({
  lado,
  etapa = 'estatica',
  pulso = 0,
  halo = true,
}: PropsDaMarcaDoSol) {
  const { nome } = useTema()
  const cores = MARCA_DO_SOL[nome]
  const animar = etapa === 'abertura'
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const idDoCorpo = `corpo${id}`
  const idDoHalo = `halo${id}`
  const { barra1, barra2 } = barrasDoSol()
  const raios = raiosDoSol()
  const c = CASCATA_DE_ABERTURA
  const alturaDoHorizonte = lado * FRACAO_DO_HORIZONTE

  const quadro = (conteudo: ReactNode, defs?: ReactNode) => (
    <Svg width={lado} height={lado} viewBox={VIEWBOX_DO_SOL}>
      {defs}
      {conteudo}
    </Svg>
  )

  return (
    <View
      pointerEvents="none"
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: lado, height: lado }}
    >
      {halo ? (
        <Halo lado={lado} animar={animar} pulso={pulso} cor={cores.halo} id={idDoHalo} />
      ) : null}
      <PecaAnimada
        lado={lado}
        animar={animar}
        atraso={c.barra1.atraso}
        duracao={c.barra1.duracao}
        escalaX={0.6}
      >
        {quadro(
          <Rect
            x={barra1.x}
            y={barra1.y}
            width={barra1.largura}
            height={barra1.altura}
            rx={barra1.raio}
            fill={cores.barra1}
          />,
        )}
      </PecaAnimada>
      <PecaAnimada
        lado={lado}
        animar={animar}
        atraso={c.barra2.atraso}
        duracao={c.barra2.duracao}
        escalaX={0.6}
      >
        {quadro(
          <Rect
            x={barra2.x}
            y={barra2.y}
            width={barra2.largura}
            height={barra2.altura}
            rx={barra2.raio}
            fill={cores.barra2}
            fillOpacity={cores.barra2Alfa}
          />,
        )}
      </PecaAnimada>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: lado,
          height: alturaDoHorizonte,
          overflow: 'hidden',
        }}
      >
        <PecaAnimada
          lado={lado}
          animar={animar}
          atraso={c.corpo.atraso}
          duracao={c.corpo.duracao}
          dy={lado * 0.2}
          fracaoDaOpacidade={0.4}
        >
          {quadro(
            <Path d={caminhoDoCorpo()} fill={`url(#${idDoCorpo})`} />,
            <Defs>
              <LinearGradient id={idDoCorpo} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={cores.corpoTopo} />
                <Stop offset="1" stopColor={cores.corpoBase} />
              </LinearGradient>
            </Defs>,
          )}
        </PecaAnimada>
      </View>
      {raios.map((raio, i) => (
        <PecaAnimada
          key={raio.angulo}
          lado={lado}
          animar={animar}
          atraso={c.raio.atraso + c.raio.passo * i}
          duracao={c.raio.duracao}
          escala={0.6}
          origem={{ x: raio.origem.x * lado, y: raio.origem.y * lado }}
        >
          {quadro(
            <Line
              x1={raio.x1}
              y1={raio.y1}
              x2={raio.x2}
              y2={raio.y2}
              stroke={cores.raio}
              strokeWidth={GEOMETRIA_DO_SOL.raios.espessura}
              strokeLinecap="round"
            />,
          )}
        </PecaAnimada>
      ))}
    </View>
  )
}
