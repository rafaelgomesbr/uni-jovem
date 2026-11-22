import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/servicos/api'
import type {
  ModoDeLimpeza,
  ResultadoDaLimpeza,
  ResumoDosProximosEncontros,
} from '@/servicos/contratoDaExclusao'

import { naComunidade, useInvalidarEventos } from './consultas'

/** Motivo que vai para quem recebe o aviso, quando a pessoa não escreve outro. */
export const MOTIVO_PADRAO_DA_LIMPEZA = 'Agenda reorganizada pela liderança.'

const caminho = (comunidadeId: string) => `${naComunidade(comunidadeId)}/eventos/limpar-proximos`

/**
 * O que a limpeza alcançaria agora (`GET .../eventos/limpar-proximos`). Sob o prefixo dos
 * eventos, então qualquer mudança na agenda o recarrega; sempre pede de novo ao abrir a tela,
 * porque a decisão é sobre números que precisam estar frescos.
 */
export function useResumoDosProximos(comunidadeId: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: ['c', comunidadeId ?? '', 'eventos', 'limpar-proximos'] as const,
    queryFn: ({ signal }) =>
      api.get<ResumoDosProximosEncontros>(caminho(comunidadeId!), { sinal: signal }),
    enabled: comunidadeId !== null && habilitado,
    staleTime: 0,
    gcTime: 0,
  })
}

/** `POST .../eventos/limpar-proximos`: ao terminar, a agenda e o Início recarregam. */
export function useLimparProximos(comunidadeId: string) {
  const invalidar = useInvalidarEventos(comunidadeId)
  return useMutation({
    mutationFn: (corpo: {
      modo: ModoDeLimpeza
      totalEsperado: number
      motivo?: string
    }): Promise<ResultadoDaLimpeza> =>
      api.post<ResultadoDaLimpeza>(caminho(comunidadeId), { ...corpo, confirmo: true }),
    onSuccess: () => invalidar(),
  })
}

export function quantosEncontros(n: number): string {
  return `${n} ${n === 1 ? 'encontro' : 'encontros'}`
}

function quantasPessoas(n: number): string {
  return `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`
}

/** "2 rascunhos, 3 publicados e 1 cancelado": só o que existe, no singular ou no plural. */
export function detalheDosEncontros(r: ResumoDosProximosEncontros): string {
  const partes = [
    [r.rascunhos, 'rascunho', 'rascunhos'],
    [r.publicados, 'publicado', 'publicados'],
    [r.adiados, 'adiado', 'adiados'],
    [r.cancelados, 'cancelado', 'cancelados'],
    [r.encerrados, 'encerrado', 'encerrados'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`)
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`
}

/** Quantos encontros o modo escolhido mexe de fato (no "avisar", os já cancelados ficam como estão). */
export function encontrosAfetados(r: ResumoDosProximosEncontros, modo: ModoDeLimpeza): number {
  return modo === 'apagar' ? r.total : r.rascunhos + r.publicados + r.adiados
}

/** O que cada modo faz, em palavras de quem nunca viu o sistema. */
export function consequenciaDaLimpeza(r: ResumoDosProximosEncontros, modo: ModoDeLimpeza): string {
  if (modo === 'apagar') {
    return `${quantosEncontros(r.total)} ${r.total === 1 ? 'some' : 'somem'} de vez, com tudo o que está dentro: convocações, repertório, inscrições e presenças. Ninguém é avisado. Isto não se desfaz.`
  }
  const aviso =
    r.pessoasAAvisar > 0
      ? `Vai avisar até ${quantasPessoas(r.pessoasAAvisar)}.`
      : 'Não há ninguém para avisar.'
  const semAviso =
    r.publicados + r.adiados === 0
      ? 'Os rascunhos são apagados.'
      : 'Os rascunhos são apagados; os publicados e adiados ficam na agenda como cancelados.'
  return `${aviso} ${semAviso} Isto não se desfaz.`
}
