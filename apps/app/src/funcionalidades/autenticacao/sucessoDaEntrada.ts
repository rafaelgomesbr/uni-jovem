import { useSyncExternalStore } from 'react'

import { MOVIMENTO_DE_ACESSO } from '@uj/tokens'

/**
 * O redirecionamento do guarda do grupo público, segurado por 200 ms depois de
 * entrar (D63), para o check do botão e o halo do sol aparecerem antes da troca
 * de tela. É o único adiamento da navegação, e tem três travas contra laço e
 * contra atrasar quem já está logado:
 * - só segura quem acabou de pedir a entrada (`segurar` é chamado ao enviar);
 * - ao falhar ou ao ir para o segundo fator, solta na hora;
 * - tem teto próprio (`TETO`): mesmo que ninguém solte, o guarda volta a decidir.
 * Quem abre o app já logado nunca passa por aqui.
 */
const TETO = 15_000

let segurando = false
let tempoDoTeto: ReturnType<typeof setTimeout> | null = null
let tempoDaSoltura: ReturnType<typeof setTimeout> | null = null
const ouvintes = new Set<() => void>()

function avisar() {
  for (const ouvinte of ouvintes) ouvinte()
}

function limparTempos() {
  if (tempoDoTeto) clearTimeout(tempoDoTeto)
  if (tempoDaSoltura) clearTimeout(tempoDaSoltura)
  tempoDoTeto = null
  tempoDaSoltura = null
}

/** Chamado ao enviar o pedido de entrada: enquanto a entrada trabalha, o guarda espera. */
export function segurarRedirecionamento(): void {
  limparTempos()
  segurando = true
  tempoDoTeto = setTimeout(() => soltarRedirecionamento(0), TETO)
  avisar()
}

/** Solta o guarda depois de `apos` ms (200 depois de entrar; 0 ao falhar). */
export function soltarRedirecionamento(apos: number = MOVIMENTO_DE_ACESSO.sucesso): void {
  if (!segurando) return
  if (tempoDaSoltura) clearTimeout(tempoDaSoltura)
  const soltar = () => {
    limparTempos()
    segurando = false
    avisar()
  }
  if (apos <= 0) soltar()
  else tempoDaSoltura = setTimeout(soltar, apos)
}

/** O guarda deve esperar? */
export function useRedirecionamentoSegurado(): boolean {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    () => segurando,
    () => false,
  )
}
