import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ItensPorTipo, TipoDeConteudo } from '@/servicos/contratoDosModulos'

import { naComunidade } from '../eventos/consultas'

const base = (comunidadeId: string, tipo: TipoDeConteudo) =>
  `${naComunidade(comunidadeId)}/conteudos/${tipo}`

export function useConteudos<T extends TipoDeConteudo>(
  comunidadeId: string,
  tipo: T,
  habilitado = true,
) {
  return useQuery({
    queryKey: [...CHAVES.conteudos(comunidadeId, tipo), 'lista'],
    queryFn: () =>
      api.get<{ itens: ItensPorTipo[T][] }>(base(comunidadeId, tipo)).then((r) => r.itens),
    enabled: habilitado,
  })
}

export function useConteudo<T extends TipoDeConteudo>(
  comunidadeId: string,
  tipo: T,
  itemId: string | null,
) {
  return useQuery({
    queryKey: [...CHAVES.conteudos(comunidadeId, tipo), 'item', itemId],
    queryFn: () => api.get<ItensPorTipo[T]>(`${base(comunidadeId, tipo)}/${itemId}`),
    enabled: itemId !== null,
  })
}

function useMutacaoDeConteudo<V, R>(
  comunidadeId: string,
  tipo: TipoDeConteudo,
  executar: (v: V) => Promise<R>,
) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: executar,
    onSuccess: () =>
      Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.conteudos(comunidadeId, tipo) }),
        // Músicas mostram os nomes dos músicos: mudar um músico muda a lista de músicas.
        tipo === 'musicos'
          ? consultas.invalidateQueries({ queryKey: CHAVES.conteudos(comunidadeId, 'musicas') })
          : null,
      ]),
  })
}

export function useCriarConteudo(comunidadeId: string, tipo: TipoDeConteudo) {
  return useMutacaoDeConteudo(comunidadeId, tipo, (corpo: Record<string, unknown>) =>
    api.post<{ id: string; versao: number }>(base(comunidadeId, tipo), corpo),
  )
}

export function useEditarConteudo(comunidadeId: string, tipo: TipoDeConteudo) {
  return useMutacaoDeConteudo(
    comunidadeId,
    tipo,
    (v: { id: string; versao: number; corpo: Record<string, unknown> }) =>
      api.patch(`${base(comunidadeId, tipo)}/${v.id}`, { ...v.corpo, versao: v.versao }),
  )
}

export function useExcluirConteudo(comunidadeId: string, tipo: TipoDeConteudo) {
  return useMutacaoDeConteudo(comunidadeId, tipo, (id: string) =>
    api.delete(`${base(comunidadeId, tipo)}/${id}`),
  )
}

export function useDefinirMusicos(comunidadeId: string) {
  return useMutacaoDeConteudo(
    comunidadeId,
    'musicas',
    (v: { musicaId: string; musicoIds: string[] }) =>
      api.put(`${base(comunidadeId, 'musicas')}/${v.musicaId}/musicos`, {
        musicoIds: v.musicoIds,
      }),
  )
}
