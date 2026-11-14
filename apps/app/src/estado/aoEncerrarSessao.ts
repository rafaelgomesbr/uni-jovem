/**
 * Ganchos chamados quando a sessão termina neste aparelho (sair, sessão
 * revogada, refresh recusado). A camada offline se registra aqui para apagar
 * a partição local da conta; nada aqui depende de quem se registrou.
 */

export type GanchoDeEncerramento = (contaId: string | null) => void | Promise<void>

const ganchos = new Set<GanchoDeEncerramento>()

/** Registra um gancho e devolve a função que o remove. */
export function registrarAoEncerrarSessao(gancho: GanchoDeEncerramento): () => void {
  ganchos.add(gancho)
  return () => {
    ganchos.delete(gancho)
  }
}

/** Roda todos os ganchos; a falha de um não impede os outros. */
export async function aoEncerrarSessao(contaId: string | null): Promise<void> {
  await Promise.allSettled([...ganchos].map(async (gancho) => gancho(contaId)))
}
