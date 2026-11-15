import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { CartaoDeDestaque } from './CartaoDeDestaque'
import { CartaoDeVidro } from './CartaoDeVidro'
import type { NomeDoIcone } from './Icone'
import { Texto } from './Texto'

export type VarianteDoCartao = 'vidro' | 'destaque'

interface PropsDoCartao {
  children?: ReactNode
  /** Vira a sobrancelha do cartão. */
  titulo?: string
  /** Uma linha abaixo da sobrancelha, quando ajuda a entender o cartão. */
  descricao?: string
  /** Ignorado: cartão não tem ícone no cabeçalho (2.10). Mantido para as telas antigas. */
  icone?: NomeDoIcone
  /** À direita da sobrancelha (ex.: terciário "Ver todos"). */
  acao?: ReactNode
  variante?: VarianteDoCartao
  /** Cartão com campos de formulário: superfície opaca. */
  opaco?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Fachada do cartão antigo para as telas que ainda não foram redesenhadas
 * (D2 a D4): `vidro` vira `CartaoDeVidro` e `destaque` vira `CartaoDeDestaque`.
 * Telas novas usam os dois diretamente.
 */
export function Cartao({
  variante = 'vidro',
  titulo,
  descricao,
  acao,
  children,
  opaco,
  style,
}: PropsDoCartao) {
  const conteudo = (
    <>
      {descricao ? (
        <Texto variante="legenda" cor="textoSuave">
          {descricao}
        </Texto>
      ) : null}
      {children}
    </>
  )
  if (variante === 'destaque') {
    return (
      <CartaoDeDestaque {...(titulo ? { sobrancelha: titulo } : {})} {...(style ? { style } : {})}>
        {conteudo}
      </CartaoDeDestaque>
    )
  }
  return (
    <CartaoDeVidro
      {...(titulo ? { sobrancelha: titulo } : {})}
      {...(acao ? { extra: acao } : {})}
      {...(opaco ? { opaco } : {})}
      {...(style ? { style } : {})}
    >
      {conteudo}
    </CartaoDeVidro>
  )
}

/** Fachada: o item principal da tela. */
export function CartaoDestaque(props: Omit<PropsDoCartao, 'variante'>) {
  return <Cartao {...props} variante="destaque" />
}
