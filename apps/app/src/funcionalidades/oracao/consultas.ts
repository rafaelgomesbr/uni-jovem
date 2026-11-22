import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { VisibilidadeDeOracao } from '@uj/dominio'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  FiltroDeOracao,
  FiltroDeRespondidos,
  PedidoDeOracao,
} from '@/servicos/contratoDosModulos'

import { chaveDoMural } from '../comunidade/consultas'
import { naComunidade, textoDeConsulta } from '../eventos/consultas'

/**
 * Pedidos de oração são o dado mais sensível do app (plano, seção 9):
 * - `gcTime: 0`: o texto sai da memória assim que nenhuma tela o mostra;
 * - `meta.persistir: false`: se um dia o cache do React Query for persistido
 *   em disco, estas consultas ficam de fora (o persistidor deve respeitar);
 * - mutações também com `gcTime: 0`, porque as variáveis levam o texto;
 * - nada aqui vai para log, armazenamento offline ou notificação.
 */
export const SEM_GUARDAR = { gcTime: 0, staleTime: 0, meta: { persistir: false } } as const

const base = (comunidadeId: string) => `${naComunidade(comunidadeId)}/oracao`

export function usePedidosDeOracao(
  comunidadeId: string,
  filtro: FiltroDeOracao,
  respondidos: FiltroDeRespondidos,
) {
  return useQuery({
    queryKey: [...CHAVES.oracao(comunidadeId), 'lista', filtro, respondidos],
    queryFn: () =>
      api
        .get<{
          pedidos: PedidoDeOracao[]
        }>(`${base(comunidadeId)}${textoDeConsulta({ filtro, respondidos })}`)
        .then((r) => r.pedidos),
    ...SEM_GUARDAR,
  })
}

export function usePedidoDeOracao(comunidadeId: string, pedidoId: string) {
  return useQuery({
    queryKey: [...CHAVES.oracao(comunidadeId), 'pedido', pedidoId],
    queryFn: () => api.get<PedidoDeOracao>(`${base(comunidadeId)}/${pedidoId}`),
    ...SEM_GUARDAR,
  })
}

/** Mutação de oração: não guarda as variáveis e recarrega as listas ao terminar. */
function useMutacaoDeOracao<V, R>(comunidadeId: string, executar: (v: V) => Promise<R>) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: executar,
    gcTime: 0,
    // O mural conta os pedidos novos: criar, orar ou excluir mexe no número.
    onSettled: () =>
      Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.oracao(comunidadeId) }),
        consultas.invalidateQueries({ queryKey: chaveDoMural(comunidadeId) }),
      ]),
  })
}

export function useCriarPedido(comunidadeId: string) {
  return useMutacaoDeOracao(
    comunidadeId,
    (v: { texto: string; visibilidade: VisibilidadeDeOracao; anonimo: boolean }) =>
      api.post<{ id: string }>(base(comunidadeId), v),
  )
}

export function useEditarPedido(comunidadeId: string) {
  return useMutacaoDeOracao(comunidadeId, (v: { id: string; texto: string; versao: number }) =>
    api.patch(`${base(comunidadeId)}/${v.id}`, { texto: v.texto, versao: v.versao }),
  )
}

/** Liga ou desliga o anonimato (só a autora; a API confere a versão). */
export function useMudarAnonimato(comunidadeId: string) {
  return useMutacaoDeOracao(comunidadeId, (v: { id: string; anonimo: boolean; versao: number }) =>
    api.patch(`${base(comunidadeId)}/${v.id}`, { anonimo: v.anonimo, versao: v.versao }),
  )
}

export function useMudarVisibilidade(comunidadeId: string) {
  return useMutacaoDeOracao(
    comunidadeId,
    (v: { id: string; de: VisibilidadeDeOracao; para: VisibilidadeDeOracao }) =>
      api.put(`${base(comunidadeId)}/${v.id}/visibilidade`, { de: v.de, para: v.para }),
  )
}

export function useMarcarRespondido(comunidadeId: string) {
  return useMutacaoDeOracao(comunidadeId, (v: { id: string; respondido: boolean }) =>
    api.post(`${base(comunidadeId)}/${v.id}/respondido`, { respondido: v.respondido }),
  )
}

export function useEstouOrando(comunidadeId: string) {
  return useMutacaoDeOracao(comunidadeId, (v: { id: string; orando: boolean }) =>
    v.orando
      ? api.post(`${base(comunidadeId)}/${v.id}/orando`)
      : api.delete(`${base(comunidadeId)}/${v.id}/orando`),
  )
}

export function useExcluirPedido(comunidadeId: string) {
  return useMutacaoDeOracao(comunidadeId, (id: string) => api.delete(`${base(comunidadeId)}/${id}`))
}
