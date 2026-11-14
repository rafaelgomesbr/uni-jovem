import { ESPACO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'

import { Icone, type NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDaLinha {
  titulo: string
  descricao?: string
  icone?: NomeDoIcone
  aoPressionar?: () => void
  /** Conteúdo à direita (selo, botão). Em linha tocável, aparece também a seta. */
  extra?: ReactNode
  rotuloAcessivel?: string
}

const ESTILO: ViewStyle = {
  minHeight: ALVO,
  flexDirection: 'row',
  alignItems: 'center',
  gap: ESPACO.x3,
  paddingVertical: ESPACO.x2,
}

/** Linha de lista: tocável quando tem `aoPressionar`, com alvo mínimo garantido. */
export function Linha({
  titulo,
  descricao,
  icone,
  aoPressionar,
  extra,
  rotuloAcessivel,
}: PropsDaLinha) {
  const { cores } = useTema()
  const conteudo = (
    <>
      {icone ? <Icone nome={icone} cor={cores.destaque} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="corpoForte">{titulo}</Texto>
        {descricao ? (
          <Texto variante="apoio" cor="textoSuave">
            {descricao}
          </Texto>
        ) : null}
      </View>
      {extra}
      {aoPressionar ? <Icone nome="avancar" cor={cores.textoSuave} tamanho={18} /> : null}
    </>
  )
  if (!aoPressionar) return <View style={ESTILO}>{conteudo}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? (descricao ? `${titulo}. ${descricao}` : titulo)}
      onPress={aoPressionar}
      style={({ pressed }) => [ESTILO, { opacity: pressed ? 0.7 : 1 }]}
    >
      {conteudo}
    </Pressable>
  )
}
