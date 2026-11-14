import { useQuery } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ConviteDaComunidade, Membro } from '@/servicos/contrato'

/** Membros da comunidade. A chave leva o id da comunidade: cache nunca mistura comunidades. */
export function useMembros(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.membros(comunidadeId ?? ''),
    queryFn: () =>
      api.get<{ membros: Membro[] }>(`/api/v1/c/${comunidadeId}/membros`).then((r) => r.membros),
    enabled: comunidadeId !== null,
  })
}

export function useConvites(comunidadeId: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: CHAVES.convites(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{ convites: ConviteDaComunidade[] }>(`/api/v1/c/${comunidadeId}/convites`)
        .then((r) => r.convites),
    enabled: comunidadeId !== null && habilitado,
  })
}
