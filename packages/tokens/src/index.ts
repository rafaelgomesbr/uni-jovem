export * from './contraste.ts'
export * from './cores.ts'

/** Escala de espaço em múltiplos de 4. */
export const ESPACO = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
} as const

export const RAIO = { pequeno: 10, medio: 14, grande: 22, pilula: 999 } as const

/** Alvo de toque mínimo (Apple HIG 44 pt; Material 48 dp: usamos 48 no Android). */
export const ALVO_MINIMO = { ios: 44, android: 48, web: 44 } as const

/**
 * Tipografia. Títulos em Bricolage Grotesque (personalidade), texto em Inter
 * (legibilidade). Tamanhos em pontos; respeitam o tamanho de fonte do sistema.
 */
export const FONTES = {
  titulo: 'BricolageGrotesque',
  texto: 'Inter',
} as const

export const TIPO = {
  tituloGrande: { tamanho: 34, altura: 38, peso: '800' },
  titulo: { tamanho: 24, altura: 28, peso: '800' },
  subtitulo: { tamanho: 18, altura: 24, peso: '600' },
  corpo: { tamanho: 16, altura: 24, peso: '400' },
  corpoForte: { tamanho: 16, altura: 24, peso: '600' },
  apoio: { tamanho: 14, altura: 20, peso: '400' },
  rotulo: { tamanho: 12, altura: 16, peso: '600' },
} as const

/** Movimento: durações curtas; com "Reduzir movimento", tudo vira 0. */
export const DURACAO = { rapida: 150, media: 250, lenta: 400 } as const
