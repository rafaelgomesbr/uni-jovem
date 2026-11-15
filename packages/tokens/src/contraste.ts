/**
 * Contraste WCAG 2.2 (fórmula de luminância relativa). Usado pelo teste que
 * garante AA em todos os pares de cor que o design system declara.
 */

function canal(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminancia(hex: string): number {
  const h = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`cor inválida: ${hex}`)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Mínimos WCAG: texto normal 4,5:1; texto grande e elementos de interface 3:1. */
export const MINIMO = { texto: 4.5, textoGrande: 3, interface: 3 } as const

const RGBA = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/

/** A cor é `rgba(...)` (translúcida)? Hex é sempre opaco. */
export function ehTranslucida(cor: string): boolean {
  return RGBA.test(cor)
}

/**
 * Cor translúcida (`rgba(r,g,b,a)`) composta sobre um fundo opaco (hex): é o
 * que o olho vê. Cor opaca (hex) volta como está. Serve para medir texto
 * sobre o vidro, sobre a Aurora e sobre os fundos tonais.
 */
export function compor(cor: string, hexDeBaixo: string): string {
  const m = RGBA.exec(cor)
  if (!m) {
    luminancia(cor)
    return cor.toUpperCase()
  }
  const [r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  const h = hexDeBaixo.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`fundo precisa ser opaco: ${hexDeBaixo}`)
  const base = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  const canalComposto = (frente: number, i: number) =>
    Math.round(frente * a + base[i]! * (1 - a))
      .toString(16)
      .padStart(2, '0')
  return `#${canalComposto(r, 0)}${canalComposto(g, 1)}${canalComposto(b, 2)}`.toUpperCase()
}

/** Compõe as camadas de baixo para cima; a primeira precisa ser opaca. */
export function comporCamadas(camadas: readonly string[]): string {
  const [primeira, ...resto] = camadas
  if (!primeira || ehTranslucida(primeira)) throw new Error('a camada de baixo precisa ser opaca')
  return resto.reduce((baixo, cima) => compor(cima, baixo), compor(primeira, primeira))
}

/** Mesma cor com o alfa multiplicado por `fator` (`rgba` só; hex volta igual). */
export function comAlfa(cor: string, fator: number): string {
  const m = RGBA.exec(cor)
  if (!m) return cor
  const alfa = Math.round(Number(m[4]) * fator * 10000) / 10000
  return `rgba(${m[1]},${m[2]},${m[3]},${alfa})`
}

const BRANCO = '#FFFFFF'
const QUASE_PRETO = '#12102A'

/** Branco ou quase preto, o que contrastar mais sobre `fundo` (ícone sobre uma cor qualquer). */
export function corSobre(fundo: string): string {
  return contraste(BRANCO, fundo) >= contraste(QUASE_PRETO, fundo) ? BRANCO : QUASE_PRETO
}
