import type { ComponentProps, ReactNode } from 'react'
import { useWindowDimensions } from 'react-native'

import { Tela } from '@/ui/Tela'

import { CabecalhoDaComunidade } from './CabecalhoDaComunidade'

type PropsDaTelaDoApp = Omit<ComponentProps<typeof Tela>, 'topo' | 'topoCompacto' | 'pilha'> & {
  /**
   * Botão com texto ao lado do título ("Novo encontro"). Com fonte
   * grande, o título de 34 não divide a linha: o botão desce para baixo dele.
   */
  acaoComTexto?: ReactNode
}

/** Raiz de aba: a linha da pílula da comunidade e do status, e a versão compacta ao rolar. */
export function TelaDoApp({ acaoComTexto, ...props }: PropsDaTelaDoApp) {
  const { fontScale } = useWindowDimensions()
  const embaixo = fontScale >= 1.35
  return (
    <Tela
      {...props}
      {...(acaoComTexto
        ? embaixo
          ? { abaixoDoTitulo: acaoComTexto }
          : { acaoDoTitulo: acaoComTexto }
        : {})}
      topo={<CabecalhoDaComunidade />}
      topoCompacto={<CabecalhoDaComunidade compacto />}
    />
  )
}
