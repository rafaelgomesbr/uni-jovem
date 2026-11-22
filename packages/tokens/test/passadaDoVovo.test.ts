import { describe, expect, it } from 'vitest'

import { ALTURA, ALVO_MINIMO, TIPO, type NomeDoPapel } from '../src/index.ts'

/**
 * A passada do vovô (D75): o dono testou o app e disse que idosos vão usar. Estas são as medidas
 * que impedem a volta do texto miúdo, do teto de escala curto e do alvo de toque apertado.
 */

/** Papéis que não são texto corrido de informação: títulos grandes, números, cifra e o cronômetro. */
const TITULOS: readonly NomeDoPapel[] = [
  'display',
  'tituloTela',
  'tituloCartao',
  'tituloMomento',
  'numero',
  'contador',
  'codigo',
  'cronometro',
]

/** O único papel abaixo de 16, por exceção escrita no token (rótulo da barra de abas). */
const EXCECOES_DE_TAMANHO: readonly NomeDoPapel[] = ['aba']

/** O cronômetro do Ao vivo já nasce em 64: crescer até 2 estouraria a tela de um celular. */
const EXCECOES_DE_TETO: readonly NomeDoPapel[] = ['cronometro']

const NOMES = Object.keys(TIPO) as NomeDoPapel[]

describe('passada do vovô: tamanhos de letra (D75)', () => {
  it('nenhum texto que informa fica abaixo de 16 pt (só a aba, por exceção declarada)', () => {
    const abaixo = NOMES.filter(
      (n) => !TITULOS.includes(n) && !EXCECOES_DE_TAMANHO.includes(n) && TIPO[n].tamanho < 16,
    ).map((n) => `${n}: ${TIPO[n].tamanho}`)
    expect(abaixo).toEqual([])
  })

  it('chips, legendas, listas, metas, rótulos e sobrancelhas têm 16 pt', () => {
    for (const nome of ['chip', 'legenda', 'lista', 'meta', 'rotulo', 'sobrancelha'] as const) {
      expect(TIPO[nome].tamanho, nome).toBeGreaterThanOrEqual(16)
    }
  })

  it('a aba é o único menor que 16 e não passa de 13 para baixo', () => {
    expect(TIPO.aba.tamanho).toBeGreaterThanOrEqual(13)
  })

  it('a altura de linha do texto que informa nunca é mais apertada que 1,2 vez', () => {
    for (const nome of ['chip', 'legenda', 'lista', 'meta', 'rotulo'] as const) {
      expect(TIPO[nome].altura / TIPO[nome].tamanho, nome).toBeGreaterThanOrEqual(1.2)
    }
  })
})

describe('passada do vovô: teto da escala de fonte do sistema (D75)', () => {
  it('nenhum papel limita o crescimento abaixo de 2 (o cronômetro do Ao vivo é a exceção)', () => {
    const baixos = NOMES.filter(
      (n) => !EXCECOES_DE_TETO.includes(n) && TIPO[n].teto !== null && TIPO[n].teto < 2,
    ).map((n) => `${n}: ${TIPO[n].teto}`)
    expect(baixos).toEqual([])
  })

  it('display, chip, sobrancelha, aba e título de tela crescem até 2', () => {
    for (const nome of ['display', 'chip', 'sobrancelha', 'aba', 'tituloTela'] as const) {
      expect(TIPO[nome].teto, nome).toBe(2)
    }
  })
})

describe('passada do vovô: alvos de toque (D75)', () => {
  it('o alvo mínimo é 48 em toda plataforma', () => {
    expect(ALVO_MINIMO).toEqual({ ios: 48, android: 48, web: 48 })
  })

  it('botão em qualquer tamanho, botão só de ícone, pílula e item de aba têm 48 ou mais', () => {
    expect(Math.min(...Object.values(ALTURA.botao))).toBeGreaterThanOrEqual(48)
    expect(ALTURA.iconeSo).toBeGreaterThanOrEqual(48)
    expect(ALTURA.pilula).toBeGreaterThanOrEqual(48)
    expect(ALTURA.aba).toBeGreaterThanOrEqual(48)
    expect(ALTURA.filtro).toBeGreaterThanOrEqual(48)
    expect(ALTURA.linha).toBeGreaterThanOrEqual(56)
  })

  it('o chip comporta o texto de 16 com 4 de folga em cima e embaixo', () => {
    expect(ALTURA.chip).toBeGreaterThanOrEqual(TIPO.chip.altura + 8)
  })
})
