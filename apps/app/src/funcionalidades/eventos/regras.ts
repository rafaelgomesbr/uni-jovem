/**
 * Decisões de tela sobre um evento, a partir das regras puras de
 * `@uj/dominio`. A API confere tudo de novo: aqui só se evita oferecer o
 * impossível.
 */
import { calcularHorarios, podeMudarStatus, type StatusDoEvento } from '@uj/dominio'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { dataDoInstante, hojeNoFuso } from '@/utilidades/datas'

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
  nao_publicado: 'As inscrições abrem quando o encontro for publicado.',
  ja_comecou: 'O encontro já começou: as inscrições estão encerradas.',
  prazo_encerrado: 'O prazo de inscrição terminou.',
}

/**
 * O início já passou? Quem erra o ano no calendário publicaria (com push) um
 * encontro que não vai acontecer: antes de publicar, a tela pergunta (M6).
 */
export function dataJaPassou(inicio: string, agora: Date = new Date()): boolean {
  return new Date(inicio).getTime() < agora.getTime()
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

// ------------------------------------------------------------ o relógio do encontro (D69)

/** Onde o encontro está no relógio: decide a luz da tela, a etiqueta e o botão principal. */
export type FaseDoEncontro = 'longe' | 'vespera' | 'no_dia' | 'checkin' | 'acontecendo' | 'terminou'

/** Antes dele, o check-in já abre (o "Fazer check-in" aparece 2 h antes). */
export const MINUTOS_DO_CHECKIN_ANTES = 120

/** Dias de calendário, no fuso do encontro, de hoje até o dia dele (negativo se já passou). */
export function diasAteOEncontro(
  evento: Pick<DetalheDoEvento, 'inicio' | 'fuso'>,
  agora: Date = new Date(),
): number {
  const dia = dataDoInstante(evento.inicio, evento.fuso)
  const hoje = hojeNoFuso(evento.fuso, agora)
  return Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000)
}

export function faseDoEncontro(
  evento: Pick<DetalheDoEvento, 'inicio' | 'fuso' | 'duracaoMin'>,
  agora: Date = new Date(),
): FaseDoEncontro {
  const inicio = Date.parse(evento.inicio)
  const fim = inicio + evento.duracaoMin * 60_000
  if (agora.getTime() > fim) return 'terminou'
  if (agora.getTime() >= inicio) return 'acontecendo'
  const dias = diasAteOEncontro(evento, agora)
  if (dias <= 0) {
    return (inicio - agora.getTime()) / 60_000 <= MINUTOS_DO_CHECKIN_ANTES ? 'checkin' : 'no_dia'
  }
  return dias === 1 ? 'vespera' : 'longe'
}

/** "Em 5 dias", "Amanhã", "Hoje", "Acontecendo agora", "Terminou": a etiqueta ao lado do título. */
export function etiquetaDoEncontro(
  evento: Pick<DetalheDoEvento, 'inicio' | 'fuso' | 'duracaoMin'>,
  agora: Date = new Date(),
): string {
  const fase = faseDoEncontro(evento, agora)
  if (fase === 'terminou') return 'Terminou'
  if (fase === 'acontecendo') return 'Acontecendo agora'
  if (fase === 'checkin' || fase === 'no_dia') return 'Hoje'
  if (fase === 'vespera') return 'Amanhã'
  return `Em ${diasAteOEncontro(evento, agora)} dias`
}

/** A luz de base e a pose do sol que acompanham a fase (os mesmos nomes da `Tela`). */
export function momentoDaFase(fase: FaseDoEncontro): 'longe' | 'vespera' | 'dia' | 'agora' | 'fim' {
  if (fase === 'terminou') return 'fim'
  if (fase === 'acontecendo') return 'agora'
  if (fase === 'checkin' || fase === 'no_dia') return 'dia'
  return fase
}
