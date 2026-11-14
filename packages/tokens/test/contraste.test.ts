import { describe, expect, it } from 'vitest'
import { CLARO, contraste, ESCURO, MINIMO, PARES_OBRIGATORIOS } from '../src/index.ts'

describe('contraste WCAG', () => {
  it('fórmula confere com valores conhecidos', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contraste('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2)
  })

  for (const [nome, paleta] of [
    ['escuro', ESCURO],
    ['claro', CLARO],
  ] as const) {
    it(`tema ${nome}: todos os pares obrigatórios passam AA`, () => {
      const falhas = PARES_OBRIGATORIOS.map(([frente, fundo, tipo]) => ({
        par: `${frente} sobre ${fundo}`,
        razao: Number(contraste(paleta[frente], paleta[fundo]).toFixed(2)),
        minimo: MINIMO[tipo],
      })).filter((p) => p.razao < p.minimo)
      expect(falhas).toEqual([])
    })
  }
})
