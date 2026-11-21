import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  EncontroDoMeuRepertorio,
  ItemDoRepertorio,
  RespostaDoAviso,
} from '@/servicos/contratoDoRepertorio'

import { naComunidade } from '../eventos/consultas'

const doEvento = (comunidadeId: string, eventoId: string) =>
  `${naComunidade(comunidadeId)}/eventos/${eventoId}/repertorio`

export function useRepertorio(comunidadeId: string | null, eventoId: string | null) {
  return useQuery({
    queryKey: CHAVES.repertorio(comunidadeId ?? '', eventoId ?? ''),
    queryFn: () =>
      api
        .get<{ itens: ItemDoRepertorio[] }>(doEvento(comunidadeId!, eventoId!))
        .then((r) => r.itens),
    enabled: comunidadeId !== null && !!eventoId,
  })
}

/** Os próximos encontros em que a pessoa é convocada ao louvor, com o repertório e as cifras. */
export function useMeuRepertorio(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.meuRepertorio(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{ encontros: EncontroDoMeuRepertorio[] }>(
          `${naComunidade(comunidadeId!)}/meu-repertorio`,
        )
        .then((r) => r.encontros),
    enabled: comunidadeId !== null,
  })
}

/** Depois de mexer no repertório: a lista, o Meu repertório e o encontro recarregam. */
function useInvalidarRepertorio(comunidadeId: string, eventoId: string) {
  const consultas = useQueryClient()
  return () =>
    Promise.all([
      consultas.invalidateQueries({ queryKey: CHAVES.repertorio(comunidadeId, eventoId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.meuRepertorio(comunidadeId) }),
    ])
}

export function useAdicionarMusica(comunidadeId: string, eventoId: string) {
  const invalidar = useInvalidarRepertorio(comunidadeId, eventoId)
  return useMutation({
    mutationFn: (corpo: { musicaId: string; tomDoDia?: string | null }) =>
      api.post<{ id: string; ordem: number }>(doEvento(comunidadeId, eventoId), corpo),
    onSuccess: invalidar,
  })
}

export function useMudarItemDoRepertorio(comunidadeId: string, eventoId: string) {
  const invalidar = useInvalidarRepertorio(comunidadeId, eventoId)
  return useMutation({
    mutationFn: (v: {
      itemId: string
      versao: number
      tomDoDia?: string | null
      nota?: string | null
    }) => {
      const { itemId, ...corpo } = v
      return api.patch(`${doEvento(comunidadeId, eventoId)}/${itemId}`, corpo)
    },
    onSuccess: invalidar,
  })
}

export function useRemoverDoRepertorio(comunidadeId: string, eventoId: string) {
  const invalidar = useInvalidarRepertorio(comunidadeId, eventoId)
  return useMutation({
    mutationFn: (itemId: string) => api.delete(`${doEvento(comunidadeId, eventoId)}/${itemId}`),
    onSuccess: invalidar,
  })
}

/**
 * Reordenar: a tela responde na hora (otimista) e o servidor confirma; se a
 * lista mudou por outra pessoa (409), volta ao que o servidor tem.
 */
export function useReordenarRepertorio(comunidadeId: string, eventoId: string) {
  const consultas = useQueryClient()
  const chave = CHAVES.repertorio(comunidadeId, eventoId)
  const invalidar = useInvalidarRepertorio(comunidadeId, eventoId)
  return useMutation({
    mutationFn: (ids: string[]) => api.put(`${doEvento(comunidadeId, eventoId)}/ordem`, { ids }),
    onMutate: async (ids) => {
      await consultas.cancelQueries({ queryKey: chave })
      const anterior = consultas.getQueryData<ItemDoRepertorio[]>(chave)
      if (anterior) {
        const porId = new Map(anterior.map((i) => [i.id, i]))
        consultas.setQueryData(
          chave,
          ids.flatMap((id, ordem) => {
            const item = porId.get(id)
            return item ? [{ ...item, ordem }] : []
          }),
        )
      }
      return { anterior }
    },
    onError: (_erro, _ids, contexto) => {
      if (contexto?.anterior) consultas.setQueryData(chave, contexto.anterior)
    },
    onSettled: invalidar,
  })
}

export function useAvisarABanda(comunidadeId: string, eventoId: string) {
  return useMutation({
    mutationFn: () => api.post<RespostaDoAviso>(`${doEvento(comunidadeId, eventoId)}/avisar`),
  })
}
