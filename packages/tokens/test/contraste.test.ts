import { describe, expect, it } from 'vitest'

import {
  alfaDaAurora,
  AURORA,
  centroDoBrilho,
  CLARO,
  comAlfa,
  compor,
  comporCamadas,
  contraste,
  CORES_DA_COMUNIDADE,
  corDaAuroraNoPonto,
  corSobre,
  ESCURO,
  INICIAIS_SOBRE_COR,
  MINIMO,
  paresObrigatorios,
  PONTOS_CRITICOS_DA_AURORA,
  TEMAS,
  type NomeDoTema,
} from '../src/index.ts'

const TEMAS_TODOS: readonly NomeDoTema[] = ['escuro', 'claro']

describe('contraste WCAG', () => {
  it('fórmula confere com valores conhecidos', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contraste('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2)
  })

  it('compor: opaco não muda, transparente vira o fundo, meio a meio dá o meio', () => {
    expect(compor('rgba(18,16,42,1)', '#FFFFFF')).toBe('#12102A')
    expect(compor('rgba(18,16,42,0)', '#FFFFFF')).toBe('#FFFFFF')
    expect(compor('rgba(0,0,0,0.5)', '#FFFFFF')).toBe('#808080')
    expect(compor('#ABCDEF', '#000000')).toBe('#ABCDEF')
    expect(() => compor('rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)')).toThrow()
  })

  it('o cartão translúcido do mockup sobre o fundo é a superfície opaca (#1F1B44)', () => {
    expect(compor(ESCURO.superficieTranslucida, ESCURO.fundo)).toBe(ESCURO.superficie)
  })

  it('comporCamadas exige a camada de baixo opaca', () => {
    expect(comporCamadas(['#FFFFFF', 'rgba(0,0,0,0.5)'])).toBe('#808080')
    expect(() => comporCamadas(['rgba(0,0,0,0.5)'])).toThrow()
  })

  it('comAlfa multiplica o alfa (e deixa o hex igual)', () => {
    expect(comAlfa('rgba(1,2,3,0.5)', 0.6)).toBe('rgba(1,2,3,0.3)')
    expect(comAlfa('#123456', 0.6)).toBe('#123456')
  })

  for (const tema of TEMAS_TODOS) {
    it(`tema ${tema}: todos os pares obrigatórios da tabela 2.11 passam`, () => {
      const falhas = paresObrigatorios(tema)
        .map((p) => ({ ...p, razao: Number(contraste(p.frente, p.fundo).toFixed(2)) }))
        .filter((p) => p.razao < p.minimo)
        .map((p) => `${p.nome}: ${p.razao} (mínimo ${p.minimo})`)
      expect(falhas).toEqual([])
    })

    it(`tema ${tema}: a tabela cobre pelo menos 50 pares, sem nome repetido`, () => {
      const nomes = paresObrigatorios(tema).map((p) => p.nome)
      expect(nomes.length).toBeGreaterThanOrEqual(50)
      expect(new Set(nomes).size).toBe(nomes.length)
    })

    it(`tema ${tema}: as paletas base e inversa têm só cores válidas`, () => {
      for (const paleta of [TEMAS[tema].base, TEMAS[tema].inverso]) {
        const invalidas = Object.entries(paleta).filter(([, cor]) => {
          try {
            compor(cor, '#000000')
            return false
          } catch {
            return true
          }
        })
        expect(invalidas).toEqual([])
      }
    })
  }

  it('o escuro cobre também o cartão translúcido sobre os dois brilhos (D32)', () => {
    const nomes = paresObrigatorios('escuro').map((p) => p.nome)
    expect(nomes.filter((n) => n.startsWith('cartão translúcido')).length).toBe(14)
  })

  it('valores-chave do mockup não mudaram sem querer', () => {
    expect(ESCURO.fundo).toBe('#12102A')
    expect(ESCURO.texto).toBe('#F5F3FF')
    expect(ESCURO.textoSuave).toBe('#C9C4EC')
    expect(ESCURO.destaque).toBe('#FFB199')
    expect(ESCURO.primaria).toBe('#FF8A65')
    expect(ESCURO.sobrePrimaria).toBe('#1A0F0A')
    expect(TEMAS.escuro.inverso.fundo).toBe('#F5F3FF')
    expect(TEMAS.escuro.inverso.quenteFundo).toBe('#FFE3D9')
    expect(TEMAS.escuro.inverso.destaque).toBe('#8A2E12')
    expect(CLARO.fundo).toBe('#F7F5FF')
    expect(TEMAS.claro.inverso.fundo).toBe('#1F1B4D')
  })

  it('iniciais brancas passam 4,5:1 sobre as 6 cores de comunidade', () => {
    const falhas = CORES_DA_COMUNIDADE.map((c) => ({
      cor: c.rotulo,
      razao: Number(contraste(INICIAIS_SOBRE_COR, c.valor).toFixed(2)),
    })).filter((c) => c.razao < MINIMO.texto)
    expect(falhas).toEqual([])
  })

  it('ícone sobre a cor de cada comunidade passa 3:1 (inclui a cor da demonstração)', () => {
    const cores = [...CORES_DA_COMUNIDADE.map((c) => c.valor), '#9D8FFF']
    const falhas = cores
      .map((cor) => ({ cor, razao: Number(contraste(corSobre(cor), cor).toFixed(2)) }))
      .filter((c) => c.razao < MINIMO.interface)
    expect(falhas).toEqual([])
  })
})

describe('Aurora', () => {
  it('centros no quadro de referência (coral deslocada 20 e 20 do mockup)', () => {
    expect(centroDoBrilho('coral')).toEqual({ x: 340, y: 30 })
    expect(centroDoBrilho('violeta')).toEqual({ x: 20, y: 300 })
  })

  it('o degradê vai do pico no centro a zero em 70% do canto mais distante (CSS)', () => {
    expect(alfaDaAurora('coral', centroDoBrilho('coral'), 'escuro')).toBeCloseTo(0.55, 5)
    const fim = AURORA.paradaFinal * (AURORA.coral.lado / 2) * Math.SQRT2
    expect(alfaDaAurora('coral', { x: 340, y: 30 + fim - 0.001 }, 'escuro')).toBeCloseTo(0, 3)
    // Fora do círculo (o raio de borda corta o brilho), zero.
    expect(alfaDaAurora('coral', { x: 340, y: 30 + 200 }, 'escuro')).toBe(0)
    // Pilha: 60% da opacidade.
    expect(alfaDaAurora('violeta', centroDoBrilho('violeta'), 'escuro', 0.6)).toBeCloseTo(0.27, 5)
  })

  it('o status fica fora do miolo da coral (alfa abaixo de 0,45 no pior ponto)', () => {
    expect(alfaDaAurora('coral', PONTOS_CRITICOS_DA_AURORA.status, 'escuro')).toBeLessThan(0.45)
    expect(corDaAuroraNoPonto('coral', PONTOS_CRITICOS_DA_AURORA.status, 'escuro')).toMatch(
      /^rgba\(255,138,101,0\.\d+\)$/,
    )
  })
})
