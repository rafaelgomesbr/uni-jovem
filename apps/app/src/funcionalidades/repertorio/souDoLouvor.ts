import { ehConvocacaoDeLouvor } from '@uj/dominio'

import type { EscalaDoInicio } from '@/servicos/contratoDosEventos'

/**
 * A pessoa toca no louvor? Devolve a convocação de louvor dela (a recusada não
 * conta), ou `null`. Serve ao botão "Abrir o repertório" do cartão do próximo
 * encontro e ao atalho "Louvor" da Comunidade (D62): quem não toca não vê
 * nenhum dos dois. Não precisa de outra chamada: a lista de convocações já vem
 * da API.
 */
export function escalaDeLouvor<T extends EscalaDoInicio>(escalas: readonly T[]): T | null {
  return (
    escalas.find(
      (e) =>
        e.estado !== 'recusada' &&
        ehConvocacaoDeLouvor({ funcao: e.funcao, etapaTitulo: e.etapaTitulo }),
    ) ?? null
  )
}
