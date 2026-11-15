import { ALTURA, ESPACO } from '@uj/tokens'

/**
 * Medidas do quadro 06 (Agenda, mês) e da linha do tempo (3.3.4), copiadas
 * do quadro aprovado. Vivem aqui com nome, e não soltas no estilo, porque
 * são desenho do calendário e da linha do tempo: nenhum componente de
 * `src/ui` as tem.
 */
export const CALENDARIO = {
  /** Altura da célula do dia (grade de 7 colunas iguais). */
  celula: ALTURA.controle,
  /** Círculo do número; o de hoje é cheio em `primaria`. */
  circulo: 32,
  /** Selecionado: círculo maior com anel de 2 em `texto` (sinal de forma). */
  circuloEscolhido: 36,
  anel: 2,
  /** Dos pontos (ou do dia da semana) até o número. */
  abaixoDoNumero: 2,
  /** Pontos de evento: até 3, de 4, com 3 entre eles. */
  ponto: ESPACO.e4,
  entrePontos: 3,
  maximoDePontos: 3,
  /** Semana: célula de 44 × 64 com o dia da semana, o número e os pontos. */
  larguraDaSemana: 44,
  alturaDaSemana: 64,
} as const

/**
 * Altura dos esqueletos da grade, para a tela não pular quando os dados
 * chegam: padding de 18 em cima e embaixo, o cabeçalho dos dias (16 + 8) e
 * 6 semanas de 48 no mês; uma faixa de 64 na semana.
 */
export const ESQUELETO_DA_GRADE = {
  mes: 18 * 2 + 16 + ESPACO.e8 + 6 * CALENDARIO.celula,
  semana: 18 * 2 + CALENDARIO.alturaDaSemana,
} as const

/** Nó da linha do tempo (3.3.4): 12, com trilho vertical de 2. */
export const LINHA_DO_TEMPO = {
  no: ESPACO.e12,
  trilho: 2,
  /** Concluída: check de 8 dentro do nó cheio. */
  check: ESPACO.e8,
  /** Atual: anel de 2 e miolo. */
  anelAtual: 2,
  miolo: ESPACO.e4,
  /** Próxima: anel de 1,5. */
  anelProximo: 1.5,
} as const
