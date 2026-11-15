import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { Icone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDaCaixa {
  rotulo: string
  descricao?: string
  marcada: boolean
  aoMudar: (marcada: boolean) => void
  desabilitada?: boolean
}

/** Caixa de marcar (papel `checkbox`), com a marca desenhada além da cor. */
export function CaixaDeMarcar({ rotulo, descricao, marcada, aoMudar, desabilitada }: PropsDaCaixa) {
  const { cores } = useTema()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={rotulo}
      accessibilityHint={descricao}
      aria-checked={marcada}
      aria-disabled={!!desabilitada}
      disabled={desabilitada}
      onPress={() => aoMudar(!marcada)}
      style={{
        minHeight: ALVO,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.x3,
        opacity: desabilitada ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: RAIO.pequeno / 2,
          borderWidth: 2,
          borderColor: marcada ? cores.destaque : cores.borda,
          backgroundColor: marcada ? cores.destaque : cores.superficie,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {marcada ? <Icone nome="confirmado" cor={cores.superficie} tamanho={18} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Texto variante="corpoForte">{rotulo}</Texto>
        {descricao ? (
          <Texto variante="apoio" cor="textoSuave">
            {descricao}
          </Texto>
        ) : null}
      </View>
    </Pressable>
  )
}
