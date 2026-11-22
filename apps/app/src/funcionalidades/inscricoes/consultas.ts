import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  ListaDeCheckin,
  ListaDeInscricoes,
  ListaDePresencas,
} from '@/servicos/contratoDosEventos'
import { novaChave } from '@/utilidades/identificador'

import { naComunidade } from '../eventos/consultas'

const doEvento = (comunidadeId: string, eventoId: string) =>
  `${naComunidade(comunidadeId)}/eventos/${eventoId}`

export function useInscricoes(comunidadeId: string, eventoId: string) {
  return useQuery({
    queryKey: CHAVES.inscricoes(comunidadeId, eventoId),
    queryFn: () => api.get<ListaDeInscricoes>(`${doEvento(comunidadeId, eventoId)}/inscricoes`),
  })
}

export function useListaDeCheckin(comunidadeId: string, eventoId: string) {
  return useQuery({
    queryKey: CHAVES.checkin(comunidadeId, eventoId),
    queryFn: () => api.get<ListaDeCheckin>(`${doEvento(comunidadeId, eventoId)}/checkin`),
  })
}

export function usePresencas(comunidadeId: string, eventoId: string) {
  return useQuery({
    queryKey: CHAVES.presencas(comunidadeId, eventoId),
    queryFn: () => api.get<ListaDePresencas>(`${doEvento(comunidadeId, eventoId)}/presencas`),
  })
}

function useInvalidarPresenca(comunidadeId: string, eventoId: string) {
  const consultas = useQueryClient()
  return () =>
    Promise.all([
      consultas.invalidateQueries({ queryKey: CHAVES.checkin(comunidadeId, eventoId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.presencas(comunidadeId, eventoId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.inscricoes(comunidadeId, eventoId) }),
    ])
}

/** Quem está sendo marcado: exatamente um destes (a API recusa mais de um). */
export type AlvoDaPresenca =
  { codigo: string } | { inscricaoId: string } | { vinculoId: string } | { nomeAvulso: string }

export interface PedidoDePresenca {
  alvo: AlvoDaPresenca
  origem: 'qr' | 'manual'
  /** Nome para a mensagem de confirmação (não vai para a API). */
  nome: string
}

/**
 * Marcar presença. Cada toque leva uma chave de idempotência nova; repetir o
 * envio da mesma operação, ou marcar a mesma pessoa duas vezes, nunca vira
 * duas presenças (a API devolve `jaRegistrada`).
 */
export function useMarcarPresenca(comunidadeId: string, eventoId: string) {
  const invalidar = useInvalidarPresenca(comunidadeId, eventoId)
  return useMutation({
    mutationFn: ({ alvo, origem }: PedidoDePresenca) =>
      api.post<{ id: string; jaRegistrada: boolean }>(
        `${doEvento(comunidadeId, eventoId)}/presencas`,
        { chaveIdempotencia: novaChave(), origem, ...alvo },
      ),
    onSuccess: invalidar,
  })
}

export interface ResultadoDaMarcacao {
  nome: string
  ok: boolean
  /** O id da presença criada (para o Desfazer); nulo se falhou ou já estava marcada. */
  id: string | null
  jaRegistrada: boolean
  erro: unknown
}

/**
 * "Marcar todos que aceitaram": uma presença por pessoa, cada uma com a sua chave de idempotência,
 * em paralelo. Quem falhou não derruba as demais: o resultado diz quem foi e quem não foi.
 */
export function useMarcarVarias(comunidadeId: string, eventoId: string) {
  const invalidar = useInvalidarPresenca(comunidadeId, eventoId)
  return useMutation({
    mutationFn: async (
      pessoas: readonly { alvo: AlvoDaPresenca; nome: string }[],
    ): Promise<ResultadoDaMarcacao[]> => {
      const feitas = await Promise.allSettled(
        pessoas.map((p) =>
          api.post<{ id: string; jaRegistrada: boolean }>(
            `${doEvento(comunidadeId, eventoId)}/presencas`,
            { chaveIdempotencia: novaChave(), origem: 'manual', ...p.alvo },
          ),
        ),
      )
      return feitas.map((r, i) =>
        r.status === 'fulfilled'
          ? {
              nome: pessoas[i]!.nome,
              ok: true,
              id: r.value.jaRegistrada ? null : r.value.id,
              jaRegistrada: r.value.jaRegistrada,
              erro: null,
            }
          : { nome: pessoas[i]!.nome, ok: false, id: null, jaRegistrada: false, erro: r.reason },
      )
    },
    onSuccess: invalidar,
  })
}

/** Desfaz várias presenças de uma vez (o Desfazer do "Marcar todos"). */
export function useDesfazerVarias(comunidadeId: string, eventoId: string) {
  const invalidar = useInvalidarPresenca(comunidadeId, eventoId)
  return useMutation({
    mutationFn: async (ids: readonly string[]) => {
      await Promise.allSettled(
        ids.map((id) => api.delete(`${doEvento(comunidadeId, eventoId)}/presencas/${id}`)),
      )
    },
    onSuccess: invalidar,
  })
}

export function useDesfazerPresenca(comunidadeId: string, eventoId: string) {
  const invalidar = useInvalidarPresenca(comunidadeId, eventoId)
  return useMutation({
    mutationFn: ({ presencaId }: { presencaId: string; nome: string }) =>
      api.delete(`${doEvento(comunidadeId, eventoId)}/presencas/${presencaId}`),
    onSuccess: invalidar,
  })
}

export function useCancelarInscricao(comunidadeId: string, eventoId: string) {
  const invalidar = useInvalidarPresenca(comunidadeId, eventoId)
  return useMutation({
    mutationFn: (inscricaoId: string) =>
      api.post(`${naComunidade(comunidadeId)}/inscricoes/${inscricaoId}/cancelar`),
    onSuccess: invalidar,
  })
}
