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
