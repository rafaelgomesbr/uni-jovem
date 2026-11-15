import { randomUUID } from 'expo-crypto'

/** Chave de idempotência de uma operação (ex.: check-in). Repetir o envio nunca duplica. */
export function novaChave(): string {
  return randomUUID()
}
