import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { Aviso, EstadoDoAviso } from '@/servicos/contratoDosModulos'

import { naComunidade } from '../eventos/consultas'

export const NOME_DO_ESTADO: Readonly<Record<EstadoDoAviso, string>> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  despublicado: 'Despublicado',
}

const base = (comunidadeId: string) => `${naComunidade(comunidadeId)}/avisos`

/** Membro recebe só os publicados e vigentes (a RLS esconde o resto). */
export function useAvisos(comunidadeId: string) {
  return useQuery({
    queryKey: [...CHAVES.avisos(comunidadeId), 'lista'],
    queryFn: () => api.get<{ avisos: Aviso[] }>(base(comunidadeId)).then((r) => r.avisos),
  })
}

export function useAviso(comunidadeId: string, avisoId: string) {
  return useQuery({
    queryKey: [...CHAVES.avisos(comunidadeId), 'item', avisoId],
    queryFn: () => api.get<Aviso>(`${base(comunidadeId)}/${avisoId}`),
  })
}

/** Aviso aparece também no Início: as duas listas recarregam juntas. */
function useMutacaoDeAviso<V, R>(comunidadeId: string, executar: (v: V) => Promise<R>) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: executar,
    onSuccess: () =>
      Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.avisos(comunidadeId) }),
        consultas.invalidateQueries({ queryKey: CHAVES.inicio(comunidadeId) }),
      ]),
  })
}

export interface DadosDoAviso {
  titulo: string
  texto: string
  fixado: boolean
  visivelAte: string | null
}

export function useCriarAviso(comunidadeId: string) {
  return useMutacaoDeAviso(comunidadeId, (v: DadosDoAviso & { publicar: boolean }) =>
    api.post<{ id: string }>(base(comunidadeId), v),
  )
}

export function useEditarAviso(comunidadeId: string) {
  return useMutacaoDeAviso(
    comunidadeId,
    (v: { id: string; versao: number } & Partial<DadosDoAviso>) => {
      const { id, ...corpo } = v
      return api.patch(`${base(comunidadeId)}/${id}`, corpo)
    },
  )
}

export function usePublicacaoDoAviso(comunidadeId: string) {
  return useMutacaoDeAviso(comunidadeId, (v: { id: string; acao: 'publicar' | 'despublicar' }) =>
    api.post(`${base(comunidadeId)}/${v.id}/${v.acao}`),
  )
}

export function useExcluirAviso(comunidadeId: string) {
  return useMutacaoDeAviso(comunidadeId, (id: string) => api.delete(`${base(comunidadeId)}/${id}`))
}
