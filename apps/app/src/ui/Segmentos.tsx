/* eslint-disable no-restricted-syntax -- opacidade aqui é a camada do polegar que dissolve, não estado (D64) */
import { ALTURA, ESPACO, MOVIMENTO_DOS_CONTROLES, RAIO, RITMO, TIPO } from '@uj/tokens'
import { useEffect, useState } from 'react'
import { Pressable, useWindowDimensions, View, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { LARGURA_MAXIMA_DO_CONTEUDO } from '@/constantes'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import type { NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { PilulasDeFiltro } from './PilulasDeFiltro'
import { useSetasDoGrupo } from './setasDoGrupo'
import { Texto } from './Texto'
import { useTema } from './tema'

export interface Segmento<T extends string> {
  valor: T
  /** Até 12 caracteres: o segmento nunca quebra linha. */
  rotulo: string
  /** Mantido por compatibilidade; o segmento não mostra ícone (2.12.4). */
  icone?: NomeDoIcone
}

interface PropsDosSegmentos<T extends string> {
  /** Nome do grupo, lido pelo leitor de tela (ex.: "Modo de exibição"). */
  rotulo: string
  /** No máximo 4. */
  segmentos: readonly Segmento<T>[]
  /** `null` quando nada foi escolhido ainda. */
  valor: T | null
  aoMudar: (valor: T) => void
}

/** Trilho (2.12.4): padding de 4 e 4 entre os segmentos. */
const PADDING_DO_TRILHO = ESPACO.e4
const INTERVALO = ESPACO.e4

/**
 * Tipo e padding do segmento. Quando o rótulo não cabe no normal, o
 * compacto: 14 (a `legenda`, com o peso do segmento) e padding de 4. Em 360
 * pt, 4 segmentos iguais deixam 59 para o texto, e "Preparação" no `botao`
 * pede 83.
 */
const NIVEIS = {
  normal: { variante: 'botao', padding: ESPACO.e8 },
  compacto: { variante: 'legenda', padding: ESPACO.e4 },
} as const

type Nivel = keyof typeof NIVEIS

export interface Disposicao {
  nivel: Nivel
  /**
   * Larguras pelo conteúdo, com a sobra dividida igual (como o
   * `apportionsSegmentWidthsByContent` do iOS): quando o rótulo mais longo
   * não cabe na largura igual, mas a soma de todos cabe no trilho.
   */
  proporcional: boolean
  /**
   * Quatro opções em duas linhas de duas, de largura igual: quando nem o
   * compacto cabe numa linha só. Melhor que pílulas roláveis, em que a opção
   * da direita só se alcança por gesto (auditoria U-18).
   */
  grade?: true
  /**
   * Uma opção embaixo da outra, cada uma com a largura toda: com fonte grande,
   * dois ou três rótulos não dividem a linha, e pílula rolável esconde a
   * segunda opção atrás de um gesto (D62; auditoria 21/11/2026, A1).
   */
  pilha?: true
}

/**
 * Largura de um rótulo no Inter 600, por excesso: maiúsculas e m/w largas;
 * i, l, j, t, f, r e espaço estreitas. Medido no Inter 600 a 15: "Preparação"
 * 83 (estimado 87), "Improcedentes" 109 (117), "Mês" 31 (31).
 */
export function larguraEstimada(rotulo: string, tamanho: number): number {
  let em = 0
  for (const c of rotulo) {
    em += /[mwMW]/.test(c) ? 0.9 : /[A-ZÀ-Ý]/.test(c) ? 0.8 : /[iljtfr ]/.test(c) ? 0.36 : 0.6
  }
  return em * tamanho
}

function larguras(rotulos: readonly string[], nivel: Nivel, escala: number): number[] {
  const { variante, padding } = NIVEIS[nivel]
  const papel = TIPO[variante]
  const tamanho = papel.tamanho * Math.min(escala, papel.teto ?? escala)
  return rotulos.map((r) => larguraEstimada(r, tamanho) + 2 * padding)
}

/**
 * Como os rótulos cabem num trilho desta largura, sem cortar nenhum: iguais,
 * depois proporcionais, no normal e depois no compacto (com 4 opções, só no
 * compacto); com 4, ainda a grade de duas linhas. `null`: nem assim; vira
 * pílulas roláveis. `soGrade`: com fonte grande, uma linha só não serve.
 */
export function escolherDisposicao(
  rotulos: readonly string[],
  largura: number,
  escala = 1,
  borda = 0,
  soGrade = false,
): Disposicao | null {
  const n = rotulos.length
  if (n === 0) return { nivel: 'normal', proporcional: false }
  const util = largura - 2 * (PADDING_DO_TRILHO + borda) - (n - 1) * INTERVALO
  const niveis: readonly Nivel[] = soGrade ? [] : n >= 4 ? ['compacto'] : ['normal', 'compacto']
  for (const nivel of niveis) {
    const medidas = larguras(rotulos, nivel, escala)
    if (Math.max(...medidas) * n <= util) return { nivel, proporcional: false }
    if (medidas.reduce((a, b) => a + b, 0) <= util) return { nivel, proporcional: true }
  }
  // Fonte grande: nunca pílulas roláveis; as opções empilham (a grade só vale para quatro).
  if (soGrade && n !== 4) return { nivel: 'normal', proporcional: false, pilha: true }
  if (n !== 4) return null
  const celula = (largura - 2 * (PADDING_DO_TRILHO + borda) - INTERVALO) / 2
  for (const nivel of ['normal', 'compacto'] as const) {
    if (Math.max(...larguras(rotulos, nivel, escala)) <= celula) {
      return { nivel, proporcional: false, grade: true }
    }
  }
  return soGrade ? { nivel: 'normal', proporcional: false, pilha: true } : null
}

/**
 * Fundo do polegar do segmento escolhido: uma camada que só muda de `opacity`
 * (200 ms; 120 com "Reduzir movimento"), em vez de animar a cor.
 */
function FundoDoPolegar({ marcado }: { marcado: boolean }) {
  const { cores, solido } = useTema()
  const { aumentarContraste, reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const progresso = useSharedValue(marcado ? 1 : 0)
  useEffect(() => {
    progresso.set(
      withTiming(marcado ? 1 : 0, {
        duration: reduzirMovimento
          ? MOVIMENTO_DOS_CONTROLES.dissolver
          : MOVIMENTO_DOS_CONTROLES.segmento,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        reduceMotion: ReduceMotion.Never,
      }),
    )
  }, [marcado, reduzirMovimento, progresso])
  const estilo = useAnimatedStyle(() => ({ opacity: progresso.value }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: RAIO.pilula,
          backgroundColor: solido(cores.quenteFundo),
          borderWidth: aumentarContraste ? 2 : 0,
          borderColor: aumentarContraste ? cores.texto : 'transparent',
        },
        estilo,
      ]}
    />
  )
}

/**
 * Segmentos (seção 2.12.4, D64): trilho em cápsula de largura total (48,
 * tonal) com segmentos de largura igual (40, cápsula). O escolhido tem o fundo
 * quente, o texto em `destaque` e peso 600: forma e peso além da cor. Papel `radio` para o leitor de
 * tela. Nenhum rótulo é cortado: sem espaço para larguras iguais, o tipo fica
 * compacto e as larguras seguem o conteúdo; se nem assim couber, vira pílulas
 * de filtro roláveis. Com fonte grande (1,35 ou mais) nunca rola de lado: as
 * opções empilham, uma por linha (quatro opções ainda tentam a grade antes).
 */
export function Segmentos<T extends string>({
  rotulo,
  segmentos,
  valor,
  aoMudar,
}: PropsDosSegmentos<T>) {
  const { cores, solido } = useTema()
  const { aumentarContraste, reduzirTransparencia } = usePreferenciasDeAcessibilidade()
  const { fontScale, width } = useWindowDimensions()
  const propsDaOpcao = useSetasDoGrupo(segmentos, valor, aoMudar)
  // Até medir o trilho, a largura de uma tela comum (margem de 20 dos dois lados).
  const [largura, setLargura] = useState<number | null>(null)
  const larguraDoTrilho =
    largura ?? Math.min(width - 2 * RITMO.margemDaTela, LARGURA_MAXIMA_DO_CONTEUDO)
  const borda = aumentarContraste ? 2 : 0
  // Com fonte grande, o trilho de uma linha não comporta o texto: só a grade (ou as pílulas).
  const disposicao = escolherDisposicao(
    segmentos.map((s) => s.rotulo),
    larguraDoTrilho,
    fontScale,
    borda,
    fontScale >= 1.35,
  )

  const conteudo =
    disposicao === null ? (
      <PilulasDeFiltro
        rotulo={rotulo}
        pilulas={segmentos}
        selecionadas={valor ? [valor] : []}
        aoMudar={(v) => {
          if (v[0]) aoMudar(v[0])
        }}
      />
    ) : (
      <View
        accessibilityRole="radiogroup"
        aria-label={rotulo}
        style={{
          flexDirection: disposicao.pilha ? 'column' : 'row',
          flexWrap: disposicao.grade ? 'wrap' : 'nowrap',
          alignSelf: 'stretch',
          minHeight: ALTURA.trilho,
          padding: PADDING_DO_TRILHO,
          gap: INTERVALO,
          borderRadius: RAIO.pilula,
          backgroundColor: reduzirTransparencia ? cores.tonalOpaco : solido(cores.tonal),
          borderWidth: borda,
          borderColor: aumentarContraste ? cores.texto : 'transparent',
        }}
      >
        {segmentos.map((s) => {
          const marcado = s.valor === valor
          const { variante, padding } = NIVEIS[disposicao.nivel]
          // Na grade, 45% mais o intervalo: duas por linha, a sobra dividida igual.
          const medida: ViewStyle = disposicao.pilha
            ? { alignSelf: 'stretch' }
            : disposicao.grade
              ? { flexGrow: 1, flexBasis: '45%' }
              : disposicao.proporcional
                ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' }
                : { flex: 1 }
          return (
            <Pressable
              key={s.valor}
              {...propsDaOpcao(s.valor)}
              accessibilityRole="radio"
              accessibilityLabel={s.rotulo}
              aria-checked={marcado}
              onPress={() => aoMudar(s.valor)}
              // O polegar tem 40; os 4 de cima e de baixo completam os 48 de alvo de toque.
              hitSlop={{ top: PADDING_DO_TRILHO, bottom: PADDING_DO_TRILHO }}
              style={({ pressed }) => [
                medida,
                {
                  minHeight: disposicao.pilha ? ALVO : ALTURA.polegar,
                  paddingHorizontal: padding,
                  borderRadius: RAIO.pilula,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: !marcado && pressed ? cores.pressionado : 'transparent',
                },
              ]}
            >
              <FundoDoPolegar marcado={marcado} />
              <Texto
                variante={variante}
                peso={marcado ? 'forte' : 'medio'}
                cor={marcado ? 'destaque' : 'textoSuave'}
                {...(disposicao.pilha ? {} : { numberOfLines: 1 })}
              >
                {s.rotulo}
              </Texto>
            </Pressable>
          )
        })}
      </View>
    )

  // A medida vem do invólucro, que existe nas duas formas (trilho e pílulas).
  return (
    <View
      style={{ alignSelf: 'stretch' }}
      onLayout={(e) => {
        const medida = Math.round(e.nativeEvent.layout.width)
        if (medida > 0 && medida !== largura) setLargura(medida)
      }}
    >
      {conteudo}
    </View>
  )
}
