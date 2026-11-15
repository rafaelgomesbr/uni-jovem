function armazenamento(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export async function lerPreferenciaLocal<T>(chave: string): Promise<T | null> {
  try {
    const bruto = armazenamento()?.getItem(chave)
    return bruto ? (JSON.parse(bruto) as T) : null
  } catch {
    return null
  }
}

export async function gravarPreferenciaLocal(chave: string, valor: unknown): Promise<void> {
  try {
    armazenamento()?.setItem(chave, JSON.stringify(valor))
  } catch {
    // Navegação privada pode recusar: a pessoa vê o padrão de novo.
  }
}
