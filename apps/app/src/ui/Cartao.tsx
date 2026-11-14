import { ESPACO, RAIO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDoCartao {
  children?: ReactNode
  titulo?: string
  icone?: NomeDoIcone
  style?: StyleProp<ViewStyle>
}

/** Superfície opaca para conteúdo. Vidro fica só no que flutua (abas, cabeçalho). */
export function Cartao({ children, titulo, icone, style }: PropsDoCartao) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  return (
    <View
      style={[
        {
          backgroundColor: cores.superficie,
          borderRadius: RAIO.grande,
          borderWidth: aumentarContraste ? 2 : 1,
          borderColor: aumentarContraste ? cores.texto : cores.borda,
          padding: ESPACO.x4,
          gap: ESPACO.x3,
          alignSelf: 'stretch',
        },
        style,
      ]}
    >
      {titulo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x2 }}>
          {icone ? <Icone nome={icone} cor={cores.destaque} /> : null}
          <Texto variante="subtitulo" style={{ flex: 1 }}>
            {titulo}
          </Texto>
        </View>
      ) : null}
      {children}
    </View>
  )
}
