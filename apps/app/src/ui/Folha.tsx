import { ESPACO, RITMO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CabecalhoDeTela, voltar } from './CabecalhoDeTela'
import { alturaMaximaDaFolha } from './opcoesDaFolha'
import { ProvedorDeSuperficie } from './tema'

interface PropsDaFolha {
  titulo: string
  children: ReactNode
  /** Padrão: volta (fecha a folha); aberta por link, vai ao Início. Fechar existe sempre: nada só em gesto. */
  aoFechar?: () => void
}

/**
 * Conteúdo de uma folha (seção 2.12.19): a rota abre como `formSheet` nativo
 * (grabber do sistema, raio 28); aqui ficam o cabeçalho de folha (título
 * 24/28 e "Fechar" de 44) e o padding de 20 nas laterais, 8 em cima e a área
 * segura mais 16 embaixo.
 *
 * A folha nativa tem a altura do conteúdo (`fitToContents`, ver `opcoesDaFolha`): aqui nada é
 * `flex: 1`. A rolagem só ganha um teto (`maxHeight`), para a lista longa rolar em vez de
 * crescer além da janela.
 */
export function Folha({ titulo, children, aoFechar = voltar }: PropsDaFolha) {
  const margens = useSafeAreaInsets()
  const { height: alturaDaJanela } = useWindowDimensions()
  return (
    <ProvedorDeSuperficie superficie="opaca">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: alturaMaximaDaFolha(alturaDaJanela, margens.top) }}
        contentContainerStyle={{
          paddingHorizontal: RITMO.margemDaTela,
          paddingTop: ESPACO.e8,
          paddingBottom: margens.bottom + ESPACO.e16,
        }}
      >
        <View style={{ gap: RITMO.entreSecoes }}>
          <CabecalhoDeTela tipo="folha" titulo={titulo} aoFechar={aoFechar} />
          {children}
        </View>
      </ScrollView>
    </ProvedorDeSuperficie>
  )
}
