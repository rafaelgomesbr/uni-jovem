/**
 * Respostas que a pessoa deu e ainda não chegaram ao servidor (D69). "Aceitar" e "Não posso ir"
 * aparecem feitos na hora, o aviso à liderança espera os 10 s do Desfazer, e durante a espera
 * (e até a lista recarregar) a tela mostra a resposta daqui, não a do servidor.
 *
 * É um armazenamento fora da árvore, como a fila do toast: a Agenda, o Encontro e quem mais
 * mostrar a convocação leem a mesma verdade. Nada vai para o aparelho: se o app fechar, a
 * espera some e a convocação continua pendente (o erro seguro é o de não enviar).
 */
import { useSyncExternalStore } from 'react'

export type RespostaOtimista = 'confirmada' | 'recusada'

let respostas: ReadonlyMap<string, RespostaOtimista> = new Map()
const ouvintes = new Set<() => void>()

function publicar(novo: Map<string, RespostaOtimista>) {
  respostas = novo
  ouvintes.forEach((o) => o())
}

export function definirResposta(atribuicaoId: string, resposta: RespostaOtimista): void {
  publicar(new Map(respostas).set(atribuicaoId, resposta))
}

export function limparResposta(atribuicaoId: string): void {
  if (!respostas.has(atribuicaoId)) return
  const novo = new Map(respostas)
  novo.delete(atribuicaoId)
  publicar(novo)
}

/** Só para os testes: cada teste começa sem nenhuma espera. */
export function reiniciarRespostas(): void {
  publicar(new Map())
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
const ler = () => respostas

/** As respostas em espera, por id da convocação. Re-renderiza quando mudam. */
export function useRespostasOtimistas(): ReadonlyMap<string, RespostaOtimista> {
  return useSyncExternalStore(assinar, ler, ler)
}

type Estado = 'pendente' | 'confirmada' | 'recusada' | 'substituicao_pedida'

/** O estado que a tela mostra: a resposta em espera vence a do servidor. */
export function estadoEfetivo(
  id: string,
  doServidor: Estado,
  otimistas: ReadonlyMap<string, RespostaOtimista>,
): Estado {
  return otimistas.get(id) ?? doServidor
}
