import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { Icone, type NomeDoIcone } from '@/ui/Icone'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

/**
 * Cabeçalho de um acordeão dentro de cartão lista ("Organização", "Mais opções"): o mesmo
 * ladrilho quente de 32 das linhas, o título e, à direita, um chip de número em texto que
 * continua visível com o bloco fechado. Fica com a altura de uma linha (56).
 */
export function CabecalhoDeAcordeao({
  icone,
  titulo,
  extra,
}: {
  icone: NomeDoIcone
  titulo: string
  extra?: ReactNode
}) {
  const { cores, solido } = useTema()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        minHeight: ALTURA.linha,
      }}
    >
      <View
        style={{
          width: ALTURA.ladrilho,
          height: ALTURA.ladrilho,
          borderRadius: RAIO.celula,
          backgroundColor: solido(cores.quenteFundo),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone nome={icone} cor={cores.destaque} tamanho={18} />
      </View>
      <Texto variante="tituloItem" style={{ flex: 1 }}>
        {titulo}
      </Texto>
      {extra}
    </View>
  )
}
