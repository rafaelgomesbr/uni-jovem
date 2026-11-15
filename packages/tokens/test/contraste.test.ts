import { describe, expect, it } from 'vitest'

import {
  ALFA_DA_AURORA_SOB_CARTOES,
  CLARO,
  DESTAQUE_NO_CLARO,
  DESTAQUE_NO_ESCURO,
  PARES_TRANSLUCIDOS,
  type Paleta,
  comporCor,
  contraste,
  CORES_DA_COMUNIDADE,
  corSobre,
  ESCURO,
  FUNDOS_SOB_O_VIDRO,
  MINIMO,
  PARES_OBRIGATORIOS,
  TEXTOS_SOBRE_O_VIDRO,
} from '../src/index.ts'

describe('contraste WCAG', () => {
  it('fórmula confere com valores conhecidos', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contraste('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2)
  })

  it('composição do vidro: opaco não muda, transparente vira o fundo', () => {
    expect(comporCor('rgba(18,16,42,1)', '#FFFFFF')).toBe('#12102A')
    expect(comporCor('rgba(18,16,42,0)', '#FFFFFF')).toBe('#FFFFFF')
    expect(comporCor('rgba(0,0,0,0.5)', '#FFFFFF')).toBe('#808080')
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

    it(`tema ${nome}: texto sobre o vidro passa AA em qualquer superfície por baixo`, () => {
      const falhas = FUNDOS_SOB_O_VIDRO.flatMap((baixo) => {
        const vidro = comporCor(paleta.vidroFundo, paleta[baixo])
        return TEXTOS_SOBRE_O_VIDRO.map((frente) => ({
          par: `${frente} sobre vidro sobre ${baixo}`,
          razao: Number(contraste(paleta[frente], vidro).toFixed(2)),
        }))
      }).filter((p) => p.razao < MINIMO.texto)
      expect(falhas).toEqual([])
    })
  }

  /** `rgba(...)` ou hex opaco composto sobre `base` (hex). */
  function opaca(cor: string, base: string): string {
    return cor.startsWith('rgba') ? comporCor(cor, base) : cor
  }

  /** Mesma cor com o alfa multiplicado (a aurora longe do centro). */
  function comAlfa(rgba: string, fator: number): string {
    return rgba.replace(/,\s*([\d.]+)\s*\)$/, (_, a: string) => `,${Number(a) * fator})`)
  }

  for (const [nome, paleta] of [
    ['escuro', ESCURO],
    ['claro', CLARO],
    ['cartão de destaque no escuro', DESTAQUE_NO_ESCURO],
    ['cartão de destaque no claro', DESTAQUE_NO_CLARO],
  ] as const) {
    it(`${nome}: pares sobre superfícies translúcidas passam AA`, () => {
      const falhas = PARES_TRANSLUCIDOS.map(({ frente, fundo, base, tipo }) => {
        const baseOpaca = opaca(paleta[base], paleta.fundo)
        const atras = opaca(paleta[fundo], baseOpaca)
        return {
          par: `${frente} sobre ${fundo} sobre ${base}`,
          razao: Number(contraste(paleta[frente], atras).toFixed(2)),
          minimo: MINIMO[tipo],
        }
      }).filter((p) => p.razao < p.minimo)
      expect(falhas).toEqual([])
    })
  }

  for (const [nome, paleta] of [
    ['escuro', ESCURO],
    ['claro', CLARO],
  ] as const) {
    it(`${nome}: botão primário e texto do cartão de destaque passam AA`, () => {
      const destaque: Paleta = nome === 'escuro' ? DESTAQUE_NO_ESCURO : DESTAQUE_NO_CLARO
      expect(contraste(paleta.sobrePrimaria, paleta.primaria)).toBeGreaterThanOrEqual(MINIMO.texto)
      for (const k of ['texto', 'textoSuave', 'destaque'] as const) {
        expect(contraste(destaque[k], destaque.fundo)).toBeGreaterThanOrEqual(MINIMO.texto)
      }
    })

    it(`${nome}: cabeçalho sobre o pico da aurora coral e cartões sobre as auroras passam AA`, () => {
      const picoCoral = comporCor(paleta.auroraCoral, paleta.fundo)
      // Cabeçalho (texto e marca de sincronizado) fica bem no pico da coral.
      expect(contraste(paleta.texto, picoCoral)).toBeGreaterThanOrEqual(MINIMO.texto)
      expect(contraste(paleta.sucesso, picoCoral)).toBeGreaterThanOrEqual(MINIMO.interface)
      // Cartões: violeta no pico; coral já atenuada onde o primeiro cartão começa.
      const sobCartoes = [
        comporCor(paleta.auroraVioleta, paleta.fundo),
        comporCor(comAlfa(paleta.auroraCoral, ALFA_DA_AURORA_SOB_CARTOES), paleta.fundo),
      ]
      const falhas = sobCartoes
        .flatMap((atras) => {
          const cartao = comporCor(paleta.cartaoVidro, atras)
          return (['texto', 'textoSuave', 'destaque', 'sucesso'] as const).map((k) => ({
            par: `${k} sobre cartão sobre ${atras}`,
            razao: Number(contraste(paleta[k], cartao).toFixed(2)),
          }))
        })
        .filter((p) => p.razao < MINIMO.texto)
      expect(falhas).toEqual([])
    })
  }

  it('ícone sobre a cor de cada comunidade passa 3:1 (elemento de interface)', () => {
    // Inclui a cor da comunidade de demonstração da homologação.
    const cores = [...CORES_DA_COMUNIDADE.map((c) => c.valor), '#9D8FFF']
    const falhas = cores
      .map((cor) => ({ cor, razao: Number(contraste(corSobre(cor), cor).toFixed(2)) }))
      .filter((c) => c.razao < MINIMO.interface)
    expect(falhas).toEqual([])
  })
})
