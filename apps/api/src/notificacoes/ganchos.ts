/**
 * Ganchos para as notificações da F14. Hoje ninguém escuta: as rotas só
 * anunciam o que aconteceu, depois que a transação confirmou.
 *
 * Regras para quem implementar o envio (plano, seção 8):
 * - O gancho leva só identificadores. O conteúdo é resolvido NO ENVIO, sob a
 *   RLS de cada destinatário, para respeitar isolamento e preferências.
 * - Tela bloqueada com texto genérico para tipos sensíveis. Pedido de oração
 *   nunca vira notificação com conteúdo (por isso não há gancho de oração).
 */

export interface EventosDeNotificacao {
  aviso_publicado: { comunidadeId: string; avisoId: string; contaId: string }
}

type Ouvinte<K extends keyof EventosDeNotificacao> = (dados: EventosDeNotificacao[K]) => void

const ouvintes: { [K in keyof EventosDeNotificacao]: Set<Ouvinte<K>> } = {
  aviso_publicado: new Set(),
}

/** Registra um ouvinte; devolve a função que o remove. */
export function aoNotificar<K extends keyof EventosDeNotificacao>(
  evento: K,
  ouvinte: Ouvinte<K>,
): () => void {
  ouvintes[evento].add(ouvinte)
  return () => {
    ouvintes[evento].delete(ouvinte)
  }
}

/**
 * Anuncia um evento. Falha de um ouvinte nunca derruba a rota que já gravou:
 * a notificação é consequência, não parte da ação.
 */
export function notificar<K extends keyof EventosDeNotificacao>(
  evento: K,
  dados: EventosDeNotificacao[K],
): void {
  for (const ouvinte of ouvintes[evento]) {
    try {
      ouvinte(dados)
    } catch {
      // Ignorado de propósito (ver acima). O envio real registrará a própria falha.
    }
  }
}
