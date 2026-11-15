import { RAIO } from '@uj/tokens'
import { View } from 'react-native'

import { Icone, type NomeDoIcone } from './Icone'
import { useTema } from './tema'

/** Moldura do ícone de um cabeçalho ou linha: quadrado de cantos suaves no tom de realce. */
export function MolduraDoIcone({
  icone,
  tamanho = 32,
  cor,
}: {
  icone: NomeDoIcone
  tamanho?: number
  cor?: string
}) {
  const { cores } = useTema()
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho >= 36 ? RAIO.medio - 2 : RAIO.pequeno,
        backgroundColor: cores.superficieRealce,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icone nome={icone} cor={cor ?? cores.destaque} tamanho={Math.round(tamanho * 0.56)} />
    </View>
  )
}
