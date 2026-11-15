import type { Paleta } from '@uj/tokens'

import type { EstadoDaInscricao } from '@/servicos/contratoDosEventos'
import type { TomDoChip } from '@/ui/Chip'

export const NOME_DO_ESTADO_DA_INSCRICAO: Readonly<Record<EstadoDaInscricao, string>> = {
  confirmada: 'Confirmada',
  espera: 'Lista de espera',
  cancelada: 'Cancelada',
}

export const COR_DO_ESTADO_DA_INSCRICAO: Readonly<Record<EstadoDaInscricao, keyof Paleta>> = {
  confirmada: 'sucesso',
  espera: 'alerta',
  cancelada: 'textoSuave',
}

/** Chip da situação da inscrição (2.12.12): Confirmada sucesso, espera alerta, cancelada neutro. */
export const TOM_DO_ESTADO_DA_INSCRICAO: Readonly<Record<EstadoDaInscricao, TomDoChip>> = {
  confirmada: 'sucesso',
  espera: 'alerta',
  cancelada: 'neutro',
}

/** O código de entrada tem 10 caracteres hexadecimais (o mesmo que vai no QR). */
export function codigoDeEntradaValido(texto: string): string | null {
  const limpo = texto.trim().toUpperCase().replace(/\s/g, '')
  return /^[0-9A-F]{10}$/.test(limpo) ? limpo : null
}

/** Agrupa o código de 5 em 5 para ler e ditar melhor. */
export function formatarCodigo(codigo: string): string {
  return codigo.replace(/(.{5})/, '$1 ').trim()
}
