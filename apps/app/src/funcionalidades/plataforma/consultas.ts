import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type {
  ComunidadeDaPlataforma,
  ComunidadeDaPlataformaAberta,
  DenunciaDeComunidade,
  PaginaDeComunidadesDaPlataforma,
} from '@/servicos/contrato'

export type ComunidadeNaPlataforma = ComunidadeDaPlataforma & ComunidadeDaPlataformaAberta

/** "Novas", "Verificadas" e "Todas" (ADR 0007). */
export type FiltroDaPlataforma = 'nova' | 'verificada' | 'todas'

type Paginas = InfiniteData<PaginaDeComunidadesDaPlataforma, unknown>

function caminhoDaLista(verificacao: FiltroDaPlataforma, busca: string, cursor: string | null) {
  const parametros = new URLSearchParams({ verificacao })
  if (busca) parametros.set('busca', busca)
  if (cursor) parametros.set('cursor', cursor)
  return `/api/v1/plataforma/comunidades?${parametros.toString()}`
}

/** Lista da Plataforma por filtro e busca, paginada por cursor. */
export function useListaDaPlataforma(verificacao: FiltroDaPlataforma, busca: string) {
  const { conta } = useSessao()
  return useInfiniteQuery({
    queryKey: CHAVES.listaDaPlataforma(verificacao, busca),
    queryFn: ({ pageParam }) =>
      api.get<PaginaDeComunidadesDaPlataforma>(caminhoDaLista(verificacao, busca, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.proximoCursor ?? null,
    enabled: conta?.criador === true,
  })
}

/** Procura a comunidade em todas as listas já carregadas, a começar pela mais recente. */
function procurarNoCache(
  consultas: QueryClient,
  id: string,
  primeira: Paginas | undefined,
): ComunidadeNaPlataforma | null {
  const daPrimeira = primeira?.pages.flatMap((p) => p.comunidades).find((c) => c.id === id)
  if (daPrimeira) return daPrimeira
  for (const [, dados] of consultas.getQueriesData<Paginas>({ queryKey: CHAVES.plataforma })) {
    const achada = dados?.pages?.flatMap((p) => p.comunidades).find((c) => c.id === id)
    if (achada) return achada
  }
  return null
}

/**
 * Uma comunidade da Plataforma: a API não tem detalhe por id, então ela vem
 * da lista "Todas" ou de qualquer lista já aberta (o toque veio de uma delas).
 */
export function useComunidadeDaPlataforma(id: string) {
  const consultas = useQueryClient()
  const todas = useListaDaPlataforma('todas', '')
  const comunidade = procurarNoCache(consultas, id, todas.data)
  return { lista: todas, comunidade }
}

/**
 * Depois de verificar, suspender e afins: a mudança entra nas listas em cache
 * na hora (as que não estão na tela só buscariam de novo quando abertas).
 */
export function atualizarNasListas(
  consultas: QueryClient,
  id: string,
  parcial: Partial<ComunidadeNaPlataforma>,
): void {
  consultas.setQueriesData<Paginas>({ queryKey: CHAVES.plataforma }, (dados) =>
    dados?.pages
      ? {
          ...dados,
          pages: dados.pages.map((p) => ({
            ...p,
            comunidades: p.comunidades.map((c) => (c.id === id ? { ...c, ...parcial } : c)),
          })),
        }
      : dados,
  )
}

/** Denúncias de comunidade abertas, para a fila da Plataforma. */
export function useDenunciasDeComunidade() {
  const { conta } = useSessao()
  return useQuery({
    queryKey: CHAVES.denunciasDeComunidade,
    queryFn: () =>
      api
        .get<{ denuncias: DenunciaDeComunidade[] }>('/api/v1/plataforma/denuncias-de-comunidade')
        .then((r) => r.denuncias),
    enabled: conta?.criador === true,
    // O detalhe de uma denúncia pode citar pessoas: não fica no cache depois de sair.
    gcTime: 0,
  })
}
