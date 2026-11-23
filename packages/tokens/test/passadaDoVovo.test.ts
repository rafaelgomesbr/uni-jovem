import { describe, expect, it } from 'vitest'

import { ALTURA, ALVO_MINIMO, TIPO, type NomeDoPapel } from '../src/index.ts'

/**
 * A passada do vovô (D75) e o seu ajuste de hierarquia (D83). O dono testou o app e disse que idosos
 * vão usar (D75: tudo em 16 ou mais) e depois que "parece só tudo muito grande" (D83: o que a pessoa
 * precisa LER segue em 16 ou mais; só o apoio, o rótulo e o chip descem, com contraste medido).
 */

/** Papéis que não são texto corrido de informação: títulos grandes, números, cifra e o cronômetro. */
const TITULOS: readonly NomeDoPapel[] = [
  'display',
  'tituloTela',
  'tituloCartao',
  'tituloMomento',
  'secao',
  'numero',
  'contador',
  'codigo',
  'cronometro',
]

/** Títulos cujo teto de escala foi reduzido na D83 (o tamanho já nasce grande). */
const TITULOS_COM_TETO_CURTO: readonly NomeDoPapel[] = [
  'display',
  'tituloTela',
  'tituloCartao',
  'tituloMomento',
  'secao',
]

/**
 * Os únicos papéis de texto abaixo de 16, cada um com o piso escrito aqui (D75 e D83): a aba (13,
 * rótulo que ajuda o ícone), o apoio (15, metadado de uma linha primária de 17), o rótulo em caixa-alta
 * e o chip (14, etiquetas curtas). Texto de erro, motivo, aviso, botão e corpo não entram aqui.
 */
const PISO_DOS_MENORES: Readonly<Partial<Record<NomeDoPapel, number>>> = {
  aba: 13,
  apoio: 15,
  sobrancelha: 14,
  chip: 14,
}

/** O cronômetro do Ao vivo já nasce em 64: crescer até 2 estouraria a tela de um celular. */
const EXCECOES_DE_TETO: readonly NomeDoPapel[] = ['cronometro']

const NOMES = Object.keys(TIPO) as NomeDoPapel[]

describe('hierarquia e tamanhos de letra (D75 e D83)', () => {
  it('nenhum texto que informa fica abaixo de 16 pt, salvo os quatro papéis menores com piso escrito', () => {
    const abaixo = NOMES.filter(
      (n) => !TITULOS.includes(n) && !(n in PISO_DOS_MENORES) && TIPO[n].tamanho < 16,
    ).map((n) => `${n}: ${TIPO[n].tamanho}`)
    expect(abaixo).toEqual([])
  })

  it('os papéis menores respeitam o piso escrito e só eles são menores que 16', () => {
    for (const [nome, piso] of Object.entries(PISO_DOS_MENORES) as [NomeDoPapel, number][]) {
      expect(TIPO[nome].tamanho, nome).toBeGreaterThanOrEqual(piso)
      expect(TIPO[nome].tamanho, nome).toBeLessThan(16)
    }
    const menores = NOMES.filter((n) => TIPO[n].tamanho < 16 && !TITULOS.includes(n)).sort()
    expect(menores).toEqual(['aba', 'apoio', 'chip', 'sobrancelha'])
  })

  it('o texto que se lê para agir (erro, motivo, aviso, corpo, botão, campo) tem 16 pt ou mais', () => {
    for (const nome of ['corpo', 'meta', 'legenda', 'lista', 'rotulo', 'botao', 'campo'] as const) {
      expect(TIPO[nome].tamanho, nome).toBeGreaterThanOrEqual(16)
    }
  })

  it('a altura de linha do texto que informa nunca é mais apertada que 1,2 vez', () => {
    const papeis: readonly NomeDoPapel[] = [
      'chip',
      'legenda',
      'lista',
      'meta',
      'rotulo',
      'apoio',
      'tituloItem',
    ]
    for (const nome of papeis) {
      expect(TIPO[nome].altura / TIPO[nome].tamanho, nome).toBeGreaterThanOrEqual(1.2)
    }
  })
})

describe('teto da escala de fonte do sistema (D75 e D83)', () => {
  it('o texto que informa cresce até 2 ou sem teto (o cronômetro do Ao vivo e os títulos grandes são a exceção)', () => {
    const baixos = NOMES.filter(
      (n) =>
        !EXCECOES_DE_TETO.includes(n) &&
        !TITULOS_COM_TETO_CURTO.includes(n) &&
        TIPO[n].teto !== null &&
        TIPO[n].teto < 2,
    ).map((n) => `${n}: ${TIPO[n].teto}`)
    expect(baixos).toEqual([])
  })

  it('chip, sobrancelha, apoio, botão e aba crescem até 2', () => {
    for (const nome of ['chip', 'sobrancelha', 'apoio', 'botao', 'aba'] as const) {
      expect(TIPO[nome].teto, nome).toBe(2)
    }
  })

  it('o título com teto curto ainda fica pelo menos duas vezes o corpo no teto máximo de leitura', () => {
    // 2 vezes o corpo de 16 = 32: nenhum título, no seu teto, fica menor que isso.
    for (const nome of TITULOS_COM_TETO_CURTO) {
      const teto = TIPO[nome].teto ?? 0
      expect(TIPO[nome].tamanho * teto, nome).toBeGreaterThanOrEqual(2 * 16)
    }
  })
})

describe('alvos de toque (D75)', () => {
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

  it('o chip comporta o texto de 14 com 4 de folga em cima e embaixo', () => {
    expect(ALTURA.chip).toBeGreaterThanOrEqual(TIPO.chip.altura + 8)
  })
})
