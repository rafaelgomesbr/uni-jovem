import { getRandomBytesAsync } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

import type { RegistroDaParticao } from './tipos'

/**
 * Chaves das partições e o índice delas, no Keychain (iOS) ou no Keystore
 * (Android). Só depois do primeiro desbloqueio e só neste aparelho: a chave
 * não vai para backup nem migra para outro telefone.
 */
const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

const INDICE = 'uj.offline.particoes'

/** O SecureStore só aceita letras, números, ponto, hífen e sublinhado no nome. */
const seguro = (id: string) => id.replace(/[^\w.-]/g, '_')

export const nomeDaChave = (contaId: string, comunidadeId: string) =>
  `uj.offline.chave.${seguro(contaId)}.${seguro(comunidadeId)}`

export const nomeDoArquivo = (contaId: string, comunidadeId: string) =>
  `uj-offline-${seguro(contaId)}-${seguro(comunidadeId)}.db`

// O índice é lido e regravado inteiro: uma fila única evita que duas
// gravações simultâneas percam uma partição.
let fila: Promise<unknown> = Promise.resolve()
function emFila<T>(trabalho: () => Promise<T>): Promise<T> {
  const proximo = fila.then(trabalho, trabalho)
  fila = proximo.catch(() => undefined)
  return proximo
}

async function lerBruto(): Promise<RegistroDaParticao[]> {
  try {
    const bruto = await SecureStore.getItemAsync(INDICE, OPCOES)
    const lido: unknown = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lido) ? (lido as RegistroDaParticao[]) : []
  } catch {
    return []
  }
}

export function lerIndice(): Promise<RegistroDaParticao[]> {
  return emFila(lerBruto)
}

export function alterarIndice(
  alterar: (atual: RegistroDaParticao[]) => RegistroDaParticao[],
): Promise<RegistroDaParticao[]> {
  return emFila(async () => {
    const novo = alterar(await lerBruto())
    await SecureStore.setItemAsync(INDICE, JSON.stringify(novo), OPCOES)
    return novo
  })
}

export async function lerChave(contaId: string, comunidadeId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(nomeDaChave(contaId, comunidadeId), OPCOES)
  } catch {
    return null
  }
}

/** Chave aleatória de 256 bits, só desta partição. */
export async function criarChave(contaId: string, comunidadeId: string): Promise<string> {
  const bytes = await getRandomBytesAsync(32)
  const hex = Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('')
  await SecureStore.setItemAsync(nomeDaChave(contaId, comunidadeId), hex, OPCOES)
  return hex
}

export async function apagarChave(contaId: string, comunidadeId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(nomeDaChave(contaId, comunidadeId), OPCOES)
  } catch {
    // Já não existe: nada a apagar.
  }
}
