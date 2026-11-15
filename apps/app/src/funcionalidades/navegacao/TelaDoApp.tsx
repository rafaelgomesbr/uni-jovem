import type { ComponentProps } from 'react'

import { Tela } from '@/ui/Tela'

import { CabecalhoDaComunidade } from './CabecalhoDaComunidade'

/** Raiz de aba: a linha da pílula da comunidade e do status, e a versão compacta ao rolar. */
export function TelaDoApp(
  props: Omit<ComponentProps<typeof Tela>, 'topo' | 'topoCompacto' | 'pilha'>,
) {
  return (
    <Tela
      {...props}
      topo={<CabecalhoDaComunidade />}
      topoCompacto={<CabecalhoDaComunidade compacto />}
    />
  )
}
