import { DESLIZAR } from '@uj/tokens'

/**
 * A matemática do deslizar para responder, pura e marcada como `worklet` para rodar no
 * segmento de interface sem ir ao JavaScript a cada quadro. Os números vêm de `DESLIZAR`.
 */

export type DecisaoDoDeslize = 'aceitar' | 'revelar' | 'voltar'

/**
 * O dedo não leva a linha além de 55% da largura para a direita nem de 38% para a esquerda:
 * o fundo revelado precisa continuar legível e o gesto, discreto.
 */
export function limitarArrasto(deslocamento: number, largura: number): number {
  'worklet'
  return Math.max(
    -largura * DESLIZAR.maximoParaEsquerda,
    Math.min(largura * DESLIZAR.maximoParaDireita, deslocamento),
  )
}

/**
 * O que fazer ao soltar. Direita além de 40% da largura: aceita. Esquerda além de 20%: abre
 * o "Não posso ir" (revela, nunca envia: recusar é mais caro de errar que aceitar). Fora
 * disso, volta ao repouso. `deslocamento` é a posição da linha, não só o arrasto desta vez.
 */
export function decisaoDoDeslize(deslocamento: number, largura: number): DecisaoDoDeslize {
  'worklet'
  if (deslocamento > largura * DESLIZAR.limiarParaAceitar) return 'aceitar'
  if (deslocamento < -largura * DESLIZAR.limiarParaRevelar) return 'revelar'
  return 'voltar'
}

/** Onde a linha descansa em cada decisão (aceitar sai com 110% da largura). */
export function repousoDaDecisao(decisao: DecisaoDoDeslize, largura: number): number {
  'worklet'
  if (decisao === 'aceitar') return largura * DESLIZAR.saida
  if (decisao === 'revelar') return -largura * DESLIZAR.aberturaDaEsquerda
  return 0
}
