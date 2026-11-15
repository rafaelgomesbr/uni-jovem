import { ESPACO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'

import { LARGURA_DO_LAYOUT_DIVIDIDO } from '@/constantes'

/** A janela tem largura para lista e detalhe lado a lado? */
export function useLayoutLargo(): boolean {
  const { width } = useWindowDimensions()
  return width >= LARGURA_DO_LAYOUT_DIVIDIDO
}

interface PropsDoLayout {
  lista: ReactNode
  detalhe: ReactNode
  /** Rótulo da região do detalhe para o leitor de tela. */
  rotuloDoDetalhe: string
}

/**
 * Lista à esquerda e detalhe à direita, cada um com a própria rolagem. A ordem
 * de leitura acompanha a visual: primeiro a lista, depois o detalhe.
 */
export function LayoutDividido({ lista, detalhe, rotuloDoDetalhe }: PropsDoLayout) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: ESPACO.x6 }}>
      <ScrollView
        style={{ flex: 2 }}
        contentContainerStyle={{ gap: ESPACO.x4, paddingBottom: ESPACO.x8 }}
        keyboardShouldPersistTaps="handled"
      >
        {lista}
      </ScrollView>
      <ScrollView
        accessibilityLabel={rotuloDoDetalhe}
        style={{ flex: 3 }}
        contentContainerStyle={{ gap: ESPACO.x4, paddingBottom: ESPACO.x8 }}
        keyboardShouldPersistTaps="handled"
      >
        {detalhe}
      </ScrollView>
    </View>
  )
}
