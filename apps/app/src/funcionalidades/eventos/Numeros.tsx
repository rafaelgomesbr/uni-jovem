import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Texto } from '@/ui/Texto'

/** Números lado a lado em `numero` 28, cada um com a legenda abaixo (como a Plataforma). */
export function Numeros({ itens }: { itens: readonly { numero: number; rotulo: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e16 }}>
      {itens.map((i) => (
        <View
          key={i.rotulo}
          accessible
          accessibilityLabel={`${i.numero} ${i.rotulo}`}
          style={{ flex: 1, minWidth: ESPACO.e40 + ESPACO.e40 }}
        >
          <Texto variante="numero" accessibilityRole="text">
            {String(i.numero)}
          </Texto>
          <Texto variante="legenda" cor="textoSuave">
            {i.rotulo}
          </Texto>
        </View>
      ))}
    </View>
  )
}
