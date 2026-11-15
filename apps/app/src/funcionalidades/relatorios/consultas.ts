import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { registrarAoEncerrarSessao } from '@/estado/aoEncerrarSessao'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  Agrupamento,
  Exportacao,
  ExportacaoGerada,
  RelatorioDeAtividade,
  RelatorioDeEscalas,
  RelatorioDeInscricoes,
  RelatorioDePresenca,
  TipoDeExportacao,
} from '@/servicos/contratoDosModulos'

import { naComunidade, textoDeConsulta } from '../eventos/consultas'

export type TipoDeRelatorio = 'presenca' | 'inscricoes' | 'escalas' | 'atividade'

export interface RespostasDosRelatorios {
  presenca: RelatorioDePresenca
  inscricoes: RelatorioDeInscricoes
  escalas: RelatorioDeEscalas
  atividade: RelatorioDeAtividade
}

export interface FiltrosDoRelatorio {
  de: string
  ate: string
  agrupar: Agrupamento
}

export function useRelatorio<T extends TipoDeRelatorio>(
  comunidadeId: string,
  tipo: T,
  f: FiltrosDoRelatorio,
) {
  // Atividade não agrupa: o parâmetro nem vai, para a chave de cache não se multiplicar.
  const filtros: Record<string, string> =
    tipo === 'atividade' ? { de: f.de, ate: f.ate } : { de: f.de, ate: f.ate, agrupar: f.agrupar }
  return useQuery({
    queryKey: CHAVES.relatorio(comunidadeId, tipo, filtros),
    queryFn: ({ signal }) =>
      api.get<RespostasDosRelatorios[T]>(
        `${naComunidade(comunidadeId)}/relatorios/${tipo}${textoDeConsulta(filtros)}`,
        { sinal: signal },
      ),
  })
}

// ------------------------------------------------------------ exportações

/**
 * Tokens de download: a API só devolve o token na hora em que gera o arquivo
 * e guarda apenas o hash. O app mantém o token SÓ em memória, nunca em disco
 * nem em log; sair da conta esquece todos.
 */
const tokens = new Map<string, string>()
const ouvintes = new Set<() => void>()
let versaoDosTokens = 0

function avisar() {
  versaoDosTokens++
  for (const o of ouvintes) o()
}

export function guardarToken(exportacaoId: string, token: string) {
  tokens.set(exportacaoId, token)
  avisar()
}

export function esquecerToken(exportacaoId: string) {
  if (tokens.delete(exportacaoId)) avisar()
}

export function tokenDe(exportacaoId: string): string | undefined {
  return tokens.get(exportacaoId)
}

registrarAoEncerrarSessao(() => {
  tokens.clear()
  avisar()
})

/** Re-renderiza quando um token entra ou sai. */
export function useTokensDeExportacao(): number {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o)
      return () => {
        ouvintes.delete(o)
      }
    },
    () => versaoDosTokens,
    () => versaoDosTokens,
  )
}

export function useExportacoes(comunidadeId: string) {
  return useQuery({
    queryKey: CHAVES.exportacoes(comunidadeId),
    queryFn: () =>
      api
        .get<{ exportacoes: Exportacao[] }>(`${naComunidade(comunidadeId)}/exportacoes`)
        .then((r) => r.exportacoes),
  })
}

export function useGerarExportacao(comunidadeId: string) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: (v: { tipo: TipoDeExportacao; comContatos: boolean; de?: string; ate?: string }) =>
      api.post<ExportacaoGerada>(`${naComunidade(comunidadeId)}/exportacoes`, v),
    // A resposta traz o token: não fica no cache de mutações.
    gcTime: 0,
    onSuccess: async (r) => {
      guardarToken(r.id, r.token)
      await consultas.invalidateQueries({ queryKey: CHAVES.exportacoes(comunidadeId) })
    },
  })
}

export function useExcluirExportacao(comunidadeId: string) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`${naComunidade(comunidadeId)}/exportacoes/${id}`),
    onSuccess: async (_r, id) => {
      esquecerToken(id)
      await consultas.invalidateQueries({ queryKey: CHAVES.exportacoes(comunidadeId) })
    },
  })
}

/** Baixa o CSV com o token no corpo de um POST (token na URL acabaria em log). */
export function baixarCsv(comunidadeId: string, exportacaoId: string): Promise<string> {
  const token = tokenDe(exportacaoId)
  if (!token) return Promise.reject(new Error('sem_token'))
  return api.pedir<string>(`${naComunidade(comunidadeId)}/exportacoes/${exportacaoId}/arquivo`, {
    metodo: 'POST',
    corpo: { token },
    formato: 'texto',
  })
}
