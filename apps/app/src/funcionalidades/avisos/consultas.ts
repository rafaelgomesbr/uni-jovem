import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Aviso, EstadoDoAviso } from '@/servicos/contratoDosModulos'

import { chaveDoMural, useMembros } from '../comunidade/consultas'
import { naComunidade } from '../eventos/consultas'

export const NOME_DO_ESTADO: Readonly<Record<EstadoDoAviso, string>> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  despublicado: 'Despublicado',
}

const base = (comunidadeId: string) => `${naComunidade(comunidadeId)}/avisos`

/** Membro recebe só os publicados e vigentes (a RLS esconde o resto). */
export function useAvisos(comunidadeId: string) {
  return useQuery({
    queryKey: [...CHAVES.avisos(comunidadeId), 'lista'],
    queryFn: () => api.get<{ avisos: Aviso[] }>(base(comunidadeId)).then((r) => r.avisos),
  })
}

export function useAviso(comunidadeId: string, avisoId: string) {
  return useQuery({
    queryKey: [...CHAVES.avisos(comunidadeId), 'item', avisoId],
    queryFn: () => api.get<Aviso>(`${base(comunidadeId)}/${avisoId}`),
  })
}

/**
 * Quantas pessoas o aviso alcançaria: os membros ativos, sem quem publica. É o número do
 * botão "Publicar e avisar 11 pessoas" (P4: o botão diz quem será avisado). Quem desligou
 * os avisos no aparelho não recebe o push, mas vê o aviso no app: por isso é "até".
 * `null` enquanto a lista de pessoas não chegou.
 */
export function usePessoasAAvisar(comunidadeId: string): number | null {
  const { conta } = useSessao()
  const membros = useMembros(comunidadeId)
  if (!membros.data) return null
  return membros.data.filter((m) => m.estado === 'ativo' && m.contaId !== conta?.id).length
}

/** "Publicar e avisar 11 pessoas"; sem ninguém para avisar (ou sem a conta feita), só "Publicar". */
export function rotuloDePublicar(pessoas: number | null): string {
  if (!pessoas) return 'Publicar'
  return `Publicar e avisar ${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}`
}

/** Aviso aparece também no Início e no mural: as três listas recarregam juntas. */
function useMutacaoDeAviso<V, R>(comunidadeId: string, executar: (v: V) => Promise<R>) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: executar,
    onSuccess: () =>
      Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.avisos(comunidadeId) }),
        consultas.invalidateQueries({ queryKey: CHAVES.inicio(comunidadeId) }),
        consultas.invalidateQueries({ queryKey: chaveDoMural(comunidadeId) }),
      ]),
  })
}

export interface DadosDoAviso {
  titulo: string
  texto: string
  fixado: boolean
  visivelAte: string | null
}

export function useCriarAviso(comunidadeId: string) {
  return useMutacaoDeAviso(comunidadeId, (v: DadosDoAviso & { publicar: boolean }) =>
    api.post<{ id: string }>(base(comunidadeId), v),
  )
}

export function useEditarAviso(comunidadeId: string) {
  return useMutacaoDeAviso(
    comunidadeId,
    (v: { id: string; versao: number } & Partial<DadosDoAviso>) => {
      const { id, ...corpo } = v
      return api.patch(`${base(comunidadeId)}/${id}`, corpo)
    },
  )
}

export function usePublicacaoDoAviso(comunidadeId: string) {
  return useMutacaoDeAviso(comunidadeId, (v: { id: string; acao: 'publicar' | 'despublicar' }) =>
    api.post(`${base(comunidadeId)}/${v.id}/${v.acao}`),
  )
}

export function useExcluirAviso(comunidadeId: string) {
  return useMutacaoDeAviso(comunidadeId, (id: string) => api.delete(`${base(comunidadeId)}/${id}`))
}
