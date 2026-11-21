import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type {
  Disponibilidade,
  EncontroAguardandoResposta,
  MinhaEscala,
  Substituicao,
} from '@/servicos/contratoDosEventos'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import type { DataLocal } from '@/utilidades/datas'

import { naComunidade, textoDeConsulta } from '../eventos/consultas'

export function useMinhasEscalas(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.minhasEscalas(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{ escalas: MinhaEscala[] }>(`${naComunidade(comunidadeId!)}/minhas-escalas`)
        .then((r) => r.escalas),
    enabled: comunidadeId !== null,
  })
}

/** Para quem convoca (D57): encontros publicados com convocação sem resposta ou recusada. */
export function useAguardandoResposta(comunidadeId: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: CHAVES.aguardandoResposta(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{
          encontros: EncontroAguardandoResposta[]
        }>(`${naComunidade(comunidadeId!)}/convocacoes/aguardando-resposta`)
        .then((r) => r.encontros),
    enabled: comunidadeId !== null && habilitado,
  })
}

export function useSubstituicoes(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.substituicoes(comunidadeId ?? ''),
    queryFn: () =>
      api
        .get<{ substituicoes: Substituicao[] }>(`${naComunidade(comunidadeId!)}/substituicoes`)
        .then((r) => r.substituicoes),
    enabled: comunidadeId !== null,
  })
}

/** Membro recebe só a própria; organização recebe a de todos (a RLS decide). */
export function useDisponibilidade(
  comunidadeId: string | null,
  de: DataLocal,
  ate: DataLocal,
  habilitado = true,
) {
  return useQuery({
    queryKey: CHAVES.disponibilidade(comunidadeId ?? '', de, ate),
    queryFn: () =>
      api
        .get<{ disponibilidade: Disponibilidade[] }>(
          `${naComunidade(comunidadeId!)}/disponibilidade${textoDeConsulta({ de, ate })}`,
        )
        .then((r) => r.disponibilidade),
    enabled: comunidadeId !== null && habilitado,
  })
}

/** Tudo que mostra escala depende destas três listas, mais o Início, o resumo e o evento. */
export function useInvalidarEscalas(comunidadeId: string) {
  const consultas = useQueryClient()
  return async () => {
    await Promise.all([
      consultas.invalidateQueries({ queryKey: CHAVES.minhasEscalas(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.substituicoes(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.aguardandoResposta(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.inicio(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: ['c', comunidadeId, 'evento'] }),
      // O resumo do Início conta convocações e pedidos de substituição.
      consultas.invalidateQueries({ queryKey: ['c', comunidadeId, 'eventos', 'visao-geral'] }),
    ])
  }
}

export type Resposta = 'confirmar' | 'recusar'

/** O toast depois de responder (D54): a pessoa sabe que a resposta chegou. */
export const TEXTO_DEPOIS_DE_RESPONDER: Readonly<Record<Resposta, string>> = {
  confirmar: 'Você aceitou. A organização já vê sua resposta.',
  recusar: 'Pronto. A organização foi avisada.',
}

/** "Não posso ir" sempre pergunta antes: a organização recebe um aviso. */
export function confirmarQueNaoPodeIr(): Promise<boolean> {
  return confirmar({
    titulo: 'Avisar que você não pode ir?',
    mensagem: 'A organização recebe o aviso para chamar outra pessoa.',
    confirmar: 'Avisar que não posso',
    cancelar: 'Voltar',
    destrutivo: true,
  })
}

/** Aceitar ("confirmar" na API) ou avisar que não pode ir ("recusar") a própria convocação. */
export function useResponderEscala(comunidadeId: string) {
  const invalidar = useInvalidarEscalas(comunidadeId)
  return useMutation({
    mutationFn: ({ atribuicaoId, resposta }: { atribuicaoId: string; resposta: Resposta }) =>
      api.post(`${naComunidade(comunidadeId)}/atribuicoes/${atribuicaoId}/${resposta}`),
    onSuccess: async (_dados, { resposta }) => {
      mostrarToast({ texto: TEXTO_DEPOIS_DE_RESPONDER[resposta] })
      await invalidar()
    },
  })
}
