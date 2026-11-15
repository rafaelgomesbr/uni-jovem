import { useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  DetalheDaSerie,
  DetalheDoEvento,
  Local,
  RespostaDeModelos,
  ResumoDoEvento,
} from '@/servicos/contratoDosEventos'

/** Caminho base das rotas de uma comunidade. */
export const naComunidade = (comunidadeId: string) => `/api/v1/c/${comunidadeId}`

/** Query string sem depender do URLSearchParams (incompleto no React Native). */
export function textoDeConsulta(parametros: Record<string, string | number | null | undefined>) {
  const pares = Object.entries(parametros)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return pares.length ? `?${pares.join('&')}` : ''
}

/** Eventos com início em [de, ate). Passe sempre `de`: sem ele a API começa pelos mais antigos. */
export function useEventosNoPeriodo(
  comunidadeId: string | null,
  de: string | null,
  ate: string | null,
) {
  return useQuery({
    queryKey: CHAVES.eventosNoPeriodo(comunidadeId ?? '', de, ate),
    queryFn: ({ signal }) =>
      api
        .get<{ eventos: ResumoDoEvento[] }>(
          `${naComunidade(comunidadeId!)}/eventos${textoDeConsulta({ de, ate })}`,
          { sinal: signal },
        )
        .then((r) => r.eventos),
    enabled: comunidadeId !== null,
  })
}

export function useEvento(comunidadeId: string | null, eventoId: string | null) {
  return useQuery({
    queryKey: CHAVES.evento(comunidadeId ?? '', eventoId ?? ''),
    queryFn: ({ signal }) =>
      api.get<DetalheDoEvento>(`${naComunidade(comunidadeId!)}/eventos/${eventoId}`, {
        sinal: signal,
      }),
    enabled: comunidadeId !== null && !!eventoId,
  })
}

export function useLocais(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.locais(comunidadeId ?? ''),
    queryFn: () =>
      api.get<{ locais: Local[] }>(`${naComunidade(comunidadeId!)}/locais`).then((r) => r.locais),
    enabled: comunidadeId !== null,
  })
}

export function useModelos(comunidadeId: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: CHAVES.modelos(comunidadeId ?? ''),
    queryFn: () => api.get<RespostaDeModelos>(`${naComunidade(comunidadeId!)}/modelos`),
    enabled: comunidadeId !== null && habilitado,
  })
}

export function useSerie(comunidadeId: string | null, serieId: string | null, habilitado = true) {
  return useQuery({
    queryKey: CHAVES.serie(comunidadeId ?? '', serieId ?? ''),
    queryFn: () => api.get<DetalheDaSerie>(`${naComunidade(comunidadeId!)}/series/${serieId}`),
    enabled: comunidadeId !== null && !!serieId && habilitado,
  })
}

/**
 * Depois de mudar um evento, tudo que mostra eventos precisa recarregar:
 * o detalhe, as listas (agenda, programações) e o Início.
 */
export function useInvalidarEventos(comunidadeId: string) {
  const consultas = useQueryClient()
  return async (eventoId?: string) => {
    await Promise.all([
      eventoId
        ? consultas.invalidateQueries({ queryKey: CHAVES.evento(comunidadeId, eventoId) })
        : null,
      consultas.invalidateQueries({ queryKey: CHAVES.eventos(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.inicio(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.minhasEscalas(comunidadeId) }),
    ])
  }
}
