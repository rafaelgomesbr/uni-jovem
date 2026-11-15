import { useSyncExternalStore } from 'react'

import type { OperacaoNaFila } from './tipos'

/**
 * Alterações que não chegaram ao servidor e saíram do aparelho junto com a
 * partição (sessão encerrada, acesso revogado, validade vencida). Ficam SÓ na
 * memória, para a pessoa ver e copiar; nunca voltam ao disco.
 */

export type MotivoDoDescarte = 'sessao' | 'revogado' | 'vencido' | 'saiu'

export interface Descarte {
  motivo: MotivoDoDescarte
  /** Só o texto humano e a hora: nada de identificador. */
  itens: { descricao: string; criadaEm: string; mensagem: string | null }[]
}

let atual: Descarte | null = null
const ouvintes = new Set<() => void>()

function avisar() {
  for (const o of ouvintes) o()
}

export function guardarDescarte(motivo: MotivoDoDescarte, operacoes: OperacaoNaFila[]): void {
  if (!operacoes.length) return
  const itens = operacoes.map((o) => ({
    descricao: o.descricao,
    criadaEm: o.criadaEm,
    mensagem: o.mensagem,
  }))
  atual = { motivo, itens: [...(atual?.itens ?? []), ...itens] }
  avisar()
}

export function dispensarDescarte(): void {
  atual = null
  avisar()
}

export function lerDescarte(): Descarte | null {
  return atual
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function useDescarte(): Descarte | null {
  return useSyncExternalStore(assinar, lerDescarte, lerDescarte)
}
