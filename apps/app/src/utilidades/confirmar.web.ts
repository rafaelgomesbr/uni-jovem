import type { PedidoDeConfirmacao } from './confirmar'

export type { PedidoDeConfirmacao } from './confirmar'

/** Na web o `Alert` do React Native não faz nada; o diálogo do navegador é acessível. */
export async function confirmar({ titulo, mensagem }: PedidoDeConfirmacao): Promise<boolean> {
  return window.confirm(`${titulo}\n\n${mensagem}`)
}
