import { dataDoInstante, formatarHora, fusoDoAparelho } from '@/utilidades/datas'

import type { OperacaoNaFila } from './tipos'

/**
 * Horas da sincronização no fuso do APARELHO (é a hora em que a pessoa
 * baixou ou enviou, não a do encontro). Sempre absolutas.
 */
export function horaNoAparelho(iso: string): string {
  return formatarHora(iso, fusoDoAparelho())
}

/** 28/11 */
export function diaEMesNoAparelho(iso: string): string {
  const [, m, d] = dataDoInstante(iso, fusoDoAparelho()).split('-')
  return `${d}/${m}`
}

/** 28/11 às 14:32 */
export function quandoNoAparelho(iso: string): string {
  return `${diaEMesNoAparelho(iso)} às ${horaNoAparelho(iso)}`
}

/** "Pronto para usar sem internet · atualizado às 14:32 · válido até 28/11" */
export function textoDoPreparo(baixadoEm: string, validoAte: string): string {
  return `Pronto para usar sem internet · atualizado às ${horaNoAparelho(baixadoEm)} · válido até ${diaEMesNoAparelho(validoAte)}`
}

export function contar(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`
}

/** Selo de cada tipo de operação ainda no aparelho. */
export function seloDaOperacao(op: OperacaoNaFila): string {
  switch (op.tipo) {
    case 'ao_vivo.proposta':
      return 'Só neste aparelho'
    case 'inscricao.intencao':
      return 'Pendente: vaga não garantida'
    default:
      return 'Aguardando envio'
  }
}
