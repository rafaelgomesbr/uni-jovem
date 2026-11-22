/**
 * Convocações feitas em lote e ainda na espera do Desfazer (D69). "Convocar 2 pessoas" fecha a
 * folha e o bloco já mostra as duas como "aguardando"; o envio (e o aviso a elas) só sai ao
 * fim dos 10 s. Até lá, as linhas vêm daqui. Nada vai para o aparelho: se o app fechar, a
 * espera some e ninguém foi convocado (o erro seguro é o de não enviar).
 */
import { useSyncExternalStore } from 'react'

export interface ConvocadoEmEspera {
  /** Chave só desta espera (não é id de convocação: o servidor ainda não criou). */
  chave: string
  eventoId: string
  vinculoId: string
  nome: string
  funcao: string
  etapaId: string | null
}

let itens: readonly ConvocadoEmEspera[] = []
let proximo = 1
const ouvintes = new Set<() => void>()

function publicar(novos: readonly ConvocadoEmEspera[]) {
  itens = novos
  ouvintes.forEach((o) => o())
}

/** Põe as pessoas em espera e devolve as chaves, para tirá-las depois (desfez ou chegou). */
export function esperarConvocados(
  eventoId: string,
  pessoas: readonly Omit<ConvocadoEmEspera, 'chave' | 'eventoId'>[],
): string[] {
  const novos = pessoas.map((p) => ({ ...p, eventoId, chave: `espera-${proximo++}` }))
  publicar([...itens, ...novos])
  return novos.map((n) => n.chave)
}

export function tirarConvocadosEmEspera(chaves: readonly string[]): void {
  publicar(itens.filter((i) => !chaves.includes(i.chave)))
}

/** Só para os testes. */
export function reiniciarConvocadosEmEspera(): void {
  publicar([])
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
const ler = () => itens

/** As convocações em espera deste encontro. */
export function useConvocadosEmEspera(eventoId: string): ConvocadoEmEspera[] {
  const todos = useSyncExternalStore(assinar, ler, ler)
  return todos.filter((i) => i.eventoId === eventoId)
}
