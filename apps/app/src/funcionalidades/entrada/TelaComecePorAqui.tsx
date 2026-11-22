import { Tela } from '@/ui/Tela'

import { ComecePorAqui } from './ComecePorAqui'

/**
 * Rota `/comece-por-aqui`: a mesma pergunta do Início sem comunidade, para quem já participa de
 * uma e quer entrar em outra (Trocar de comunidade) e para o toque na notificação de decisão de
 * um pedido.
 */
export function TelaComecePorAqui() {
  return (
    <Tela pilha titulo="Outra comunidade">
      <ComecePorAqui />
    </Tela>
  )
}
