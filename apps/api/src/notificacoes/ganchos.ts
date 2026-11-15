/**
 * Ganchos de notificação, anunciados pelas rotas DEPOIS do commit.
 *
 * Desde a F14 o enfileiramento acontece no banco, por gatilhos na mesma
 * transação do fato (migração 0011: aviso publicado, evento cancelado ou
 * adiado, escala atribuída, substituição pedida e aceita, inscrição promovida).
 * Assim nada se perde entre o commit e o envio, e o papel do aplicativo não
 * consegue enfileirar nada por conta própria. O gancho serve só para ACORDAR o
 * trabalhador da fila (src/notificacoes/trabalhador.ts) antes do próximo ciclo.
 *
 * Regras que continuam valendo (plano, seção 8):
 * - O gancho leva só identificadores.
 * - Tela bloqueada com texto genérico. Pedido de oração nunca vira
 *   notificação (por isso não há gancho nem gatilho de oração).
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
