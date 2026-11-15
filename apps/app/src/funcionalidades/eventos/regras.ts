/**
 * Decisões de tela sobre um evento, a partir das regras puras de
 * `@uj/dominio`. A API confere tudo de novo: aqui só se evita oferecer o
 * impossível.
 */
import { calcularHorarios, podeMudarStatus, type StatusDoEvento } from '@uj/dominio'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'

export interface AcoesDeStatus {
  publicar: boolean
  adiar: boolean
  cancelar: boolean
  encerrar: boolean
  /** Só rascunho pode ser excluído; publicado se cancela, para avisar quem participa. */
  excluir: boolean
}

export function acoesDeStatus(status: StatusDoEvento): AcoesDeStatus {
  return {
    publicar: podeMudarStatus(status, 'publicado'),
    adiar: podeMudarStatus(status, 'adiado'),
    cancelar: podeMudarStatus(status, 'cancelado'),
    encerrar: podeMudarStatus(status, 'encerrado'),
    excluir: status === 'rascunho',
  }
}

export type MotivoSemInscricao = 'nao_publicado' | 'ja_comecou' | 'prazo_encerrado' | null

/** Por que a inscrição não está aberta (ou `null` se está). Mesma regra de `uj.inscrever_membro`. */
export function motivoSemInscricao(
  evento: Pick<DetalheDoEvento, 'status' | 'inicio' | 'inscricaoAte'>,
  agora: Date = new Date(),
): MotivoSemInscricao {
  if (evento.status !== 'publicado') return 'nao_publicado'
  if (new Date(evento.inicio) <= agora) return 'ja_comecou'
  if (evento.inscricaoAte && new Date(evento.inscricaoAte) <= agora) return 'prazo_encerrado'
  return null
}

export const EXPLICACAO_SEM_INSCRICAO: Readonly<Record<NonNullable<MotivoSemInscricao>, string>> = {
  nao_publicado: 'As inscrições abrem quando o evento for publicado.',
  ja_comecou: 'O evento já começou: as inscrições estão encerradas.',
  prazo_encerrado: 'O prazo de inscrição terminou.',
}

/** Ao vivo só existe para evento publicado (a API recusa os demais). */
export function podeIrAoVivo(status: StatusDoEvento): boolean {
  return status === 'publicado' || status === 'encerrado'
}

/**
 * Aplica uma ordem nova às etapas e recalcula os horários previstos (a mesma
 * conta da API), para a tela responder na hora enquanto o servidor confirma.
 */
export function reordenarEtapas(evento: DetalheDoEvento, ids: readonly string[]): DetalheDoEvento {
  const porId = new Map(evento.etapas.map((e) => [e.id, e]))
  const ordenadas = ids.map((id) => porId.get(id)).filter((e) => e !== undefined)
  if (ordenadas.length !== evento.etapas.length) return evento
  const horarios = calcularHorarios(new Date(evento.inicio), ordenadas)
  return {
    ...evento,
    etapas: ordenadas.map((e, i) => ({
      ...e,
      ordem: i,
      inicioPrevisto: horarios[i]!.inicio.toISOString(),
      fimPrevisto: horarios[i]!.fim.toISOString(),
    })),
  }
}
