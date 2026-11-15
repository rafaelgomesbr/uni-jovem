import * as SecureStore from 'expo-secure-store'

import type { RespostaEu } from '@/servicos/contrato'

/**
 * Última resposta de `GET /api/v1/eu`, para o app abrir sem internet (o dia
 * do evento costuma ser sem rede). Só no celular, no Keychain/Keystore, e
 * apagada ao sair. Os dados de cada comunidade continuam protegidos pela
 * validade da partição; isto aqui é só quem é a pessoa e onde ela participa.
 */
const CHAVE = 'uj.eu'
const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

/** Teto da validade offline por comunidade (D23: entre 3 e 30 dias). */
export const VALIDADE_DA_CONTA_SALVA_MS = 30 * 24 * 3600_000

interface ContaSalva {
  eu: RespostaEu
  salvaEm: string
}

export async function lerContaSalva(agora: Date = new Date()): Promise<RespostaEu | null> {
  try {
    const bruto = await SecureStore.getItemAsync(CHAVE, OPCOES)
    if (!bruto) return null
    const salva = JSON.parse(bruto) as ContaSalva
    if (agora.getTime() - Date.parse(salva.salvaEm) > VALIDADE_DA_CONTA_SALVA_MS) return null
    return salva.eu?.conta?.id ? salva.eu : null
  } catch {
    return null
  }
}

export async function gravarContaSalva(eu: RespostaEu): Promise<void> {
  try {
    const salva: ContaSalva = { eu, salvaEm: new Date().toISOString() }
    await SecureStore.setItemAsync(CHAVE, JSON.stringify(salva), OPCOES)
  } catch {
    // Sem gravar, o app só não abre sem internet: não quebra nada.
  }
}

export async function apagarContaSalva(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CHAVE, OPCOES)
  } catch {
    // Já não existe.
  }
}
