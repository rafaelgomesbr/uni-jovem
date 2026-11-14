/**
 * Conteúdo fixo do app: o plano de versículos diários (D2).
 *
 * Fonte: Bíblia Livre (BLIVRE), licença Creative Commons Atribuição 4.0 Brasil.
 * A licença exige o crédito abaixo onde o versículo aparece (tela "Sobre a
 * tradução") e aviso se o texto for alterado; o texto aqui é citado sem
 * alteração (ver scripts/conteudo/gerar_versiculos.py).
 */
import type { Versiculo } from './tipos.ts'
import { VERSICULOS } from './versiculos.ts'

export type { Versiculo } from './tipos.ts'
export { VERSICULOS } from './versiculos.ts'

export const ATRIBUICAO = {
  traducao: 'Bíblia Livre (BLIVRE)',
  autores: 'Diego Santos, Mario Sérgio e Marco Teles',
  versao: 'fevereiro de 2018',
  licenca: 'Creative Commons Atribuição 4.0 Brasil',
  linkDaLicenca: 'https://creativecommons.org/licenses/by/4.0/deed.pt_BR',
  linkDaTraducao: 'https://sites.google.com/site/biblialivre/',
  texto:
    'Todas as Escrituras citadas são da Bíblia Livre (BLIVRE), Copyright © Diego Santos, ' +
    'Mario Sérgio e Marco Teles, fevereiro de 2018. Licença Creative Commons Atribuição 4.0 Brasil. ' +
    'Texto citado sem alteração.',
} as const

/** Dia do ano (1 a 366) na data local informada. */
export function diaDoAno(data: Date): number {
  const inicio = new Date(data.getFullYear(), 0, 1)
  const ms =
    new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime() - inicio.getTime()
  return Math.round(ms / 86_400_000) + 1
}

/**
 * Versículo do dia: o mesmo para todo mundo na mesma data local, e nunca
 * depende de comunidade (versículo é preferência da conta, VER-02).
 */
export function versiculoDoDia(data: Date): Versiculo {
  return VERSICULOS[(diaDoAno(data) - 1) % VERSICULOS.length]!
}

/**
 * Os próximos `quantidade` dias a partir de `inicio`, para o agendamento
 * local de notificações (o aparelho agenda vários de uma vez e funciona offline).
 */
export function proximosVersiculos(
  inicio: Date,
  quantidade: number,
): { data: Date; versiculo: Versiculo }[] {
  const lista: { data: Date; versiculo: Versiculo }[] = []
  for (let i = 0; i < quantidade; i++) {
    const data = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
    lista.push({ data, versiculo: versiculoDoDia(data) })
  }
  return lista
}
