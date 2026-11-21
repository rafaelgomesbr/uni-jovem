import { compor, ehTranslucida } from '@uj/tokens'

/**
 * A mesma cor com `alfa` de opacidade (texto desabilitado a 50%, seção
 * 2.12.1). É cor, não `opacity`: o estado fica desenhado no próprio token.
 */
export function comOpacidade(cor: string, alfa: number): string {
  if (ehTranslucida(cor)) {
    return cor.replace(
      /,\s*([\d.]+)\s*\)$/,
      (_, a: string) => `,${Math.round(Number(a) * alfa * 1000) / 1000})`,
    )
  }
  const h = cor.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return `rgba(${r},${g},${b},${alfa})`
}

/** Cor escurecida em `fracao` (destrutivo cheio pressionado: 8%). */
export function escurecer(hex: string, fracao: number): string {
  return compor(`rgba(0,0,0,${fracao})`, hex)
}

/** Alfa do texto e do ícone de um controle desabilitado. */
export const ALFA_DESABILITADO = 0.5
