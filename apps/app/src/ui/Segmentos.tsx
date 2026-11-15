import { ALTURA, ESPACO, RAIO, RITMO, TIPO } from '@uj/tokens'
import { useState } from 'react'
import { Pressable, useWindowDimensions, View, type ViewStyle } from 'react-native'

import { LARGURA_MAXIMA_DO_CONTEUDO } from '@/constantes'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import type { NomeDoIcone } from './Icone'
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
 * Tipo e padding do segmento. Com 4 opções, ou quando o rótulo não cabe no
 * normal, o compacto: `rotulo` (13) e padding de 4. Em 360 pt, 4 segmentos
 * iguais deixam 59 para o texto, e "Preparação" no `botao` pede 83.
 */
const NIVEIS = {
  normal: { variante: 'botao', padding: ESPACO.e8 },
  compacto: { variante: 'rotulo', padding: ESPACO.e4 },
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

/**
 * Como os rótulos cabem num trilho desta largura, sem cortar nenhum: iguais,
 * depois proporcionais, no normal e depois no compacto (com 4 opções, só no
 * compacto). `null`: nem assim; vira pílulas roláveis.
 */
export function escolherDisposicao(
  rotulos: readonly string[],
  largura: number,
  escala = 1,
  borda = 0,
): Disposicao | null {
  const n = rotulos.length
  if (n === 0) return { nivel: 'normal', proporcional: false }
  const util = largura - 2 * (PADDING_DO_TRILHO + borda) - (n - 1) * INTERVALO
  const niveis: readonly Nivel[] = n >= 4 ? ['compacto'] : ['normal', 'compacto']
  for (const nivel of niveis) {
    const { variante, padding } = NIVEIS[nivel]
    const papel = TIPO[variante]
    const tamanho = papel.tamanho * Math.min(escala, papel.teto ?? escala)
    const larguras = rotulos.map((r) => larguraEstimada(r, tamanho) + 2 * padding)
    if (Math.max(...larguras) * n <= util) return { nivel, proporcional: false }
    if (larguras.reduce((a, b) => a + b, 0) <= util) return { nivel, proporcional: true }
  }
  return null
}

/**
 * Segmentos (seção 2.12.4): trilho de largura total (44, raio 14, tonal) com
 * segmentos de largura igual (36, raio 10). O escolhido tem polegar em
 * relevo e peso 600: forma e peso além da cor. Papel `radio` para o leitor de
 * tela. Nenhum rótulo é cortado: sem espaço para larguras iguais, o tipo fica
 * compacto e as larguras seguem o conteúdo; com fonte grande, ou se nem assim
 * couber, vira pílulas de filtro roláveis.
 */
export function Segmentos<T extends string>({
  rotulo,
  segmentos,
  valor,
  aoMudar,
}: PropsDosSegmentos<T>) {
  const { cores, escuro, elevacao, solido } = useTema()
  const { aumentarContraste, reduzirTransparencia } = usePreferenciasDeAcessibilidade()
  const { fontScale, width } = useWindowDimensions()
  const propsDaOpcao = useSetasDoGrupo(segmentos, valor, aoMudar)
  // Até medir o trilho, a largura de uma tela comum (margem de 20 dos dois lados).
  const [largura, setLargura] = useState<number | null>(null)
  const larguraDoTrilho =
    largura ?? Math.min(width - 2 * RITMO.margemDaTela, LARGURA_MAXIMA_DO_CONTEUDO)
  const borda = aumentarContraste ? 2 : 0
  const disposicao =
    fontScale >= 1.35
      ? null
      : escolherDisposicao(
          segmentos.map((s) => s.rotulo),
          larguraDoTrilho,
          fontScale,
          borda,
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
          flexDirection: 'row',
          alignSelf: 'stretch',
          minHeight: ALTURA.iconeSo,
          padding: PADDING_DO_TRILHO,
          gap: INTERVALO,
          borderRadius: RAIO.controle,
          backgroundColor: reduzirTransparencia ? cores.tonalOpaco : solido(cores.tonal),
          borderWidth: borda,
          borderColor: aumentarContraste ? cores.texto : 'transparent',
        }}
      >
        {segmentos.map((s) => {
          const marcado = s.valor === valor
          const { variante, padding } = NIVEIS[disposicao.nivel]
          const medida: ViewStyle = disposicao.proporcional
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
              style={({ pressed }) => [
                medida,
                {
                  minHeight: 36,
                  paddingHorizontal: padding,
                  borderRadius: RAIO.celula,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: marcado
                    ? escuro
                      ? cores.tonalBorda
                      : cores.superficie
                    : pressed
                      ? cores.pressionado
                      : 'transparent',
                  borderWidth: marcado && aumentarContraste ? 2 : 0,
                  borderColor: aumentarContraste ? cores.texto : 'transparent',
                },
                // Claro: polegar branco com anel interno de 1 no contorno e a sombra de cartão.
                marcado && !escuro && !aumentarContraste
                  ? {
                      boxShadow: [`inset 0px 0px 0px 1px ${cores.contorno}`, elevacao.cartao].join(
                        ', ',
                      ),
                    }
                  : null,
              ]}
            >
              <Texto
                variante={variante}
                peso={marcado ? 'forte' : 'medio'}
                cor={marcado ? 'texto' : 'textoSuave'}
                numberOfLines={1}
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
