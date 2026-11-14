import { ESPACO, RAIO, type Paleta } from '@uj/tokens'
import { View } from 'react-native'

import { Texto } from './Texto'
import { useTema } from './tema'

/** Etiqueta curta (papel, situação). O texto carrega o sentido; a cor só reforça. */
export function Selo({ texto, cor = 'textoSuave' }: { texto: string; cor?: keyof Paleta }) {
  const { cores } = useTema()
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: ESPACO.x2,
        paddingVertical: 2,
        borderRadius: RAIO.pilula,
        borderWidth: 1,
        borderColor: cores[cor],
      }}
    >
      <Texto variante="rotulo" cor={cor}>
        {texto}
      </Texto>
    </View>
  )
}
