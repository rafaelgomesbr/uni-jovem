import { useSyncExternalStore } from 'react'

/**
 * Qual aba está à frente (o índice, de 0 a n-1). É um armazenamento externo: o item marcado da
 * barra avisa, e a pílula luminosa (que é uma só, no fundo da barra) desliza até ele. Vale
 * para a barra das abas e para a barra das telas empilhadas, que mostram sempre a mesma aba.
 */
let indice = 0
const ouvintes = new Set<() => void>()

export function definirAbaAtiva(novo: number): void {
  if (novo === indice) return
  indice = novo
  ouvintes.forEach((o) => o())
}

function assinar(o: () => void) {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}
const ler = () => indice

export function useAbaAtiva(): number {
  return useSyncExternalStore(assinar, ler, ler)
}
