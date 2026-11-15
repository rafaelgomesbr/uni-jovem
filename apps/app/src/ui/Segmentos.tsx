import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { Pressable, useWindowDimensions, View } from 'react-native'

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

/**
 * Segmentos (seção 2.12.4): trilho de largura total (44, raio 14, tonal) com
 * segmentos de largura igual (36, raio 10). O escolhido tem polegar em
 * relevo e peso 600: forma e peso além da cor. Papel `radio` para o leitor de
 * tela. Com fonte grande, vira pílulas de filtro roláveis.
 */
export function Segmentos<T extends string>({
  rotulo,
  segmentos,
  valor,
  aoMudar,
}: PropsDosSegmentos<T>) {
  const { cores, escuro, elevacao, solido } = useTema()
  const { aumentarContraste, reduzirTransparencia } = usePreferenciasDeAcessibilidade()
  const { fontScale } = useWindowDimensions()
  const propsDaOpcao = useSetasDoGrupo(segmentos, valor, aoMudar)

  if (fontScale >= 1.35) {
    return (
      <PilulasDeFiltro
        rotulo={rotulo}
        pilulas={segmentos}
        selecionadas={valor ? [valor] : []}
        aoMudar={(v) => {
          if (v[0]) aoMudar(v[0])
        }}
      />
    )
  }

  return (
    <View
      accessibilityRole="radiogroup"
      aria-label={rotulo}
      style={{
        flexDirection: 'row',
        alignSelf: 'stretch',
        minHeight: ALTURA.iconeSo,
        padding: ESPACO.e4,
        gap: ESPACO.e4,
        borderRadius: RAIO.controle,
        backgroundColor: reduzirTransparencia ? cores.tonalOpaco : solido(cores.tonal),
        borderWidth: aumentarContraste ? 2 : 0,
        borderColor: aumentarContraste ? cores.texto : 'transparent',
      }}
    >
      {segmentos.map((s) => {
        const marcado = s.valor === valor
        return (
          <Pressable
            key={s.valor}
            {...propsDaOpcao(s.valor)}
            accessibilityRole="radio"
            accessibilityLabel={s.rotulo}
            aria-checked={marcado}
            onPress={() => aoMudar(s.valor)}
            style={({ pressed }) => [
              {
                flex: 1,
                minHeight: 36,
                paddingHorizontal: ESPACO.e8,
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
              variante="botao"
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
}
