/**
 * Contas puras de "vários encontros no mesmo dia" (D79), sem tela: o agrupamento por DIA da Agenda,
 * o cabeçalho do dia e o aviso discreto de encontros ao mesmo tempo ou muito próximos. A mesma
 * conta serve ao bloco "Hoje: 3 encontros" do Início.
 */
import { dataDoInstante, formatarHora, somarDias, type DataLocal } from '@/utilidades/datas'

import { dataCurtaDoDia } from './semanas'

/** Até quantos minutos entre o fim de um e o começo do outro para dizer "logo depois". */
export const MINUTOS_DE_PROXIMIDADE = 30

export interface GrupoDoDia<T> {
  /** AAAA-MM-DD no fuso do encontro. */
  dia: DataLocal
  itens: T[]
}

type ComHorario = { inicio: string; fuso: string }

/**
 * Agrupa por dia (no fuso de cada encontro) e ordena os dias e, dentro de cada dia, os encontros
 * por horário. `decrescente` serve aos encontros passados (o mais recente primeiro). Dia vazio
 * não existe. Empate de horário: o id decide, para a ordem nunca mudar de uma abertura para outra.
 */
export function agruparEncontrosPorDia<T extends ComHorario & { id?: string }>(
  eventos: readonly T[],
  decrescente = false,
): GrupoDoDia<T>[] {
  const porDia = new Map<DataLocal, T[]>()
  for (const e of eventos) {
    const dia = dataDoInstante(e.inicio, e.fuso)
    porDia.set(dia, [...(porDia.get(dia) ?? []), e])
  }
  const sinal = decrescente ? -1 : 1
  const poHorario = (a: T, b: T) =>
    sinal * (Date.parse(a.inicio) - Date.parse(b.inicio)) ||
    String(a.id ?? '').localeCompare(String(b.id ?? ''))
  return [...porDia.entries()]
    .sort(([a], [b]) => sinal * a.localeCompare(b))
    .map(([dia, itens]) => ({ dia, itens: [...itens].sort(poHorario) }))
}

/**
 * O cabeçalho do dia: "Dom., 29 de nov." e, depois, o que ajuda a se achar: "Hoje", "Amanhã" e,
 * havendo mais de um, "3 encontros". Com um só encontro e um dia distante, só a data.
 */
export function cabecalhoDoDia(dia: DataLocal, hoje: DataLocal, quantos: number): string {
  const proximidade = dia === hoje ? 'Hoje' : dia === somarDias(hoje, 1) ? 'Amanhã' : null
  const quantidade = quantos > 1 ? `${quantos} encontros` : null
  return [dataCurtaDoDia(dia), proximidade, quantidade].filter(Boolean).join(' · ')
}

export interface EncontroNoTempo {
  id: string
  titulo: string
  inicio: string
  fuso: string
  duracaoMin: number
}

const MINUTO = 60_000

function nomeComHora(e: EncontroNoTempo): string {
  return `${e.titulo} (${formatarHora(e.inicio, e.fuso)})`
}

/**
 * O aviso discreto de um encontro em relação aos outros do MESMO dia: "Ao mesmo tempo que Culto
 * (16:00)" quando os horários se sobrepõem, "Logo depois de Café (09:00)" quando começa até 30 min
 * depois do fim de outro. Sempre com a hora do outro: dois encontros com o mesmo título no mesmo dia
 * se distinguem por ela. Devolve `null` quando nada se encosta.
 */
export function avisoDeHorario(
  encontro: EncontroNoTempo,
  doMesmoDia: readonly EncontroNoTempo[],
): string | null {
  const inicio = Date.parse(encontro.inicio)
  const fim = inicio + encontro.duracaoMin * MINUTO
  const outros = doMesmoDia.filter((o) => o.id !== encontro.id)
  const junto = outros.filter((o) => {
    const oInicio = Date.parse(o.inicio)
    const oFim = oInicio + o.duracaoMin * MINUTO
    return inicio < oFim && oInicio < fim
  })
  if (junto.length > 0) {
    return `Ao mesmo tempo que ${junto.map(nomeComHora).join(' e ')}`
  }
  const logoAntes = outros
    .filter((o) => {
      const oFim = Date.parse(o.inicio) + o.duracaoMin * MINUTO
      return oFim <= inicio && inicio - oFim <= MINUTOS_DE_PROXIMIDADE * MINUTO
    })
    .sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio))
  const anterior = logoAntes[0]
  return anterior ? `Logo depois de ${nomeComHora(anterior)}` : null
}
