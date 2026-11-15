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

/**
 * Cor translúcida (`rgba(r,g,b,a)`) composta sobre um fundo opaco: é o que o
 * olho vê no vidro. Serve para conferir o texto sobre o vidro.
 */
export function comporCor(rgba: string, fundo: string): string {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(rgba)
  if (!m) throw new Error(`cor translúcida inválida: ${rgba}`)
  const [r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  const h = fundo.replace('#', '')
  const base = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  const canalComposto = (frente: number, i: number) =>
    Math.round(frente * a + base[i]! * (1 - a))
      .toString(16)
      .padStart(2, '0')
  return `#${canalComposto(r, 0)}${canalComposto(g, 1)}${canalComposto(b, 2)}`.toUpperCase()
}

const BRANCO = '#FFFFFF'
const QUASE_PRETO = '#12102A'

/** Branco ou quase preto, o que contrastar mais sobre `fundo` (ícone sobre a cor da comunidade). */
export function corSobre(fundo: string): string {
  return contraste(BRANCO, fundo) >= contraste(QUASE_PRETO, fundo) ? BRANCO : QUASE_PRETO
}
