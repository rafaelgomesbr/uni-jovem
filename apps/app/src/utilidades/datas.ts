/**
 * Datas no fuso da COMUNIDADE (não no do aparelho): quem viaja continua vendo
 * o horário do encontro como ele é lá. A conversão usa as funções puras de
 * `@uj/dominio` (as mesmas da API), sem depender do Intl do aparelho para
 * calcular; o Intl só entra para descobrir o fuso do próprio aparelho.
 */
import {
  dataNoFuso,
  dataValida,
  deslocamentoDoFuso,
  instanteNoFuso,
  type DataLocal,
} from '@uj/dominio'

export type { DataLocal } from '@uj/dominio'

const FUSO_PADRAO = 'America/Sao_Paulo'

export const NOMES_DOS_MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

export const NOMES_DOS_DIAS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const

export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

export function fusoDoAparelho(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FUSO_PADRAO
  } catch {
    return FUSO_PADRAO
  }
}

/** A data AAAA-MM-DD de um parâmetro de rota, se for uma data real. */
export function dataValidaOuNula(texto: string | null | undefined): DataLocal | null {
  return texto && dataValida(texto) ? texto : null
}

function partes(data: DataLocal): [number, number, number] {
  return data.split('-').map(Number) as [number, number, number]
}

const dois = (n: number) => String(n).padStart(2, '0')

export function montarData(ano: number, mes0: number, dia: number): DataLocal {
  return new Date(Date.UTC(ano, mes0, dia)).toISOString().slice(0, 10)
}

export function somarDias(data: DataLocal, dias: number): DataLocal {
  const [a, m, d] = partes(data)
  return montarData(a, m - 1, d + dias)
}

export function somarMeses(data: DataLocal, meses: number): DataLocal {
  const [a, m] = partes(data)
  return montarData(a, m - 1 + meses, 1)
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(data: DataLocal): number {
  const [a, m, d] = partes(data)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

export function hojeNoFuso(fuso: string, agora: Date = new Date()): DataLocal {
  return dataNoFuso(agora, fuso)
}

/** Data de parede de um instante ISO no fuso. */
export function dataDoInstante(iso: string, fuso: string): DataLocal {
  return dataNoFuso(new Date(iso), fuso)
}

/** Hora de parede (HH:MM) de um instante no fuso. */
export function formatarHora(iso: string, fuso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  return new Date(t + deslocamentoDoFuso(fuso, t)).toISOString().slice(11, 16)
}

/** 15/11/2026 */
export function formatarDataLocal(data: DataLocal): string {
  const [a, m, d] = partes(data)
  return `${dois(d)}/${dois(m)}/${a}`
}

/** sábado, 15 de novembro de 2026 */
export function formatarDataPorExtenso(data: DataLocal, comAno = true): string {
  const [a, m, d] = partes(data)
  const base = `${NOMES_DOS_DIAS[diaDaSemana(data)]}, ${d} de ${NOMES_DOS_MESES[m - 1]}`
  return comAno ? `${base} de ${a}` : base
}

/** sáb, 15/11 */
export function formatarDiaCurto(data: DataLocal): string {
  const [, m, d] = partes(data)
  return `${DIAS_CURTOS[diaDaSemana(data)]}, ${dois(d)}/${dois(m)}`
}

/** sáb, 15/11/2026 às 16:00 (sempre absoluto). */
export function formatarQuando(iso: string, fuso: string): string {
  const data = dataDoInstante(iso, fuso)
  return `${DIAS_CURTOS[diaDaSemana(data)]}, ${formatarDataLocal(data)} às ${formatarHora(iso, fuso)}`
}

/** Por extenso, para o leitor de tela: "sábado, 15 de novembro de 2026, às 16:00". */
export function falarQuando(iso: string, fuso: string): string {
  return `${formatarDataPorExtenso(dataDoInstante(iso, fuso))}, às ${formatarHora(iso, fuso)}`
}

/** 45 min · 1 h · 1 h 05 min */
export function formatarDuracao(minutos: number): string {
  const m = Math.max(0, Math.round(minutos))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const resto = m % 60
  return resto ? `${h} h ${dois(resto)} min` : `${h} h`
}

/** Aceita 15/11/2026, 15-11-2026 e 2026-11-15. `null` se não for uma data real. */
export function lerDataDigitada(texto: string): DataLocal | null {
  const limpo = texto.trim()
  let a: number, m: number, d: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpo)
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(limpo)
  if (iso) [a, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  else if (br) [d, m, a] = [Number(br[1]), Number(br[2]), Number(br[3])]
  else return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const data = montarData(a, m - 1, d)
  return data === `${a}-${dois(m)}-${dois(d)}` ? data : null
}

/** Aceita 16:00, 16h, 16h30, 1630. `null` se não for uma hora válida. */
export function lerHoraDigitada(texto: string): string | null {
  const limpo = texto.trim().toLowerCase().replace(/\s/g, '')
  const r = /^(\d{1,2})(?:[:h]?(\d{2}))?h?$/.exec(limpo)
  if (!r) return null
  const h = Number(r[1])
  const mi = Number(r[2] ?? 0)
  if (h > 23 || mi > 59) return null
  return `${dois(h)}:${dois(mi)}`
}

/** Instante ISO de uma data e hora de parede no fuso (respeita horário de verão). */
export function instanteDeDataEHora(data: DataLocal, hora: string, fuso: string): string {
  return instanteNoFuso(data, hora, fuso).toISOString()
}

/** Domingo da semana da data. */
export function inicioDaSemana(data: DataLocal): DataLocal {
  return somarDias(data, -diaDaSemana(data))
}

export function inicioDoMes(data: DataLocal): DataLocal {
  return `${data.slice(0, 8)}01`
}

/** As 42 casas (6 semanas, de domingo a sábado) que cobrem o mês da data. */
export function gradeDoMes(data: DataLocal): DataLocal[] {
  const primeiro = inicioDaSemana(inicioDoMes(data))
  return Array.from({ length: 42 }, (_, i) => somarDias(primeiro, i))
}

export function nomeDoMesEAno(data: DataLocal): string {
  const [a, m] = partes(data)
  const nome = NOMES_DOS_MESES[m - 1] ?? ''
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`
}

/** Minutos inteiros entre dois instantes (b - a). */
export function minutosEntre(a: number, b: number): number {
  return Math.floor((b - a) / 60_000)
}

/** 05:07 ou 1:05:07, para cronômetros. */
export function formatarCronometro(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`
}

/** Para o leitor de tela: "5 minutos e 7 segundos". */
export function falarCronometro(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pedacos = [
    h ? `${h} ${h === 1 ? 'hora' : 'horas'}` : null,
    m ? `${m} ${m === 1 ? 'minuto' : 'minutos'}` : null,
    !h && s ? `${s} ${s === 1 ? 'segundo' : 'segundos'}` : null,
  ].filter(Boolean)
  return pedacos.length ? pedacos.join(' e ') : '0 segundos'
}
