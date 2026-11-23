import { describe, expect, it } from 'vitest'

import {
  ALTURA,
  contraste,
  MINIMO,
  paresObrigatorios,
  TEMAS,
  TIPO,
  type NomeDoTema,
} from '../src/index.ts'

/**
 * A hierarquia de texto (D83): o dono olhou o iPhone e disse "os textos estão muito gigantes e não
 * seguem uma hierarquia". Estes testes travam os cinco níveis (título, seção, corpo, apoio, rótulo),
 * o contraste de peso e de tamanho entre eles e o contraste AA da cor do apoio nos dois temas.
 */

const TEMAS_TODOS: readonly NomeDoTema[] = ['escuro', 'claro']

describe('escala de texto em cinco níveis (D83)', () => {
  it('título de tela de 28 a 32, em Bricolage 800', () => {
    for (const nome of ['display', 'tituloTela'] as const) {
      expect(TIPO[nome].tamanho, nome).toBeGreaterThanOrEqual(28)
      expect(TIPO[nome].tamanho, nome).toBeLessThanOrEqual(32)
      expect(TIPO[nome], nome).toMatchObject({ familia: 'titulo', peso: '800', nivel: 1 })
    }
  })

  it('título de seção de 20 a 22, em Inter 600 (semibold, não negrito pesado)', () => {
    expect(TIPO.secao.tamanho).toBeGreaterThanOrEqual(20)
    expect(TIPO.secao.tamanho).toBeLessThanOrEqual(22)
    expect(TIPO.secao).toMatchObject({ familia: 'texto', peso: '600', nivel: 2, maiusculas: false })
  })

  it('linha primária 17 em 600; corpo 16 a 17 em 400; apoio 14 a 15 em 400', () => {
    expect(TIPO.tituloItem).toMatchObject({ tamanho: 17, peso: '600', familia: 'texto' })
    expect(TIPO.corpo.tamanho).toBeGreaterThanOrEqual(16)
    expect(TIPO.corpo.tamanho).toBeLessThanOrEqual(17)
    expect(TIPO.corpo.peso).toBe('400')
    expect(TIPO.apoio.tamanho).toBeGreaterThanOrEqual(14)
    expect(TIPO.apoio.tamanho).toBeLessThanOrEqual(15)
    expect(TIPO.apoio.peso).toBe('400')
  })

  it('rótulo pequeno em caixa-alta com espaço entre letras (sobrancelha), abaixo do corpo', () => {
    expect(TIPO.sobrancelha.maiusculas).toBe(true)
    expect(TIPO.sobrancelha.espacamento).toBeGreaterThanOrEqual(0.5)
    expect(TIPO.sobrancelha.tamanho).toBeLessThan(TIPO.corpo.tamanho)
    expect(TIPO.sobrancelha.peso).toBe('600')
  })

  it('o tamanho desce degrau a degrau: título, seção, linha primária, corpo, apoio', () => {
    const escada = [TIPO.tituloTela, TIPO.secao, TIPO.tituloItem, TIPO.corpo, TIPO.apoio].map(
      (p) => p.tamanho,
    )
    for (let i = 1; i < escada.length; i += 1) {
      expect(escada[i - 1], `degrau ${i}`).toBeGreaterThan(escada[i] as number)
    }
    // O título de tela é pelo menos 1,6 vez o corpo: a diferença se vê sem precisar de cor.
    expect(TIPO.tituloTela.tamanho / TIPO.corpo.tamanho).toBeGreaterThanOrEqual(1.6)
  })

  it('o peso também separa os níveis: 800 nos títulos, 600 na seção e na linha primária, 400 no resto', () => {
    expect(TIPO.display.peso).toBe('800')
    expect(TIPO.secao.peso).toBe('600')
    expect(TIPO.tituloItem.peso).toBe('600')
    expect(TIPO.corpo.peso).toBe('400')
    expect(TIPO.apoio.peso).toBe('400')
    expect(TIPO.meta.peso).toBe('400')
    expect(TIPO.legenda.peso).toBe('400')
  })

  it('a linha secundária da lista é menor que a primária e no mínimo 2 pt (a vista separa)', () => {
    expect(TIPO.tituloItem.tamanho - TIPO.apoio.tamanho).toBeGreaterThanOrEqual(2)
  })

  it('o chip e o rótulo em caixa-alta não passam do apoio (a etiqueta nunca compete com o título)', () => {
    expect(TIPO.chip.tamanho).toBeLessThanOrEqual(TIPO.apoio.tamanho)
    expect(TIPO.sobrancelha.tamanho).toBeLessThanOrEqual(TIPO.apoio.tamanho)
    expect(ALTURA.chip).toBeGreaterThanOrEqual(TIPO.chip.altura + 8)
  })

  it('toda altura de linha é par e a entrelinha cabe: de 1,2 a 1,6 vez o corpo do texto', () => {
    for (const nome of ['secao', 'tituloItem', 'corpo', 'apoio', 'sobrancelha', 'chip'] as const) {
      const p = TIPO[nome]
      expect(p.altura % 2, nome).toBe(0)
      expect(p.altura / p.tamanho, nome).toBeGreaterThanOrEqual(1.2)
      expect(p.altura / p.tamanho, nome).toBeLessThanOrEqual(1.6)
    }
  })

  it('o título com teto curto, no teto, ainda mede mais que o corpo no teto de 2', () => {
    for (const nome of ['display', 'tituloTela', 'tituloMomento', 'tituloCartao'] as const) {
      const p = TIPO[nome]
      expect(p.teto, nome).toBe(1.5)
      expect(p.tamanho * 1.5, nome).toBeGreaterThan(TIPO.corpo.tamanho * 2)
    }
  })

  it('o apoio e a sobrancelha crescem com a fonte do sistema até 2 (30 pt no apoio)', () => {
    expect(TIPO.apoio.teto).toBe(2)
    expect(TIPO.apoio.tamanho * 2).toBe(30)
    expect(TIPO.sobrancelha.teto).toBe(2)
  })

  it('retrato dos papéis (D83): tamanho, entrelinha e peso de cada um', () => {
    const retrato = Object.fromEntries(
      Object.entries(TIPO).map(([nome, p]) => [nome, `${p.tamanho}/${p.altura} ${p.peso}`]),
    )
    expect(retrato).toEqual({
      display: '30/34 800',
      tituloTela: '28/32 800',
      tituloCartao: '22/26 800',
      tituloMomento: '24/28 800',
      secao: '20/26 600',
      numero: '28/32 800',
      contador: '40/40 800',
      codigo: '20/24 800',
      cronometro: '64/68 800',
      leitura: '17/26 400',
      tituloItem: '17/22 600',
      corpo: '16/24 400',
      botao: '16/20 600',
      campo: '16/22 400',
      lista: '16/22 400',
      rotulo: '16/22 600',
      meta: '16/22 400',
      apoio: '15/20 400',
      legenda: '16/22 400',
      sobrancelha: '14/18 600',
      chip: '14/18 600',
      aba: '13/16 500',
    })
  })
})

describe('contraste AA da cor do apoio (textoSuave) nos dois temas (D83)', () => {
  for (const tema of TEMAS_TODOS) {
    const base = TEMAS[tema].base

    it(`tema ${tema}: o apoio é mais suave que o texto e ainda passa 4,5:1 no fundo e na superfície`, () => {
      expect(contraste(base.textoSuave, base.fundo)).toBeGreaterThanOrEqual(MINIMO.texto)
      expect(contraste(base.textoSuave, base.superficie)).toBeGreaterThanOrEqual(MINIMO.texto)
      // "Mais suave": o texto principal tem contraste maior que o do apoio sobre o mesmo fundo.
      expect(contraste(base.texto, base.fundo)).toBeGreaterThan(
        contraste(base.textoSuave, base.fundo),
      )
    })

    it(`tema ${tema}: todo par da tabela que usa textoSuave como frente passa o mínimo de texto`, () => {
      const pares = paresObrigatorios(tema).filter((p) => p.frente === base.textoSuave)
      // Fundo, superfície, cartão sobre os picos da Aurora, momento, chip neutro, segmento, toast...
      expect(pares.length).toBeGreaterThanOrEqual(15)
      const falhas = pares
        .map((p) => ({ nome: p.nome, razao: Number(contraste(p.frente, p.fundo).toFixed(2)) }))
        .filter((p) => p.razao < MINIMO.texto)
        .map((p) => `${p.nome}: ${p.razao}`)
      expect(falhas).toEqual([])
    })

    it(`tema ${tema}: o apoio de 15 pt passa com folga (7:1 ou mais) sobre o fundo e a superfície`, () => {
      // O apoio é menor que 16: pede folga além do AA de 4,5, para não depender do olho jovem.
      expect(contraste(base.textoSuave, base.fundo)).toBeGreaterThanOrEqual(7)
      expect(contraste(base.textoSuave, base.superficie)).toBeGreaterThanOrEqual(7)
    })
  }
})
