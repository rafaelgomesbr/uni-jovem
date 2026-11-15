import { RITMO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { Texto } from './Texto'

interface PropsDaSecao {
  /** Rótulo curto acima do grupo, anunciado como cabeçalho. */
  titulo: string
  /** Uma frase abaixo do grupo, quando o grupo pede explicação. */
  rodape?: string
  /** Ação curta à direita do rótulo (ex.: botão terciário "Ver todos"). */
  acao?: ReactNode
  children: ReactNode
}

/**
 * Seção de tela: rótulo com respiro acima de um grupo (normalmente um
 * `Cartao` com uma `Lista`). Organiza telas de muitos itens, como Perfil e Mais.
 */
export function Secao({ titulo, rodape, acao, children }: PropsDaSecao) {
  return (
    <View style={{ gap: RITMO.rotuloDaSecao }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 24 }}>
        <Texto
          variante="secao"
          cor="textoSuave"
          accessibilityRole="header"
          style={{ flex: 1, paddingHorizontal: RITMO.entreItens / 3 }}
        >
          {titulo}
        </Texto>
        {acao}
      </View>
      {children}
      {rodape ? (
        <Texto
          variante="legenda"
          cor="textoSuave"
          style={{ paddingHorizontal: RITMO.entreItens / 3 }}
        >
          {rodape}
        </Texto>
      ) : null}
    </View>
  )
}
