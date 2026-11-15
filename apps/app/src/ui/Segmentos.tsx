import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone, type NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { useSetasDoGrupo } from './setasDoGrupo'
import { Texto } from './Texto'
import { useTema } from './tema'

export interface Segmento<T extends string> {
  valor: T
  rotulo: string
  icone?: NomeDoIcone
}

interface PropsDosSegmentos<T extends string> {
  /** Nome do grupo, lido pelo leitor de tela (ex.: "Modo de exibição"). */
  rotulo: string
  segmentos: readonly Segmento<T>[]
  /** `null` quando nada foi escolhido ainda. */
  valor: T | null
  aoMudar: (valor: T) => void
}

/**
 * Escolha única compacta, em linha (modo de exibição, filtro). Papel `radio`
 * para o leitor de tela; o selecionado tem fundo, borda e marca, nunca só cor.
 */
export function Segmentos<T extends string>({
  rotulo,
  segmentos,
  valor,
  aoMudar,
}: PropsDosSegmentos<T>) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const propsDaOpcao = useSetasDoGrupo(segmentos, valor, aoMudar)
  return (
    <View
      accessibilityRole="radiogroup"
      aria-label={rotulo}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ESPACO.x1,
        padding: ESPACO.x1,
        borderRadius: RAIO.pilula,
        borderWidth: aumentarContraste ? 2 : 1,
        borderColor: aumentarContraste ? cores.texto : cores.cartaoVidroBorda,
        backgroundColor: cores.cartaoVidro,
        alignSelf: 'flex-start',
      }}
    >
      {segmentos.map((s) => {
        const marcado = s.valor === valor
        // Escolhido: pílula coral translúcida e texto coral, como a aba ativa (e a marca de confirmação).
        const cor = marcado ? cores.destaque : cores.texto
        return (
          <Pressable
            key={s.valor}
            {...propsDaOpcao(s.valor)}
            accessibilityRole="radio"
            accessibilityLabel={s.rotulo}
            aria-checked={marcado}
            onPress={() => aoMudar(s.valor)}
            style={({ pressed }) => ({
              minHeight: ALVO,
              minWidth: ALVO,
              paddingHorizontal: ESPACO.x3,
              borderRadius: RAIO.pilula,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: ESPACO.x1,
              backgroundColor: marcado
                ? cores.abaAtiva
                : pressed
                  ? cores.superficieRealce
                  : 'transparent',
            })}
          >
            {marcado ? (
              <Icone nome="confirmado" cor={cor} tamanho={16} />
            ) : s.icone ? (
              <Icone nome={s.icone} cor={cor} tamanho={16} />
            ) : null}
            <Texto variante="rotulo" style={{ color: cor }}>
              {s.rotulo}
            </Texto>
          </Pressable>
        )
      })}
    </View>
  )
}
