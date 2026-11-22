import { ESPACO, TIPO } from '@uj/tokens'
import { View } from 'react-native'

import { Icone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

/**
 * O aviso discreto de horário (D79): "Ao mesmo tempo que Culto (16:00)", "Logo depois de Café
 * (09:00)". Relógio e texto na cor suave (cor nunca é o único sinal), na Agenda e no Início.
 */
export function AvisoDeHorario({ texto }: { texto: string }) {
  const { cores } = useTema()
  return (
    <View
      testID="aviso-de-horario"
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.e8 }}
    >
      <View style={{ height: TIPO.meta.altura, justifyContent: 'center' }}>
        <Icone nome="relogio" cor={cores.textoSuave} tamanho={16} />
      </View>
      <Texto variante="meta" cor="textoSuave" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  )
}
