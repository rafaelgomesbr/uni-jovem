import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Texto } from './Texto'
import { useTema } from './tema'

/**
 * Linha com um texto no meio ("ou com e-mail"), que separa os acessos rápidos
 * do formulário. As linhas são só desenho; o sentido está no texto, que o
 * leitor de tela lê como um trecho de texto comum.
 */
export function SeparadorComTexto({ texto }: { texto: string }) {
  const { cores } = useTema()
  const linha = {
    flex: 1,
    height: 1,
    backgroundColor: cores.separador,
  } as const
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e12 }}>
      <View style={linha} importantForAccessibility="no-hide-descendants" aria-hidden />
      <Texto variante="meta" cor="textoSuave" centralizado>
        {texto}
      </Texto>
      <View style={linha} importantForAccessibility="no-hide-descendants" aria-hidden />
    </View>
  )
}
