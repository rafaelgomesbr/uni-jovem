import { useQuery } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { RespostaDoInicio, RetratoAoVivo } from '@/servicos/contratoDosEventos'
import type { MomentoDoInicio } from '@/servicos/contratoV3'

import { naComunidade } from '../eventos/consultas'

/**
 * `GET /inicio` com o campo `momento` da D66 (o cartão do momento). Os campos de antes seguem:
 * o "Para responder" e o resumo ainda leem `minhasEscalas`, `minhasTarefas` e os avisos.
 * `momento` é opcional no tipo porque uma cópia guardada por uma versão antiga do app não o
 * tem: a tela trata a falta como "ainda carregando" e pede de novo.
 */
export interface RespostaDoInicioComMomento extends RespostaDoInicio {
  momento?: MomentoDoInicio
}

export function useInicio(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.inicio(comunidadeId ?? ''),
    queryFn: () => api.get<RespostaDoInicioComMomento>(`${naComunidade(comunidadeId!)}/inicio`),
    enabled: comunidadeId !== null,
  })
}

/**
 * O andamento do encontro que está acontecendo, só para a linha "Agora: Louvor, até 16:20.
 * Depois: Oração intercessora." do líder. Uma leitura simples (a tela Ao vivo é que acompanha em
 * tempo real), com a chave sob o prefixo do Início: recarrega junto com ele.
 */
export function useAndamentoDoCartao(
  comunidadeId: string,
  eventoId: string | null,
  habilitado: boolean,
) {
  return useQuery({
    queryKey: [...CHAVES.inicio(comunidadeId), 'andamento', eventoId ?? ''] as const,
    queryFn: () =>
      api.get<RetratoAoVivo>(`${naComunidade(comunidadeId)}/eventos/${eventoId}/ao-vivo`),
    enabled: habilitado && !!eventoId,
    // Sem a rota ou sem rede, o cartão cai no texto simples: nada quebra.
    retry: false,
    refetchInterval: 30_000,
  })
}
