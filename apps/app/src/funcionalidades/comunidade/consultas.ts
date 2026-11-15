import { useQuery } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ConviteDaComunidade, DetalheDaComunidade, Membro } from '@/servicos/contrato'
import { fusoDoAparelho } from '@/utilidades/datas'

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

export function useDetalheDaComunidade(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.comunidade(comunidadeId ?? ''),
    queryFn: () => api.get<DetalheDaComunidade>(`/api/v1/c/${comunidadeId}`),
    enabled: comunidadeId !== null,
    staleTime: 5 * 60_000,
  })
}

/**
 * Fuso da comunidade ativa: calendário e horários seguem o lugar do encontro,
 * não o aparelho. Enquanto carrega, usa o do aparelho (em geral o mesmo).
 */
export function useFusoDaComunidade(): string {
  const { comunidadeAtiva } = useSessao()
  const detalhe = useDetalheDaComunidade(comunidadeAtiva?.id ?? null)
  return detalhe.data?.fuso ?? fusoDoAparelho()
}

/** Vínculo da pessoa conectada na comunidade ativa (para saber o que é "meu"). */
export function useMeuVinculo(): string | null {
  const { comunidadeAtiva, conta } = useSessao()
  const membros = useMembros(comunidadeAtiva?.id ?? null)
  return membros.data?.find((m) => m.contaId === conta?.id)?.vinculoId ?? null
}

/** Pessoas ativas, em ordem alfabética (para escolher responsáveis). */
export function usePessoasAtivas(comunidadeId: string | null) {
  const membros = useMembros(comunidadeId)
  const pessoas = (membros.data ?? [])
    .filter((m) => m.estado === 'ativo')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return { ...membros, pessoas }
}
