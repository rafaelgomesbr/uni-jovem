import { Tela } from '@/ui/Tela'

import { ComecePorAqui } from './ComecePorAqui'

/**
 * Rota `/comece-por-aqui`: os mesmos caminhos do Início sem comunidade, para
 * quem já participa de uma e quer entrar em outra (Equipe e Trocar de
 * comunidade) e para o toque na notificação de decisão de um pedido.
 */
export function TelaComecePorAqui() {
  return (
    <Tela
      pilha
      titulo="Outra comunidade"
      descricao="Entre com um código, procure pelo nome ou crie uma comunidade."
    >
      <ComecePorAqui />
    </Tela>
  )
}
