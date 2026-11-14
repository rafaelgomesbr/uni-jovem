import * as SecureStore from 'expo-secure-store'

import type { ArmazenamentoDoRefresh } from './api'

const CHAVE = 'uj.refresh'

// Só depois do primeiro desbloqueio e só neste aparelho: o refresh não vai
// para backup nem migra para outro telefone.
const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

/** Celular: o refresh fica no Keychain (iOS) ou no Keystore (Android). */
export function criarArmazenamentoDoRefresh(): ArmazenamentoDoRefresh | null {
  return {
    ler: () => SecureStore.getItemAsync(CHAVE, OPCOES),
    gravar: (valor) => SecureStore.setItemAsync(CHAVE, valor, OPCOES),
    apagar: () => SecureStore.deleteItemAsync(CHAVE, OPCOES),
  }
}
