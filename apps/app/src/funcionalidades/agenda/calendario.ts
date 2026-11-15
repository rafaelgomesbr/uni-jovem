/**
 * Contas do calendário, puras: intervalo de busca de cada modo e eventos
 * agrupados pela data local (no fuso do evento, que é o da comunidade).
 */
import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import {
  dataDoInstante,
  gradeDoMes,
  inicioDaSemana,
  instanteDeDataEHora,
  NOMES_DOS_MESES,
  nomeDoMesEAno,
  somarDias,
  somarMeses,
  type DataLocal,
} from '@/utilidades/datas'

export type ModoDaAgenda = 'mes' | 'semana' | 'lista'

/** Quantos dias a lista mostra a partir da referência. */
export const DIAS_DA_LISTA = 60

export interface Intervalo {
  /** Primeiro dia (inclusive). */
  inicio: DataLocal
  /** Dia seguinte ao último (exclusive). */
  fim: DataLocal
}

export function intervaloDoModo(modo: ModoDaAgenda, referencia: DataLocal): Intervalo {
  if (modo === 'mes') {
    const grade = gradeDoMes(referencia)
    return { inicio: grade[0]!, fim: somarDias(grade[41]!, 1) }
  }
  if (modo === 'semana') {
    const inicio = inicioDaSemana(referencia)
    return { inicio, fim: somarDias(inicio, 7) }
  }
  return { inicio: referencia, fim: somarDias(referencia, DIAS_DA_LISTA) }
}

/** Limites do intervalo como instantes, para a API (`de` e `ate`). */
export function limitesParaApi(intervalo: Intervalo, fuso: string) {
  return {
    de: instanteDeDataEHora(intervalo.inicio, '00:00', fuso),
    ate: instanteDeDataEHora(intervalo.fim, '00:00', fuso),
  }
}

/** Avança ou recua um passo do modo (um mês, uma semana, o tamanho da lista). */
export function passo(modo: ModoDaAgenda, referencia: DataLocal, sentido: 1 | -1): DataLocal {
  if (modo === 'mes') return somarMeses(referencia, sentido)
  if (modo === 'semana') return somarDias(referencia, 7 * sentido)
  return somarDias(referencia, DIAS_DA_LISTA * sentido)
}

export function agruparPorDia(
  eventos: readonly ResumoDoEvento[],
): Map<DataLocal, ResumoDoEvento[]> {
  const mapa = new Map<DataLocal, ResumoDoEvento[]>()
  for (const e of eventos) {
    const dia = dataDoInstante(e.inicio, e.fuso)
    const lista = mapa.get(dia)
    if (lista) lista.push(e)
    else mapa.set(dia, [e])
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.inicio.localeCompare(b.inicio))
  return mapa
}

export function contarEventos(n: number): string {
  if (n === 0) return 'sem eventos'
  return n === 1 ? '1 evento' : `${n} eventos`
}

/** O dia está dentro do intervalo (fim exclusivo)? */
export function noIntervalo(dia: DataLocal, intervalo: Intervalo): boolean {
  return dia >= intervalo.inicio && dia < intervalo.fim
}

function dia(data: DataLocal): number {
  return Number(data.slice(8, 10))
}

function mes(data: DataLocal): string {
  return NOMES_DOS_MESES[Number(data.slice(5, 7)) - 1] ?? ''
}

/**
 * Título da linha do período (3.3.1 a 3.3.3): "Novembro de 2026" no mês;
 * "9 a 15 de novembro" na semana e na lista ("30 de novembro a 6 de
 * dezembro" quando cruza o mês; com o ano quando cruza o ano).
 */
export function descreverPeriodo(modo: ModoDaAgenda, referencia: DataLocal): string {
  if (modo === 'mes') return nomeDoMesEAno(referencia)
  const { inicio, fim } = intervaloDoModo(modo, referencia)
  const ultimo = somarDias(fim, -1)
  if (inicio.slice(0, 4) !== ultimo.slice(0, 4)) {
    return `${dia(inicio)} de ${mes(inicio)} de ${inicio.slice(0, 4)} a ${dia(ultimo)} de ${mes(ultimo)} de ${ultimo.slice(0, 4)}`
  }
  if (inicio.slice(0, 7) !== ultimo.slice(0, 7)) {
    return `${dia(inicio)} de ${mes(inicio)} a ${dia(ultimo)} de ${mes(ultimo)}`
  }
  return `${dia(inicio)} a ${dia(ultimo)} de ${mes(ultimo)}`
}

/** O período mostrado contém hoje? Fora dele, aparece o terciário "Hoje". */
export function periodoTemHoje(modo: ModoDaAgenda, referencia: DataLocal, hoje: DataLocal) {
  if (modo === 'mes') return referencia.slice(0, 7) === hoje.slice(0, 7)
  return noIntervalo(hoje, intervaloDoModo(modo, referencia))
}

/** Rótulos dos botões de período: começam pelo que se vê ("Mês anterior", revisão M5). */
export const NOMES_DOS_PASSOS: Readonly<
  Record<ModoDaAgenda, { anterior: string; proximo: string }>
> = {
  mes: { anterior: 'Mês anterior', proximo: 'Próximo mês' },
  semana: { anterior: 'Semana anterior', proximo: 'Próxima semana' },
  lista: { anterior: 'Período anterior', proximo: 'Próximo período' },
}
