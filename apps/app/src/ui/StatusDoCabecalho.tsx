import { ALTURA, ESPACO, RAIO, type Paleta } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDoStatus {
  icone: NomeDoIcone
  cor: keyof Paleta
  /** Até 22 caracteres ("Sincronizado 14:32"). */
  texto: string
  /** O que o leitor de tela ouve (pode dizer mais que o texto). */
  rotulo: string
  aoPressionar?: () => void
}

/**
 * Status à direita da pílula (seção 2.12.15): ícone de 14, 6, texto 13/18
 * suave, sem borda nem fundo, com área de toque de 44 de altura. O texto
 * fica suave sobre a Aurora: o par foi medido no pior ponto da coral.
 */
export function StatusDoCabecalho({ icone, cor, texto, rotulo, aoPressionar }: PropsDoStatus) {
  const { cores } = useTema()
  const conteudo = (
    <>
      <Icone nome={icone} cor={cores[cor]} tamanho={14} peso="forte" />
      <Texto variante="legenda" cor="textoSuave" tabular numberOfLines={1}>
        {texto}
      </Texto>
    </>
  )
  const estilo = {
    minHeight: ALTURA.iconeSo,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: ESPACO.e6,
  }
  if (!aoPressionar) {
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={rotulo} style={estilo}>
        {conteudo}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoPressionar}
      hitSlop={{ left: 8, right: 8 }}
      style={({ pressed }) => [
        estilo,
        {
          borderRadius: RAIO.controle,
          backgroundColor: pressed ? cores.pressionado : 'transparent',
        },
      ]}
    >
      {conteudo}
    </Pressable>
  )
}
