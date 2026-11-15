import { ESPACO, RITMO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CabecalhoDeTela, voltar } from './CabecalhoDeTela'
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
 */
export function Folha({ titulo, children, aoFechar = voltar }: PropsDaFolha) {
  const margens = useSafeAreaInsets()
  return (
    <ProvedorDeSuperficie superficie="opaca">
      <ScrollView
        keyboardShouldPersistTaps="handled"
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
