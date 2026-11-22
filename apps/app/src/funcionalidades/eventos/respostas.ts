/**
 * As respostas dos convocados, em contas puras (D69): "9 de 11 responderam" e "Faltam: Bruno e
 * Camila". Quem tem duas partes conta uma vez só; quem aceitou ou recusou já respondeu.
 */
import type { Atribuicao } from '@/servicos/contratoDosEventos'

export function contarRespostas(
  atribuicoes: readonly Pick<Atribuicao, 'vinculoId' | 'estado' | 'nome'>[],
) {
  const convocados = new Set(atribuicoes.map((a) => a.vinculoId))
  const pendentes = new Map<string, string>()
  for (const a of atribuicoes) if (a.estado === 'pendente') pendentes.set(a.vinculoId, a.nome)
  return {
    convocados: convocados.size,
    pendentes: pendentes.size,
    responderam: convocados.size - pendentes.size,
    nomesPendentes: [...pendentes.values()],
  }
}

/** "Bruno", "Bruno e Camila" e "Bruno, Camila e Davi". */
export function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}
