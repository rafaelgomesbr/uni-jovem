import type { ComponentProps } from 'react'

import { Tela } from '@/ui/Tela'

import { CabecalhoDaComunidade } from './CabecalhoDaComunidade'

/** Tela das abas: o topo do mockup (pílula da comunidade e sincronização) dentro da rolagem. */
export function TelaDoApp(props: Omit<ComponentProps<typeof Tela>, 'topo' | 'cabecalho'>) {
  return <Tela {...props} topo={<CabecalhoDaComunidade />} />
}
