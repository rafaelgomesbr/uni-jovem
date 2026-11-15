import type { ReactNode } from 'react'

import { useSessao } from '@/estado/sessao'
import type { ComunidadeDoVinculo } from '@/servicos/contrato'
import { Tela } from '@/ui/Tela'

import { SemComunidade } from './SemComunidade'

interface Props {
  /** Texto para "Escolha a comunidade para ver {oQue}". */
  oQue: string
  titulo?: string
  descricao?: string
  larga?: boolean
  children: (comunidade: ComunidadeDoVinculo) => ReactNode
}

/**
 * Esqueleto das telas de pilha que dependem da comunidade ativa (oração,
 * avisos, relatórios...). Sem comunidade escolhida, explica e oferece a troca.
 */
export function TelaDaComunidade({ oQue, titulo, descricao, larga, children }: Props) {
  const { comunidadeAtiva } = useSessao()
  return (
    <Tela
      pilha
      {...(titulo ? { titulo } : {})}
      {...(descricao ? { descricao } : {})}
      {...(larga ? { larga } : {})}
    >
      {comunidadeAtiva ? children(comunidadeAtiva) : <SemComunidade oQue={oQue} />}
    </Tela>
  )
}
