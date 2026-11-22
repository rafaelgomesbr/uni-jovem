/**
 * Contas puras da Agenda v3 (D69): o texto da linha "Você: ..." e os formatos de data e horário da
 * linha. O agrupamento por dia (D79) mora em `dias.ts`. Sem tela, para testar sem renderizar nada.
 */
import {
  dataDoInstante,
  DIAS_CURTOS,
  diaDaSemana,
  formatarHora,
  NOMES_DOS_DIAS,
  type DataLocal,
} from '@/utilidades/datas'

export function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

/** "SÁB 16:00 às 17:00 · Salão da igreja": a linha de horário e lugar do encontro. */
export function horarioELocal(
  e: { inicio: string; fuso: string; duracaoMin: number; localNome: string | null },
  comDia = true,
): string {
  const dia = dataDoInstante(e.inicio, e.fuso)
  const fim = new Date(Date.parse(e.inicio) + e.duracaoMin * 60_000).toISOString()
  const horas = `${formatarHora(e.inicio, e.fuso)} às ${formatarHora(fim, e.fuso)}`
  const diaCurto = (DIAS_CURTOS[diaDaSemana(dia)] ?? '').toLocaleUpperCase('pt-BR')
  return [comDia ? `${diaCurto} ${horas}` : horas, e.localNome].filter(Boolean).join(' · ')
}

export interface ParteDaPessoa {
  funcao: string
  etapaTitulo: string | null
  estado: 'pendente' | 'confirmada' | 'recusada' | 'substituicao_pedida'
}

/** "Louvor · Vocal": a etapa e a função; sem etapa, só a função (a pessoa serve no encontro todo). */
export function nomeDaParte(p: Pick<ParteDaPessoa, 'funcao' | 'etapaTitulo'>): string {
  const funcao = primeiraMaiuscula(p.funcao)
  return p.etapaTitulo ? `${p.etapaTitulo} · ${funcao}` : funcao
}

/**
 * O que a linha da Agenda diz de quem é a pessoa no encontro. Recusada não aparece como
 * parte (a linha diz "Você avisou que não pode."); sem nenhuma parte, o texto é nulo.
 */
export function textoDaSuaParte(partes: readonly ParteDaPessoa[]): string | null {
  const ativas = partes.filter((p) => p.estado !== 'recusada')
  if (ativas.length > 0) return `Você: ${ativas.map(nomeDaParte).join(', ')}`
  if (partes.length > 0) return 'Você avisou que não pode.'
  return null
}

/** "sábado 28": o dia da semana por extenso e o número, para o toast de quem aceitou. */
export function diaDoToast(inicio: string, fuso: string): string {
  const dia = dataDoInstante(inicio, fuso)
  return `${NOMES_DOS_DIAS[diaDaSemana(dia)]} ${Number(dia.slice(8, 10))}`
}

const MESES_CURTOS = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'maio',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
] as const

/** "5 de dez.": o dia e o mês abreviado (o ano nunca importa numa agenda de semanas). */
export function diaEMesCurto(data: DataLocal): string {
  return `${Number(data.slice(8, 10))} de ${MESES_CURTOS[Number(data.slice(5, 7)) - 1] ?? ''}`
}

/** "Sáb., 28 de nov.": o dia da semana abreviado com a data (o formato da linha e do cartão). */
export function dataCurtaDoDia(dia: DataLocal): string {
  const semana = primeiraMaiuscula(DIAS_CURTOS[diaDaSemana(dia)] ?? '')
  return `${semana}., ${diaEMesCurto(dia)}`
}

/** O mesmo, a partir do instante do encontro e do fuso dele. */
export function dataCurtaDoEncontro(inicio: string, fuso: string): string {
  return dataCurtaDoDia(dataDoInstante(inicio, fuso))
}
