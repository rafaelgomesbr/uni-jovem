const chave = (contaId: string) => `uj.comunidadeAtiva.${contaId}`

function armazenamento(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export async function lerComunidadeAtiva(contaId: string): Promise<string | null> {
  return armazenamento()?.getItem(chave(contaId)) ?? null
}

export async function gravarComunidadeAtiva(contaId: string, comunidadeId: string): Promise<void> {
  try {
    armazenamento()?.setItem(chave(contaId), comunidadeId)
  } catch {
    // Navegação privada pode recusar: a pessoa escolhe de novo depois.
  }
}
