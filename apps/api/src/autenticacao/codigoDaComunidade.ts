import { createHmac, randomBytes } from 'node:crypto'
import { ALFABETO_DO_CODIGO, TAMANHO_DO_CODIGO } from '@uj/dominio'
import { hmacDeToken } from './cripto.ts'

/**
 * Código de entrada da comunidade (ADR 0007): 8 caracteres de um alfabeto de
 * 32 símbolos sem ambiguidade. O banco guarda duas coisas, inúteis sem o
 * segredo do servidor (o mesmo do convite, com finalidades separadas):
 *
 * - a SEMENTE (16 bytes aleatórios), de onde o código é derivado, para o admin
 *   ver o mesmo código de novo sem que ele exista em claro no banco;
 * - o HMAC do código, para achar a comunidade quando alguém o digita.
 *
 * Trocar o código é sortear outra semente: o antigo deixa de valer na hora.
 */

export interface CodigoNovo {
  codigo: string
  semente: Buffer
  hmac: Buffer
}

export function codigoDaSemente(semente: Buffer, segredo: string): string {
  const bytes = createHmac('sha256', segredo)
    .update('uj:codigo-da-comunidade:')
    .update(semente)
    .digest()
  let codigo = ''
  // 256 é múltiplo de 32: o resto da divisão não favorece nenhum símbolo.
  for (let i = 0; i < TAMANHO_DO_CODIGO; i++) codigo += ALFABETO_DO_CODIGO[bytes[i]! % 32]
  return codigo
}

export function hmacDoCodigo(codigo: string, segredo: string): Buffer {
  return hmacDeToken(`uj:entrada:${codigo}`, segredo)
}

export function sortearCodigo(segredo: string): CodigoNovo {
  const semente = randomBytes(16)
  const codigo = codigoDaSemente(semente, segredo)
  return { codigo, semente, hmac: hmacDoCodigo(codigo, segredo) }
}

/** Link que o admin compartilha (QR): abre o app na tela de entrada. */
export function linkDoCodigo(urlPublica: string, codigo: string): string {
  return new URL(`/entrar/${codigo}`, urlPublica).toString()
}
