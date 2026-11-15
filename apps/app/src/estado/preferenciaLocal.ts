import * as SecureStore from 'expo-secure-store'

/**
 * Preferências de interface guardadas no aparelho (não são segredo nem dado
 * pessoal). No celular, o SecureStore já é o chave-valor do app; na web, ver
 * o `.web.ts`. Falhar ao ler ou gravar nunca quebra a tela.
 */
export async function lerPreferenciaLocal<T>(chave: string): Promise<T | null> {
  try {
    const bruto = await SecureStore.getItemAsync(chave)
    return bruto ? (JSON.parse(bruto) as T) : null
  } catch {
    return null
  }
}

export async function gravarPreferenciaLocal(chave: string, valor: unknown): Promise<void> {
  try {
    await SecureStore.setItemAsync(chave, JSON.stringify(valor))
  } catch {
    // Preferência de interface: se não gravar, a pessoa vê o padrão de novo.
  }
}
