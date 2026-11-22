import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { RespostaDasMinhasInscricoes } from '@/servicos/contratoDosEventos'
import type { DataLocal } from '@/utilidades/datas'

import { useInvalidarEscalas } from '../escalas/consultas'
import { naComunidade } from '../eventos/consultas'

/**
 * As próprias inscrições nos próximos encontros (`GET /inscricoes/eu`), para a linha
 * "Inscrito" da Agenda. A mesma chave e a mesma chamada do Início: o cache é um só.
 */
export function useMinhasInscricoesDaAgenda(comunidadeId: string) {
  return useQuery({
    queryKey: CHAVES.minhasInscricoes(comunidadeId),
    queryFn: () =>
      api
        .get<RespostaDasMinhasInscricoes>(
          `${naComunidade(comunidadeId)}/inscricoes/eu?periodo=proximas`,
        )
        .then((r) => r.inscricoes),
    // API antiga (sem a rota) ou sem rede: a linha só não diz "Inscrito".
    retry: false,
  })
}

/** "Posso ajudar" num dia (liga e desliga). O calendário responde na hora e o servidor confirma. */
export function useInformarDisponibilidade(comunidadeId: string) {
  const invalidar = useInvalidarEscalas(comunidadeId)
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: ({ data, disponivel }: { data: DataLocal; disponivel: boolean }) =>
      api.put(`${naComunidade(comunidadeId)}/disponibilidade/${data}`, { disponivel }),
    onSuccess: async () => {
      await consultas.invalidateQueries({ queryKey: ['c', comunidadeId, 'disponibilidade'] })
      await invalidar()
    },
  })
}
