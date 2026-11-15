import { ESPACO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { View } from 'react-native'

import { Texto } from './Texto'

interface PropsDaSecao {
  /** Sobrancelha do grupo, fora do cartão, anunciada como cabeçalho. */
  titulo: string
  /** Uma frase abaixo do grupo, quando o grupo pede explicação. */
  rodape?: string
  /** Ação curta à direita da sobrancelha (ex.: terciário "Ver todos"). */
  acao?: ReactNode
  children: ReactNode
}

/**
 * Grupo novo (seção 2.13 e quadro 04): sobrancelha fora do cartão em texto
 * suave, 24 acima (8 mais o intervalo de 16 da tela) e 8 abaixo.
 */
export function Secao({ titulo, rodape, acao, children }: PropsDaSecao) {
  return (
    <View style={{ gap: ESPACO.e8, marginTop: ESPACO.e8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 16, gap: ESPACO.e8 }}>
        <Texto variante="sobrancelha" cor="textoSuave" style={{ flex: 1 }}>
          {titulo}
        </Texto>
        {acao}
      </View>
      {children}
      {rodape ? (
        <Texto variante="legenda" cor="textoSuave">
          {rodape}
        </Texto>
      ) : null}
    </View>
  )
}
