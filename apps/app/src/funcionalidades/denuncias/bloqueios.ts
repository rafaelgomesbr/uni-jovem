import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { RecursoDenunciavel } from '@/servicos/contratoDosModulos'
import type { DadosDoAvatar } from '@/ui/Avatar'

import { naComunidade } from '../eventos/consultas'

/**
 * Bloqueio individual (Apple 1.2, D35 e D36 da API): esconde, só para quem
 * bloqueou e só nesta comunidade, os pedidos de oração e as sugestões com nome
 * da outra pessoa. Avisos e programação continuam. Ela não é avisada.
 */

/** `GET /c/:id/bloqueios`: só os bloqueios que a própria pessoa fez. */
export interface PessoaBloqueada {
  id: string
  vinculoId: string | null
  nome: string
  avatar: DadosDoAvatar | null
  fotoVersao: string | null
  bloqueadoEm: string
}

/** De onde vem o bloqueio: um conteúdo que a pessoa vê ou o vínculo (lista de pessoas). */
export type OrigemDoBloqueio =
  { recursoTipo: RecursoDenunciavel; recursoId: string } | { vinculoId: string }

export const chaveDosBloqueios = (comunidadeId: string) =>
  [...CHAVES.comunidade(comunidadeId), 'bloqueios'] as const

export function useBloqueios(comunidadeId: string) {
  return useQuery({
    queryKey: chaveDosBloqueios(comunidadeId),
    queryFn: () =>
      api
        .get<{ bloqueios: PessoaBloqueada[] }>(`${naComunidade(comunidadeId)}/bloqueios`)
        .then((r) => r.bloqueios),
  })
}

/**
 * Bloquear ou desbloquear muda o que a pessoa vê em oração e sugestões desta
 * comunidade: tudo o que é dela no cache é relido. Funções soltas (e não só
 * mutações) porque o "Desfazer" do toast roda depois que a linha ou o cartão
 * já saiu da tela.
 */
export async function bloquearPessoa(
  consultas: QueryClient,
  comunidadeId: string,
  origem: OrigemDoBloqueio,
): Promise<{ id: string; mensagem: string }> {
  const r = await api.post<{ id: string; mensagem: string }>(
    `${naComunidade(comunidadeId)}/bloqueios`,
    origem,
  )
  await consultas.invalidateQueries({ queryKey: CHAVES.comunidade(comunidadeId) })
  return r
}

export async function desbloquearPessoa(
  consultas: QueryClient,
  comunidadeId: string,
  bloqueioId: string,
): Promise<void> {
  await api.delete(`${naComunidade(comunidadeId)}/bloqueios/${bloqueioId}`)
  await consultas.invalidateQueries({ queryKey: CHAVES.comunidade(comunidadeId) })
}

export function useBloquear(comunidadeId: string) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: (origem: OrigemDoBloqueio) => bloquearPessoa(consultas, comunidadeId, origem),
  })
}

export function useDesbloquear(comunidadeId: string) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: (bloqueioId: string) => desbloquearPessoa(consultas, comunidadeId, bloqueioId),
  })
}

/** O que a confirmação explica antes de bloquear (sem jargão, com o caminho de volta). */
export const EXPLICACAO_DO_BLOQUEIO =
  'Você deixa de ver os pedidos de oração e as sugestões desta pessoa, só nesta comunidade. Ela não é avisada, continua na comunidade e nada muda no papel de ninguém. Avisos e encontros continuam aparecendo. Para desfazer: Perfil, Mais opções, Pessoas bloqueadas.'
