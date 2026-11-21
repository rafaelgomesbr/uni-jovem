import type { ReactElement } from 'react'

import { Chip } from '@/ui/Chip'
import type { NomeDoIcone } from '@/ui/Icone'
import { LinhaDeLista } from '@/ui/LinhaDeLista'

/** "1 convocação", "2 convocações". */
export function plural(n: number, singular: string, mais: string): string {
  return `${n} ${n === 1 ? singular : mais}`
}

interface Props {
  icone: NomeDoIcone
  /** O que o número conta ("Convocações para responder"). */
  titulo: string
  /** O número, ou o texto que o resume ("2 de 3"). */
  valor: string
  descricao?: string
  /** Pede atenção: ganha o chip "Resolver", que diz com texto o que a cor sozinha não diria. */
  atencao?: boolean
  /** Sem destino, a linha só informa. */
  aoPressionar?: () => void
  /** Aonde o toque leva, para o leitor de tela ("Escalas"). */
  destino?: string
}

/**
 * Uma linha da visão geral (D59): o número à direita, o que ele conta à
 * esquerda e, quando há destino, o toque abre a tela certa. O leitor de tela
 * ouve tudo de uma vez ("Convocações para responder: 2. Abrir Escalas").
 */
export function LinhaDeNumero({
  icone,
  titulo,
  valor,
  descricao,
  atencao = false,
  aoPressionar,
  destino,
}: Props): ReactElement {
  const rotulo = [`${titulo}: ${valor}`, descricao, destino ? `Abrir ${destino}` : null]
    .filter(Boolean)
    .join('. ')
  return (
    <LinhaDeLista
      icone={icone}
      titulo={titulo}
      {...(descricao ? { descricao } : {})}
      valor={valor}
      {...(atencao ? { extra: <Chip texto="Resolver" tom="alerta" icone="avisoAlerta" /> } : {})}
      rotuloAcessivel={rotulo}
      {...(aoPressionar ? { aoPressionar } : {})}
    />
  )
}
