/**
 * A página web está sendo fechada (`pagehide`): o envio pendente sai agora, e o navegador só
 * termina um pedido depois do fechamento se ele for `keepalive`. O cliente da API consulta isto
 * ao montar o pedido. No celular não faz nada (o segundo plano dá tempo de terminar).
 */
let ate = 0

/** Os pedidos feitos nos próximos instantes são de descarga (sobrevivem ao fechamento da página). */
export function marcarDescarga(duracaoMs = 5000): void {
  ate = Date.now() + duracaoMs
}

export function emDescarga(): boolean {
  return Date.now() < ate
}
