/**
 * Convocações feitas em lote e ainda na espera do Desfazer (D69). "Convocar 2 pessoas" fecha a
 * folha e a lista já mostra as duas, marcadas "A enviar"; o envio (e o aviso a elas) só sai ao fim
 * da contagem, ao sair da tela ou ao ir para segundo plano (D74). Até lá, as linhas vêm daqui.
 * Nada vai para o aparelho: o envio pendente sai antes de o app fechar, e a espera é só da tela.
 * Também guarda as pessoas que a pessoa tirou e ainda esperam a contagem: somem da lista na hora.
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
  publicarRemocoes(new Set())
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

// ------------------------------------------------------------------ quem foi tirado

let removidas: ReadonlySet<string> = new Set()
const ouvintesDasRemocoes = new Set<() => void>()

function publicarRemocoes(novas: ReadonlySet<string>) {
  removidas = novas
  ouvintesDasRemocoes.forEach((o) => o())
}

/** As convocações que a pessoa tirou e ainda esperam o Desfazer: a lista já não as mostra. */
export function esperarRemocao(ids: readonly string[]): void {
  publicarRemocoes(new Set([...removidas, ...ids]))
}

/** Desfez, ou o servidor já confirmou: as linhas voltam a vir só do servidor. */
export function devolverRemovidas(ids: readonly string[]): void {
  publicarRemocoes(new Set([...removidas].filter((id) => !ids.includes(id))))
}

function assinarRemocoes(ouvinte: () => void) {
  ouvintesDasRemocoes.add(ouvinte)
  return () => {
    ouvintesDasRemocoes.delete(ouvinte)
  }
}
const lerRemocoes = () => removidas

export function useRemovidasEmEspera(): ReadonlySet<string> {
  return useSyncExternalStore(assinarRemocoes, lerRemocoes, lerRemocoes)
}
