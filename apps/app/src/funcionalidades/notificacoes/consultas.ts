import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TipoDeNotificacao } from '@uj/dominio'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { PreferenciasDaComunidade, PreferenciasDaConta } from '@/servicos/contratoDosModulos'

import { naComunidade } from '../eventos/consultas'

/** Preferências da conta (versículo) e se ESTE aparelho já tem token de push na API. */
export function usePreferenciasDaConta() {
  const { estado } = useSessao()
  return useQuery({
    queryKey: CHAVES.notificacoesDaConta,
    queryFn: () => api.get<PreferenciasDaConta>('/api/v1/eu/notificacoes'),
    enabled: estado === 'autenticado',
    staleTime: 5 * 60_000,
  })
}

export function useSalvarVersiculo() {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: (v: { versiculoAtivo?: boolean; versiculoHora?: string }) =>
      api.put<{ versiculo: PreferenciasDaConta['versiculo'] }>('/api/v1/eu/notificacoes', v),
    onSuccess: (r) =>
      consultas.setQueryData<PreferenciasDaConta>(CHAVES.notificacoesDaConta, (atual) =>
        atual ? { ...atual, versiculo: r.versiculo } : atual,
      ),
  })
}

export function usePreferenciasDaComunidade(comunidadeId: string) {
  return useQuery({
    queryKey: CHAVES.preferenciasDeNotificacao(comunidadeId),
    queryFn: () =>
      api.get<PreferenciasDaComunidade>(`${naComunidade(comunidadeId)}/notificacoes/preferencias`),
  })
}

export function useSalvarPreferenciasDaComunidade(comunidadeId: string) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: (v: { todas?: boolean; tipos?: Partial<Record<TipoDeNotificacao, boolean>> }) =>
      api.put<PreferenciasDaComunidade>(
        `${naComunidade(comunidadeId)}/notificacoes/preferencias`,
        v,
      ),
    onSuccess: (r) => consultas.setQueryData(CHAVES.preferenciasDeNotificacao(comunidadeId), r),
  })
}
