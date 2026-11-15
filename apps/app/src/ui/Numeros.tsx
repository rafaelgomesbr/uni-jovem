import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Texto } from './Texto'

/** Largura mínima de cada número: com fonte grande, o grupo quebra em vez de cortar. */
const LARGURA_MINIMA_DO_NUMERO = 80

export interface NumeroDoGrupo {
  numero: number
  /** "comunidades", "na lista de espera": lido junto com o número. */
  rotulo: string
}

/**
 * Grupo de números de uma visão geral (3.4.2 e 3.6.3): lado a lado em
 * `numero` 28/32 com algarismos tabulares e a legenda abaixo, dentro de um
 * cartão de vidro. Cada número é lido de uma vez ("3 comunidades"). Os
 * relatórios usam a grade de cartões própria (3.7.5).
 */
export function Numeros({ itens }: { itens: readonly NumeroDoGrupo[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e16 }}>
      {itens.map((i) => (
        <View
          key={i.rotulo}
          accessible
          accessibilityLabel={`${i.numero} ${i.rotulo}`}
          style={{ flex: 1, minWidth: LARGURA_MINIMA_DO_NUMERO }}
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
