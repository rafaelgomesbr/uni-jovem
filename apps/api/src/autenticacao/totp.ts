import { createHmac, randomBytes } from 'node:crypto'

/**
 * TOTP (RFC 6238): HMAC-SHA1, passo de 30 s, 6 dígitos, compatível com os
 * aplicativos autenticadores comuns. Implementação própria e pequena para não
 * depender de biblioteca para 40 linhas de código padronizado.
 *
 * Proteção contra reuso: `verificarTotp` devolve o contador aceito, e quem
 * chama guarda o último contador usado e recusa contadores <= a ele.
 */

const PASSO_S = 30
const DIGITOS = 6
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32(dados: Buffer): string {
  let bits = 0
  let valor = 0
  let saida = ''
  for (const byte of dados) {
    valor = (valor << 8) | byte
    bits += 8
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31]
  return saida
}

export function deBase32(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0
  let valor = 0
  const bytes: number[] = []
  for (const c of limpo) {
    const i = ALFABETO.indexOf(c)
    if (i < 0) throw new Error('base32 inválido')
    valor = (valor << 5) | i
    bits += 5
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** Segredo de 160 bits em base32 (o que o autenticador lê no QR). */
export function gerarSegredoTotp(): string {
  return base32(randomBytes(20))
}

export function codigoTotp(segredoBase32: string, contador: number): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(contador))
  const h = createHmac('sha1', deBase32(segredoBase32)).update(msg).digest()
  const deslocamento = h[h.length - 1]! & 0x0f
  const numero = (h.readUInt32BE(deslocamento) & 0x7fffffff) % 10 ** DIGITOS
  return numero.toString().padStart(DIGITOS, '0')
}

export function contadorAtual(agoraMs: number = Date.now()): number {
  return Math.floor(agoraMs / 1000 / PASSO_S)
}

/**
 * Aceita o passo atual e um vizinho de cada lado (tolerância de relógio).
 * Devolve o contador aceito, ou null. Recusa contador <= `ultimoUsado`.
 */
export function verificarTotp(
  segredoBase32: string,
  codigo: string,
  ultimoUsado: number | null,
  agoraMs: number = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(codigo)) return null
  const atual = contadorAtual(agoraMs)
  for (const c of [atual - 1, atual, atual + 1]) {
    if (ultimoUsado !== null && c <= ultimoUsado) continue
    if (codigoTotp(segredoBase32, c) === codigo) return c
  }
  return null
}

export function uriDeConfiguracao(segredoBase32: string, email: string, emissor: string): string {
  const rotulo = encodeURIComponent(`${emissor}:${email}`)
  const params = new URLSearchParams({
    secret: segredoBase32,
    issuer: emissor,
    algorithm: 'SHA1',
    digits: String(DIGITOS),
    period: String(PASSO_S),
  })
  return `otpauth://totp/${rotulo}?${params.toString()}`
}
