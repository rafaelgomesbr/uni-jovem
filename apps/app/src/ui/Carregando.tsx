import { ESPACO } from '@uj/tokens'
import { ActivityIndicator, View } from 'react-native'

import { Texto } from './Texto'
import { useTema } from './tema'

export function Carregando({ texto = 'Carregando' }: { texto?: string }) {
  const { cores } = useTema()
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={texto}
      accessibilityState={{ busy: true }}
      style={{ padding: ESPACO.x6, alignItems: 'center', gap: ESPACO.x3 }}
    >
      <ActivityIndicator color={cores.destaque} />
      <Texto variante="apoio" cor="textoSuave">
        {texto}
      </Texto>
    </View>
  )
}
