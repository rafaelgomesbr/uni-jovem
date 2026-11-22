/**
 * Vários dias de uma vez no Novo encontro (D78): as regras puras do calendário de seleção múltipla,
 * dos atalhos, do resumo "3 encontros: sex 12, sáb 13, dom 14" e da hora de cada dia. Sem tela.
 */
import { MAXIMO_DE_ENCONTROS_EM_LOTE, rotuloCurtoDoDia, tituloPadraoDoEncontro } from '@uj/dominio'

import { diaDaSemana, formatarDataPorExtenso, somarDias, type DataLocal } from '@/utilidades/datas'

export { MAXIMO_DE_ENCONTROS_EM_LOTE }

export type AtalhoDeDias = 'semana' | 'fim_de_semana'

/** Os dias em ordem, sem repetir. */
export function emOrdem(dias: readonly DataLocal[]): DataLocal[] {
  return [...new Set(dias)].sort()
}

/**
 * Marca ou desmarca um dia. Passando do limite, o dia novo não entra (a tela diz por quê): quem
 * já está marcado sempre pode sair.
 */
export function alternarDia(
  dias: readonly DataLocal[],
  dia: DataLocal,
  maximo: number = MAXIMO_DE_ENCONTROS_EM_LOTE,
): DataLocal[] {
  if (dias.includes(dia)) return dias.filter((d) => d !== dia)
  if (dias.length >= maximo) return [...dias]
  return emOrdem([...dias, dia])
}

/**
 * Os dias de um atalho, a partir de hoje (nunca um dia que já passou):
 * - `semana`: de hoje até o sábado desta semana (de domingo a sábado);
 * - `fim_de_semana`: o próximo sábado e o domingo seguinte; se hoje é domingo, só o de hoje.
 */
export function diasDoAtalho(atalho: AtalhoDeDias, hoje: DataLocal): DataLocal[] {
  const dia = diaDaSemana(hoje)
  if (atalho === 'semana') {
    return Array.from({ length: 7 - dia }, (_, i) => somarDias(hoje, i))
  }
  if (dia === 0) return [hoje]
  const primeiroDia = somarDias(hoje, 6 - dia)
  return [primeiroDia, somarDias(primeiroDia, 1)]
}

/**
 * O que o app vai criar, numa frase que a pessoa confere antes de salvar:
 * "Domingo, 29 de novembro" (um dia) ou "3 encontros: sex 12, sáb 13, dom 14".
 */
export function resumoDosDias(dias: readonly DataLocal[]): string {
  if (dias.length === 0) return 'Nenhum dia escolhido.'
  if (dias.length === 1) {
    const um = formatarDataPorExtenso(dias[0]!, false)
    return `${um.charAt(0).toUpperCase()}${um.slice(1)}`
  }
  return `${dias.length} encontros: ${dias.map(rotuloCurtoDoDia).join(', ')}`
}

/** A hora de um dia: a própria, se a pessoa ajustou; senão, a de todos. */
export function horaDoDia(
  dia: DataLocal,
  horasDiferentes: Readonly<Record<string, string>>,
  horaPadrao: string,
): string {
  return horasDiferentes[dia] ?? horaPadrao
}

/** Quantos dias têm hora própria (diferente da de todos). */
export function quantosComHoraDiferente(
  dias: readonly DataLocal[],
  horasDiferentes: Readonly<Record<string, string>>,
  horaPadrao: string,
): number {
  return dias.filter((d) => horaDoDia(d, horasDiferentes, horaPadrao) !== horaPadrao).length
}

/** O título que a pessoa vê de exemplo no campo vazio: o do dia ou, em vários, o de cada um. */
export function sugestaoDeTitulo(dias: readonly DataLocal[]): string {
  if (dias.length <= 1) return tituloPadraoDoEncontro(dias[0] ?? null)
  return emOrdem(dias)
    .map((d) => tituloPadraoDoEncontro(d))
    .join(', ')
}

/** A frase de ajuda do campo de título em branco: o que acontece se a pessoa não escrever nada. */
export function ajudaDoTituloEmBranco(dias: readonly DataLocal[]): string {
  if (dias.length <= 1) return `Em branco, o título é "${sugestaoDeTitulo(dias)}".`
  return 'Em branco, cada encontro leva o nome do próprio dia.'
}
