import { describe, expect, it } from 'vitest'

import {
  AURORA,
  CASCATA_DE_ABERTURA,
  contraste,
  ENTRADA_CURTA,
  fimDaCascataDeAbertura,
  MARCA_DO_GOOGLE_ESCURO,
  MINIMO,
  MOVIMENTO_DE_ACESSO,
  paresObrigatorios,
  RITMO_DE_ACESSO,
  type NomeDoTema,
} from '../src/index.ts'

const TEMAS_TODOS: readonly NomeDoTema[] = ['escuro', 'claro']

describe('contraste da tela de acesso (D63)', () => {
  for (const tema of TEMAS_TODOS) {
    it(`tema ${tema}: texto a 4,5:1 e componentes a 3:1 nos pares de acesso`, () => {
      const pares = paresObrigatorios(tema).filter((p) => p.nome.startsWith('acesso: '))
      expect(pares.length).toBeGreaterThanOrEqual(9)
      const falhas = pares
        .map((p) => ({ ...p, razao: Number(contraste(p.frente, p.fundo).toFixed(2)) }))
        .filter((p) => p.razao < p.minimo)
        .map((p) => `${p.nome}: ${p.razao} (mínimo ${p.minimo})`)
      expect(falhas).toEqual([])
    })

    it(`tema ${tema}: todo par de texto de acesso exige 4,5 e todo de componente exige 3`, () => {
      for (const p of paresObrigatorios(tema).filter((x) => x.nome.startsWith('acesso: '))) {
        expect([MINIMO.texto, MINIMO.interface]).toContain(p.minimo)
      }
    })
  }

  it('o Google escuro (secundário do tema escuro) passa nos dois mínimos', () => {
    expect(contraste(MARCA_DO_GOOGLE_ESCURO.texto, MARCA_DO_GOOGLE_ESCURO.fundo)).toBeGreaterThan(
      MINIMO.texto,
    )
    expect(contraste(MARCA_DO_GOOGLE_ESCURO.borda, '#12102A')).toBeGreaterThan(MINIMO.interface)
  })
})

describe('movimento da tela de acesso (D63)', () => {
  it('a cascata de abertura termina em 780 ms, abaixo do limite de 900', () => {
    expect(fimDaCascataDeAbertura()).toBe(780)
    expect(fimDaCascataDeAbertura()).toBeLessThan(900)
  })

  it('os botões entram de 50 em 50 ms', () => {
    const { botao1, botao2, botao3, rodape1, rodape2 } = CASCATA_DE_ABERTURA
    expect(botao2.atraso - botao1.atraso).toBe(50)
    expect(botao3.atraso - botao2.atraso).toBe(50)
    expect(rodape2.atraso - rodape1.atraso).toBe(50)
  })

  it('a entrada curta cabe em 470 ms e o painel de e-mail em 280 ms', () => {
    expect(ENTRADA_CURTA.duracao + ENTRADA_CURTA.passo * 7).toBeLessThanOrEqual(
      ENTRADA_CURTA.maximo,
    )
    expect(MOVIMENTO_DE_ACESSO.painelIda).toBe(280)
    expect(MOVIMENTO_DE_ACESSO.painelVolta).toBeLessThan(MOVIMENTO_DE_ACESSO.painelIda)
  })

  it('o balanço do erro soma 260 ms (campo) e 240 ms (botão)', () => {
    const soma = (e: readonly { duracao: number }[]) => e.reduce((t, x) => t + x.duracao, 0)
    expect(soma(MOVIMENTO_DE_ACESSO.balancoDoCampo.etapas)).toBe(260)
    expect(soma(MOVIMENTO_DE_ACESSO.balancoDoBotao.etapas)).toBe(240)
  })

  it('a deriva da aurora para sozinha: 84 s o coral e 108 s o violeta, no máximo', () => {
    const { coral, violeta } = AURORA.deriva
    expect(coral.meioCiclo * coral.meiasVoltas).toBe(84_000)
    expect(violeta.meioCiclo * violeta.meiasVoltas).toBe(108_000)
    // Os dois períodos não se alinham, então a composição quase nunca se repete.
    expect(coral.meioCiclo).not.toBe(violeta.meioCiclo)
  })

  it('a deriva nunca passa do pico medido: a opacidade só desce e o coral se afasta do cabeçalho', () => {
    expect(AURORA.deriva.coral.opacidade).toBeLessThanOrEqual(1)
    expect(AURORA.deriva.violeta.opacidade).toBeLessThanOrEqual(1)
    // Coral: para a esquerda e para baixo (longe do status no canto superior direito).
    expect(AURORA.deriva.coral.x).toBeLessThan(0)
    expect(AURORA.deriva.coral.y).toBeGreaterThan(0)
  })
})

describe('ritmo da tela de acesso', () => {
  it('todo intervalo é múltiplo de 4, e a fenda de erro de 26 é a única exceção (6 mais 20)', () => {
    const { fendaDeErro, fatorDoRespiroDeCima, ...intervalos } = RITMO_DE_ACESSO
    for (const valor of Object.values(intervalos)) expect(valor % 4).toBe(0)
    expect(fendaDeErro).toBe(26)
    expect(fatorDoRespiroDeCima).toBe(0.4)
  })
})
