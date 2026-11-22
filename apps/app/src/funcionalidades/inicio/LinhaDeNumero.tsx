import type { ReactElement } from 'react'

import type { NomeDoIcone } from '@/ui/Icone'
import { LinhaDeLista } from '@/ui/LinhaDeLista'

/** "1 convocação", "2 convocações". */
export function plural(n: number, singular: string, mais: string): string {
  return `${n} ${n === 1 ? singular : mais}`
}

interface Props {
  icone: NomeDoIcone
  /** O que o toque faz, começando pelo verbo ("Responder 2 convocações"). */
  titulo: string
  /** Aonde o toque leva, para o leitor de tela ("Agenda"). */
  destino: string
  aoPressionar: () => void
}

/**
 * Uma linha do "Seu resumo" (D62): o verbo do que o toque faz e o destino.
 * Nunca é linha morta: se não leva a lugar nenhum, não entra no resumo. O
 * leitor de tela ouve tudo de uma vez ("Responder 2 convocações. Abrir Agenda").
 */
export function LinhaDeNumero({ icone, titulo, destino, aoPressionar }: Props): ReactElement {
  return (
    <LinhaDeLista
      icone={icone}
      titulo={titulo}
      rotuloAcessivel={`${titulo}. Abrir ${destino}`}
      aoPressionar={aoPressionar}
    />
  )
}
