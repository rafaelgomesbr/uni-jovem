import { useMutation } from '@tanstack/react-query'

import { api } from '@/servicos/api'
import { confirmar } from '@/utilidades/confirmar'

import { naComunidade, useInvalidarEventos } from './consultas'

/**
 * Mudança num item do evento (tarefa, material, checklist, nota, anexo): ao
 * terminar, recarrega o evento e o que depende dele.
 */
export function useMudancaNoEvento<V>(
  comunidadeId: string,
  eventoId: string,
  executar: (base: string, variaveis: V) => Promise<unknown>,
) {
  const invalidar = useInvalidarEventos(comunidadeId)
  const base = `${naComunidade(comunidadeId)}/eventos/${eventoId}`
  return useMutation({
    mutationFn: (variaveis: V) => executar(base, variaveis),
    onSuccess: () => invalidar(eventoId),
  })
}

/** Remover um item, sempre com confirmação. `caminho` é relativo ao evento (ex.: `tarefas/ID`). */
export function useRemocaoNoEvento(comunidadeId: string, eventoId: string) {
  const mutacao = useMudancaNoEvento(comunidadeId, eventoId, (base, caminho: string) =>
    api.delete(`${base}/${caminho}`),
  )
  async function pedir(caminho: string, oQue: string) {
    const ok = await confirmar({
      titulo: `Remover ${oQue}?`,
      mensagem: 'Isto sai do encontro para todos. Não dá para desfazer.',
      confirmar: 'Remover',
      destrutivo: true,
    })
    if (ok) mutacao.mutate(caminho)
  }
  return { ...mutacao, pedir }
}
