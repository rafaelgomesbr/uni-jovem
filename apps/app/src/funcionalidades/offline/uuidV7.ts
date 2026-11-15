import { getRandomBytes } from 'expo-crypto'

/**
 * UUID v7 (RFC 9562): 48 bits de milissegundos + 74 bits aleatórios. A chave
 * de idempotência ordena pela hora de criação, o que ajuda a ler a fila e o
 * registro do servidor na ordem em que as coisas aconteceram.
 */
export function uuidV7(
  agoraMs: number = Date.now(),
  aleatorio: (quantos: number) => Uint8Array = getRandomBytes,
): string {
  const b = new Uint8Array(16)
  let ms = Math.max(0, Math.floor(agoraMs))
  for (let i = 5; i >= 0; i--) {
    b[i] = ms % 256
    ms = Math.floor(ms / 256)
  }
  b.set(aleatorio(10).subarray(0, 10), 6)
  b[6] = (b[6]! & 0x0f) | 0x70
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
