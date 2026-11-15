import type { RespostaEu } from '@/servicos/contrato'

/** Web: não abre sem internet (ADR 0005), então nada é guardado. */
export const VALIDADE_DA_CONTA_SALVA_MS = 0

export async function lerContaSalva(): Promise<RespostaEu | null> {
  return null
}

export async function gravarContaSalva(_eu: RespostaEu): Promise<void> {}

export async function apagarContaSalva(): Promise<void> {}
