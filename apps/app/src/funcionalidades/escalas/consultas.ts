import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { Disponibilidade, MinhaEscala, Substituicao } from '@/servicos/contratoDosEventos'
import type { DataLocal } from '@/utilidades/datas'

import { naComunidade, textoDeConsulta } from '../eventos/consultas'

export function useMinhasEscalas(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.minhasEscalas(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{ escalas: MinhaEscala[] }>(`${naComunidade(comunidadeId!)}/minhas-escalas`)
        .then((r) => r.escalas),
    enabled: comunidadeId !== null,
  })
}

export function useSubstituicoes(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.substituicoes(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{ substituicoes: Substituicao[] }>(`${naComunidade(comunidadeId!)}/substituicoes`)
        .then((r) => r.substituicoes),
    enabled: comunidadeId !== null,
  })
}

/** Membro recebe só a própria; organização recebe a de todos (a RLS decide). */
export function useDisponibilidade(
  comunidadeId: string | null,
  de: DataLocal,
  ate: DataLocal,
  habilitado = true,
) {
  return useQuery({
    queryKey: CHAVES.disponibilidade(comunidadeId ?? '', de, ate),
    queryFn: () =>
      api
        .get<{ disponibilidade: Disponibilidade[] }>(
          `${naComunidade(comunidadeId!)}/disponibilidade${textoDeConsulta({ de, ate })}`,
        )
        .then((r) => r.disponibilidade),
    enabled: comunidadeId !== null && habilitado,
  })
}

/** Tudo que mostra escala depende destas três listas, mais o Início e o evento. */
export function useInvalidarEscalas(comunidadeId: string) {
  const consultas = useQueryClient()
  return async () => {
    await Promise.all([
      consultas.invalidateQueries({ queryKey: CHAVES.minhasEscalas(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.substituicoes(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.inicio(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: ['c', comunidadeId, 'evento'] }),
    ])
  }
}

export type Resposta = 'confirmar' | 'recusar'

/** Confirmar ou recusar a própria escala. */
export function useResponderEscala(comunidadeId: string) {
  const invalidar = useInvalidarEscalas(comunidadeId)
  return useMutation({
    mutationFn: ({ atribuicaoId, resposta }: { atribuicaoId: string; resposta: Resposta }) =>
      api.post(`${naComunidade(comunidadeId)}/atribuicoes/${atribuicaoId}/${resposta}`),
    onSuccess: invalidar,
  })
}
