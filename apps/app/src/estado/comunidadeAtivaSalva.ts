import * as SecureStore from 'expo-secure-store'

// Não é segredo, mas o SecureStore é o armazenamento chave-valor que o app já
// tem no celular; evita uma dependência a mais só para guardar um id.
const chave = (contaId: string) => `uj.comunidadeAtiva.${contaId}`

export async function lerComunidadeAtiva(contaId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(chave(contaId))
  } catch {
    return null
  }
}

export async function gravarComunidadeAtiva(contaId: string, comunidadeId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(chave(contaId), comunidadeId)
  } catch {
    // Preferência de interface: se não gravar, a pessoa escolhe de novo depois.
  }
}
