import type { ComponentProps } from 'react'

import { Tela } from '@/ui/Tela'

import { CabecalhoDaComunidade } from './CabecalhoDaComunidade'

/** Tela das abas do app: sempre com a comunidade ativa no topo. */
export function TelaDoApp(props: Omit<ComponentProps<typeof Tela>, 'cabecalho'>) {
  return <Tela {...props} cabecalho={<CabecalhoDaComunidade />} />
}
