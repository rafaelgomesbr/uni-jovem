import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { StatusDaSugestao, Sugestao } from '@/servicos/contratoDosModulos'
import type { TomDoChip } from '@/ui/Chip'

import { naComunidade, textoDeConsulta } from '../eventos/consultas'

export const NOME_DO_STATUS: Readonly<Record<StatusDaSugestao, string>> = {
  recebida: 'Recebida',
  em_analise: 'Em análise',
  aceita: 'Aceita',
  recusada: 'Recusada',
}

/** Chip de cada situação (3.7.2): o texto diz a situação; o tom só reforça. */
export const TOM_DO_STATUS: Readonly<Record<StatusDaSugestao, TomDoChip>> = {
  recebida: 'neutro',
  em_analise: 'info',
  aceita: 'sucesso',
  recusada: 'erro',
}

const base = (comunidadeId: string) => `${naComunidade(comunidadeId)}/sugestoes`

/** Membro recebe só as próprias; organização recebe todas (a API decide). */
export function useSugestoes(comunidadeId: string, status: StatusDaSugestao | null) {
  return useQuery({
    queryKey: [...CHAVES.sugestoes(comunidadeId), 'lista', status],
    queryFn: () =>
      api
        .get<{ sugestoes: Sugestao[] }>(`${base(comunidadeId)}${textoDeConsulta({ status })}`)
        .then((r) => r.sugestoes),
  })
}

export function useSugestao(comunidadeId: string, sugestaoId: string) {
  return useQuery({
    queryKey: [...CHAVES.sugestoes(comunidadeId), 'item', sugestaoId],
    queryFn: () => api.get<Sugestao>(`${base(comunidadeId)}/${sugestaoId}`),
  })
}

function useMutacaoDeSugestao<V, R>(comunidadeId: string, executar: (v: V) => Promise<R>) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: executar,
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.sugestoes(comunidadeId) }),
  })
}

export function useCriarSugestao(comunidadeId: string) {
  return useMutacaoDeSugestao(
    comunidadeId,
    (v: { titulo: string; texto: string; anonima: boolean }) =>
      api.post<{ id: string }>(base(comunidadeId), v),
  )
}

export function useModerarSugestao(comunidadeId: string) {
  return useMutacaoDeSugestao(
    comunidadeId,
    (v: { id: string; status: StatusDaSugestao; resposta: string | null; versao: number }) =>
      api.patch(`${base(comunidadeId)}/${v.id}`, {
        status: v.status,
        resposta: v.resposta,
        versao: v.versao,
      }),
  )
}

export function useExcluirSugestao(comunidadeId: string) {
  return useMutacaoDeSugestao(comunidadeId, (id: string) =>
    api.delete(`${base(comunidadeId)}/${id}`),
  )
}
