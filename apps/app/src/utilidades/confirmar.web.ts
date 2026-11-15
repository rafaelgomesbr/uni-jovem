import type { PedidoDeConfirmacao } from './confirmar'
import { abrirConfirmacao, temDialogo } from './filaDeConfirmacao'

export type { PedidoDeConfirmacao } from './confirmar'

/**
 * Na web o `Alert` do React Native não faz nada, e o `window.confirm` mostra
 * "OK" em vez da ação. O diálogo próprio diz a ação no botão, prende o foco,
 * fecha com Esc e devolve o foco a quem abriu.
 */
export async function confirmar(pedido: PedidoDeConfirmacao): Promise<boolean> {
  if (!temDialogo()) return window.confirm(`${pedido.titulo}\n\n${pedido.mensagem}`)
  return abrirConfirmacao(pedido)
}
