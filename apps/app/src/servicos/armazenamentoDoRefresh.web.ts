import type { ArmazenamentoDoRefresh } from './api'

/** Web: o refresh mora num cookie HttpOnly; o JavaScript não guarda nada. */
export function criarArmazenamentoDoRefresh(): ArmazenamentoDoRefresh | null {
  return null
}
