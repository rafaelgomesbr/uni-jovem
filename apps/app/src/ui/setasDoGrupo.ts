import { useRef } from 'react'
import { Platform } from 'react-native'

import { soNaWeb } from './web'

interface EventoDeTecla {
  key: string
  preventDefault: () => void
}

const PROXIMO = new Set(['ArrowRight', 'ArrowDown'])
const ANTERIOR = new Set(['ArrowLeft', 'ArrowUp'])

/**
 * Grupo de rádio na web, como o padrão ARIA: Tab entra no grupo pela opção
 * marcada (as outras ficam fora da ordem do Tab) e as setas mudam a escolha
 * e o foco. No celular, nada muda: o leitor de tela já navega item a item.
 */
export function useSetasDoGrupo<T extends string>(
  valores: readonly { valor: T; desabilitada?: boolean }[],
  valorAtual: T | null,
  aoMudar: (valor: T) => void,
) {
  const nos = useRef(new Map<T, HTMLElement>())
  const ativos = valores.filter((v) => !v.desabilitada).map((v) => v.valor)
  const naOrdem = valorAtual !== null && ativos.includes(valorAtual) ? valorAtual : ativos[0]

  function mover(de: T, passo: 1 | -1) {
    const i = ativos.indexOf(de)
    const proximo = ativos[(i + passo + ativos.length) % ativos.length]
    if (proximo === undefined) return
    aoMudar(proximo)
    nos.current.get(proximo)?.focus()
  }

  return function propsDaOpcao(valor: T): object {
    if (Platform.OS !== 'web') return {}
    return soNaWeb({
      tabIndex: valor === naOrdem ? 0 : -1,
      ref: (no: unknown) => {
        if (no) nos.current.set(valor, no as HTMLElement)
        else nos.current.delete(valor)
      },
      onKeyDown: (e: EventoDeTecla) => {
        if (PROXIMO.has(e.key)) {
          e.preventDefault()
          mover(valor, 1)
        } else if (ANTERIOR.has(e.key)) {
          e.preventDefault()
          mover(valor, -1)
        }
      },
    })
  }
}
