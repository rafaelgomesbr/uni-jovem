/**
 * Pedido de confirmação aberto na web: um só por vez. O diálogo
 * (`ui/DialogoDeConfirmacao.web.tsx`) assina este armazenamento; `confirmar`
 * (web) coloca o pedido e espera a resposta.
 */
import type { PedidoDeConfirmacao } from './confirmar'

export interface ConfirmacaoAberta {
  pedido: PedidoDeConfirmacao
  responder: (ok: boolean) => void
}

let atual: ConfirmacaoAberta | null = null
const ouvintes = new Set<() => void>()

function avisar() {
  for (const ouvinte of ouvintes) ouvinte()
}

export function assinarConfirmacao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export const lerConfirmacao = () => atual

/** Há um diálogo montado para mostrar o pedido? Sem ele, a web cai no `window.confirm`. */
export const temDialogo = () => ouvintes.size > 0

export function abrirConfirmacao(pedido: PedidoDeConfirmacao): Promise<boolean> {
  // Um pedido novo cancela o anterior (cancelar é sempre a opção segura).
  atual?.responder(false)
  return new Promise<boolean>((resolver) => {
    const aberta: ConfirmacaoAberta = {
      pedido,
      responder: (ok) => {
        if (atual === aberta) {
          atual = null
          avisar()
        }
        resolver(ok)
      },
    }
    atual = aberta
    avisar()
  })
}
