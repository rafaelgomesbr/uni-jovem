/* eslint-disable no-restricted-syntax -- opacidade aqui é a pose do sol, animação e não estado (D65) */
import {
  CURVAS,
  MARCA_DO_SOL,
  MOVIMENTO_DAS_TELAS,
  POSES_DO_SOL,
  SOL_POENTE,
  GEOMETRIA_DO_SOL,
  type PoseDoSol,
} from '@uj/tokens'
import { useEffect, useId, type ReactNode } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Defs,
  Ellipse,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
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

/** O quadro do sol tem 712 unidades de lado: a pose fala em unidades, a tela em pt. */
const QUADRO = GEOMETRIA_DO_SOL.quadro.lado

interface Alvo {
  opacidade: number
  escala: number
  /** Deslocamento vertical, em fração do lado (o corpo desce atrás do horizonte). */
  y: number
}

interface PropsDaPeca {
  lado: number
  alvo: Alvo
  /** De onde a peça parte na primeira vez que aparece (o alvo, se não houver). */
  partida?: Alvo
  /** Espera antes de a peça começar (os raios nascem um depois do outro). */
  atraso?: number
  /** Escala a partir do centro do corpo (os raios abrem e fecham dali). */
  escalaDoCentro?: boolean
  children: ReactNode
  testID?: string
}

/**
 * Uma peça do sol: opacidade, escala e deslocamento vão ao alvo da pose em 600 ms,
 * curva `nasce`. Com "Reduzir movimento", só a opacidade anima (120 ms) e a escala
 * e o deslocamento já aparecem no lugar final. Cada peça é um componente: um hook
 * por peça, nunca em laço (React Compiler).
 */
function PecaDoSol({
  lado,
  alvo,
  partida,
  atraso = 0,
  escalaDoCentro = false,
  children,
  testID,
}: PropsDaPeca) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const inicio = partida ?? alvo
  const opacidade = useSharedValue(inicio.opacidade)
  const escala = useSharedValue(inicio.escala)
  const y = useSharedValue(inicio.y)

  // A animação é um sistema externo (o motor do Reanimated): reage à pose nova.
  useEffect(() => {
    const config = reduzirMovimento
      ? { duration: MOVIMENTO_DAS_TELAS.dissolver }
      : { duration: MOVIMENTO_DAS_TELAS.sol.pose }
    const com = (para: number) =>
      withDelay(
        reduzirMovimento ? 0 : atraso,
        withTiming(para, {
          ...config,
          easing: Easing.bezier(...CURVAS.nasce),
          reduceMotion: ReduceMotion.Never,
        }),
      )
    opacidade.set(com(alvo.opacidade))
    if (reduzirMovimento) {
      escala.set(alvo.escala)
      y.set(alvo.y)
    } else {
      escala.set(com(alvo.escala))
      y.set(com(alvo.y))
    }
    return () => {
      cancelAnimation(opacidade)
      cancelAnimation(escala)
      cancelAnimation(y)
    }
  }, [alvo.opacidade, alvo.escala, alvo.y, reduzirMovimento, atraso, opacidade, escala, y])

  const estilo = useAnimatedStyle(() => ({
    opacity: opacidade.value,
    transform: [{ translateY: y.value * lado }, { scale: escala.value }],
  }))

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: lado, height: lado },
        escalaDoCentro
          ? { transformOrigin: [CENTRO_DO_SOL.x * lado, CENTRO_DO_SOL.y * lado] }
          : null,
        estilo,
      ]}
    >
      {children}
    </Animated.View>
  )
}

interface AlvosDaPose {
  halo: Alvo
  barra1: Alvo
  barra2: Alvo
  corpo: Alvo
  raio: Alvo
}

/** A linha da tabela `POSES_DO_SOL` vista como alvo de cada grupo. */
function alvosDaPose(pose: PoseDoSol): AlvosDaPose {
  const v = POSES_DO_SOL[pose]
  return {
    halo: { opacidade: v.halo.opacidade, escala: v.halo.escala, y: 0 },
    barra1: { opacidade: v.barra1, escala: 1, y: 0 },
    barra2: { opacidade: v.barra2, escala: 1, y: 0 },
    corpo: { opacidade: 1, escala: 1, y: v.corpoY / QUADRO },
    raio: { opacidade: v.raios.opacidade, escala: v.raios.escala, y: 0 },
  }
}

export interface PropsDoSol {
  /** Uma das cinco poses: antes do amanhecer (`escondido`), nascendo, pleno, radiante e poente. */
  pose: PoseDoSol
  /** Lado do quadrado do sol: 96 no cartão do momento, 104 a 88 nos vazios, 72, 32 ou 30. */
  lado: number
  /**
   * Pose de onde o sol parte na primeira vez que aparece (o "sobe o sol" do encanto 4:
   * `de="escondido" pose="pleno"`). Sem ela, o sol já nasce na pose pedida.
   */
  de?: PoseDoSol
  /** O halo é um desenho à parte, dentro do quadro. O sol mini (30 pt) dispensa. */
  halo?: boolean
  /**
   * Alternativa em texto. O sol é decorativo e escondido do leitor de tela; passe isto
   * só quando ele for a única informação ("Sol nascendo"). O texto ao lado já diz o mesmo.
   */
  alternativa?: string
  testID?: string
}

/**
 * O sol nascendo (direção A, D65 e D67): o fio condutor da marca em cinco poses, uma por
 * momento do encontro. Mesma geometria do ícone do app e da `MarcaDoSol`; a pose muda só
 * `transform` e `opacity` de quatro grupos (corpo, raios, halo e barras de horizonte). O
 * corpo é recortado pelo horizonte, então "descer" é transladar para baixo da linha. As
 * cores vêm de `MARCA_DO_SOL` e, no poente, de `SOL_POENTE` (por tema).
 *
 * É logotipo: fica fora da regra 1.4.11 e nunca carrega informação sozinho.
 */
export function Sol({ pose, lado, de, halo = true, alternativa, testID }: PropsDoSol) {
  const { nome } = useTema()
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const idDoCorpo = `corpo${id}`
  const idDoHalo = `halo${id}`
  const marca = MARCA_DO_SOL[nome]
  const valores = POSES_DO_SOL[pose]
  const alvos = alvosDaPose(pose)
  // Primeira renderização: parte de `de` (se houver); o efeito de cada peça leva ao alvo.
  const partidas = de ? alvosDaPose(de) : null
  const poente = valores.poente ? SOL_POENTE[nome] : null
  const corpoTopo = poente?.corpoTopo ?? marca.corpoTopo
  const corpoBase = poente?.corpoBase ?? marca.corpoBase
  const corDoRaio = poente?.raio ?? marca.raio
  const { barra1, barra2 } = barrasDoSol()
  const raios = raiosDoSol()
  const alturaDoHorizonte = lado * FRACAO_DO_HORIZONTE
  const quadro = (conteudo: ReactNode, defs?: ReactNode) => (
    <Svg width={lado} height={lado} viewBox={VIEWBOX_DO_SOL}>
      {defs}
      {conteudo}
    </Svg>
  )
  const decorativo = !alternativa
  return (
    <View
      testID={testID}
      pointerEvents="none"
      {...(decorativo
        ? {
            accessible: false,
            'aria-hidden': true,
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants' as const,
          }
        : {
            accessible: true,
            accessibilityRole: 'image' as const,
            accessibilityLabel: alternativa,
          })}
      style={{ width: lado, height: lado }}
    >
      {halo ? (
        <PecaDoSol
          lado={lado}
          testID="sol-halo"
          escalaDoCentro
          alvo={alvos.halo}
          {...(partidas ? { partida: partidas.halo } : {})}
        >
          {quadro(
            <Ellipse
              cx={GEOMETRIA_DO_SOL.centro.x}
              cy={GEOMETRIA_DO_SOL.centro.y}
              rx={320}
              ry={250}
              fill={`url(#${idDoHalo})`}
            />,
            <Defs>
              <RadialGradient id={idDoHalo} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FF8A65" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#FF8A65" stopOpacity={0} />
              </RadialGradient>
            </Defs>,
          )}
        </PecaDoSol>
      ) : null}
      <PecaDoSol
        lado={lado}
        testID="sol-barra-1"
        alvo={alvos.barra1}
        {...(partidas ? { partida: partidas.barra1 } : {})}
      >
        {quadro(
          <Rect
            x={barra1.x}
            y={barra1.y}
            width={barra1.largura}
            height={barra1.altura}
            rx={barra1.raio}
            fill={marca.barra1}
          />,
        )}
      </PecaDoSol>
      <PecaDoSol
        lado={lado}
        testID="sol-barra-2"
        alvo={alvos.barra2}
        {...(partidas ? { partida: partidas.barra2 } : {})}
      >
        {quadro(
          <Rect
            x={barra2.x}
            y={barra2.y}
            width={barra2.largura}
            height={barra2.altura}
            rx={barra2.raio}
            fill={marca.barra2}
          />,
        )}
      </PecaDoSol>
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
        <PecaDoSol
          lado={lado}
          testID="sol-corpo"
          alvo={alvos.corpo}
          {...(partidas ? { partida: partidas.corpo } : {})}
        >
          {quadro(
            <Path d={caminhoDoCorpo()} fill={`url(#${idDoCorpo})`} />,
            <Defs>
              <LinearGradient id={idDoCorpo} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={corpoTopo} />
                <Stop offset="1" stopColor={corpoBase} />
              </LinearGradient>
            </Defs>,
          )}
        </PecaDoSol>
      </View>
      {raios.map((raio, i) => (
        <PecaDoSol
          key={raio.angulo}
          lado={lado}
          testID={`sol-raio-${i}`}
          escalaDoCentro
          atraso={MOVIMENTO_DAS_TELAS.sol.passoDoRaio * i}
          alvo={alvos.raio}
          {...(partidas ? { partida: partidas.raio } : {})}
        >
          {quadro(
            <Line
              x1={raio.x1}
              y1={raio.y1}
              x2={raio.x2}
              y2={raio.y2}
              stroke={corDoRaio}
              strokeWidth={GEOMETRIA_DO_SOL.raios.espessura}
              strokeLinecap="round"
            />,
          )}
        </PecaDoSol>
      ))}
    </View>
  )
}
