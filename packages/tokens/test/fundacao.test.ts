/**
 * D65 e D67: a fundação da direção A "Aurora Viva". Valores da especificação
 * (`docs/design/v3/a/especificacao.md`) e do protótipo, com os pares de contraste novos
 * medidos nos dois temas (4,5:1 para texto, 3:1 para componente).
 */
import { describe, expect, it } from 'vitest'

import {
  ALTURA,
  BARRA_DE_ABAS,
  CLARO,
  compor,
  comporCamadas,
  contraste,
  CURVAS,
  DESFAZER,
  DESLIZAR,
  ELEVACAO,
  ESCURO,
  LUZ_POR_MOMENTO,
  MINIMO,
  MOMENTOS_EM_ORDEM,
  MOVIMENTO_DAS_TELAS,
  paresObrigatorios,
  POSE_DO_MOMENTO,
  POSES_DO_SOL,
  POSES_DO_SOL_EM_ORDEM,
  RAIO,
  SOL_POENTE,
  TEMAS,
  TIPO,
  TOAST,
  VIDRO,
  type NomeDoTema,
} from '../src/index.ts'

const TEMAS_TODOS: readonly NomeDoTema[] = ['escuro', 'claro']

function medir(tema: NomeDoTema, nome: string) {
  const par = paresObrigatorios(tema).find((p) => p.nome === nome)
  if (!par) throw new Error(`par inexistente: ${nome}`)
  return { ...par, razao: contraste(par.frente, par.fundo) }
}

describe('cores novas da direção A (seções 2.1 e 2.2 da especificação)', () => {
  it('escuro: a tinta, o momento, os fundos revelados, o toast e o vidro', () => {
    expect(ESCURO).toMatchObject({
      superficie: '#1F1B44',
      superficieTranslucida: 'rgba(38,33,82,0.64)',
      superficieElevada: '#262250',
      realceDoCartao: 'rgba(255,255,255,0.06)',
      momentoTopo: '#342C6E',
      momentoBase: '#221D4E',
      momentoBorda1: '#FF8A65',
      momentoBorda2: '#9D8FFF',
      momentoBorda3: '#5B4BDB',
      aceitarFundo: '#17513B',
      recusarFundo: '#432D4F',
      toastFundo: '#2E2A66',
      vidroCabecalho: 'rgba(18,16,42,0.78)',
      brilhoHorizonte: 'rgba(255,160,110,0.40)',
      brilhoPoente: 'rgba(214,80,150,0.38)',
      botaoTonalPressionado: 'rgba(179,168,255,0.26)',
      botaoTonalOpaco: '#373262',
      palco: '#07061A',
      fundoProfundo: '#0C0A20',
    })
  })

  it('claro: o par fiel (sem realce de topo, cartão a 80%, toast índigo)', () => {
    expect(CLARO).toMatchObject({
      superficie: '#FFFFFF',
      superficieTranslucida: 'rgba(255,255,255,0.80)',
      superficieBorda: 'rgba(27,24,56,0.09)',
      realceDoCartao: 'rgba(255,255,255,0)',
      momentoTopo: '#FFFFFF',
      momentoBase: '#F1ECFF',
      momentoBorda1: '#C2491F',
      momentoBorda2: '#7C6CFF',
      momentoBorda3: '#4B3FC4',
      aceitarFundo: '#E3F4EA',
      recusarFundo: '#FDE4E1',
      toastFundo: '#1F1B4D',
      brilhoHorizonte: 'rgba(255,170,120,0.30)',
      brilhoPoente: 'rgba(214,80,150,0.20)',
      botaoTonalPressionado: 'rgba(75,63,196,0.20)',
      fundoProfundo: '#EFEBFF',
    })
  })

  it('o cartão translúcido sobre o fundo escuro é a superfície opaca (o fallback não muda a cor)', () => {
    expect(compor(ESCURO.superficieTranslucida, ESCURO.fundo)).toBe(ESCURO.superficie)
  })

  it('os inversos herdam os campos novos (nenhum token novo fica indefinido)', () => {
    for (const tema of TEMAS_TODOS) {
      for (const paleta of [TEMAS[tema].base, TEMAS[tema].inverso]) {
        expect(paleta.momentoTopo).toMatch(/^#/)
        expect(paleta.toastFundo).toMatch(/^#/)
        expect(paleta.aceitarFundo).toMatch(/^#/)
      }
    }
  })

  it('vidro: barra a 24, cabeçalho a 20, folha a 30, com o fallback opaco de cada um', () => {
    expect(VIDRO.barra.desfoque).toBe(24)
    expect(VIDRO.cabecalho.desfoque).toBe(20)
    expect(VIDRO.folha.desfoque).toBe(30)
    expect(VIDRO.barra.escuro).toMatchObject({ fundo: 'rgba(24,21,58,0.78)', opaco: '#1B1840' })
    expect(VIDRO.barra.claro).toMatchObject({ fundo: 'rgba(255,255,255,0.82)', opaco: '#FFFFFF' })
    expect(VIDRO.folha.escuro).toMatchObject({ fundo: 'rgba(38,34,80,0.92)', opaco: '#262250' })
    expect(VIDRO.folha.claro).toMatchObject({ fundo: 'rgba(255,255,255,0.94)', opaco: '#FFFFFF' })
    expect(VIDRO.cabecalho.claro.opaco).toBe(CLARO.fundo)
    expect(VIDRO.cabecalho.escuro.opaco).toBe(ESCURO.fundo)
  })

  it('toast: sempre escuro com texto claro, "Desfazer" em #FFB199', () => {
    expect(TOAST).toEqual({ texto: '#F5F3FF', textoSuave: '#C9C4EC', acao: '#FFB199' })
  })
})

describe('formas, tipografia e medidas', () => {
  it('raios: miolo do momento é 28 menos a moldura de 1,5; barra de abas é cápsula de 68', () => {
    expect(RAIO.barra - 1.5).toBe(RAIO.miolo)
    expect(RAIO.medio).toBe(RAIO.abaAtiva)
    expect(BARRA_DE_ABAS.altura).toBe(68)
    expect(RAIO.barraFlutuante).toBe(BARRA_DE_ABAS.altura / 2)
    expect(ALTURA.linhaAlta).toBe(72)
  })

  it('tipografia (D83): corpo 16/24, título do momento 24/28, contador 40/40 tabular', () => {
    expect(TIPO.corpo).toMatchObject({ tamanho: 16, altura: 24 })
    expect(TIPO.tituloMomento).toMatchObject({ tamanho: 24, altura: 28, peso: '800' })
    expect(TIPO.contador).toMatchObject({ tamanho: 40, altura: 40, tabular: true })
    expect(TIPO.tituloCartao).toMatchObject({ tamanho: 22, altura: 26 })
  })

  it('sombra do momento: queda funda mais brilho coral no escuro, índigo no claro', () => {
    expect(ELEVACAO.escuro.momento).toContain('rgba(255,138,101,0.38)')
    expect(ELEVACAO.claro.momento).toContain('rgba(75,63,196,0.30)')
    expect(ELEVACAO.claro.cartao).toBe(
      '0px 1px 2px rgba(27,24,56,0.06), 0px 8px 20px rgba(27,24,56,0.07)',
    )
  })
})

describe('movimento (seção 9 da especificação)', () => {
  it('curvas novas: nasce e a da pílula', () => {
    expect(CURVAS.nasce).toEqual([0.16, 1, 0.3, 1])
    expect(CURVAS.pilula).toEqual([0.34, 1.3, 0.5, 1])
  })

  it('a cascata de entrada termina em 350 ms: 5 passos de 30 mais 200', () => {
    const { cascata } = MOVIMENTO_DAS_TELAS
    expect(cascata.maximo * cascata.passo + cascata.duracao).toBe(350)
    expect(cascata.deslocamento).toBe(12)
  })

  it('durações: aba 160 e 120, pílula 260, pilha 350 e 300, folha 340 e 240, toast 200 e 160', () => {
    const m = MOVIMENTO_DAS_TELAS
    expect([m.abaDissolve, m.abaDissolveSai, m.pilulaDaAba]).toEqual([160, 120, 260])
    expect([m.pilhaIda, m.pilhaVolta, m.folhaIda, m.folhaVolta]).toEqual([350, 300, 340, 240])
    expect([m.toast.entra, m.toast.sai, m.luz, m.sol.pose, m.sol.passoDoRaio]).toEqual([
      200, 160, 900, 600, 40,
    ])
    expect(m.dissolver).toBe(120)
    expect(m.esqueleto).toMatchObject({ pulso: 1200, opacidadeMinima: 0.5, aparece: 160 })
  })

  it('Desfazer: 5 s (WCAG 2.2.1) e o anúncio fala os segundos', () => {
    expect(DESFAZER.segundos).toBe(5)
    expect(MOVIMENTO_DAS_TELAS.toast.contagem).toBe(DESFAZER.segundos * 1000)
    expect(DESFAZER.anuncio(5)).toBe('Desfazer disponível por 5 segundos')
  })

  it('deslizar: aceita além de 40%, revela além de 20%, nunca passa de 55% e 38%', () => {
    expect(DESLIZAR.limiarParaAceitar).toBe(0.4)
    expect(DESLIZAR.limiarParaRevelar).toBe(0.2)
    expect(DESLIZAR.maximoParaDireita).toBe(0.55)
    expect(DESLIZAR.maximoParaEsquerda).toBe(0.38)
    expect(DESLIZAR.aberturaDaEsquerda).toBe(0.34)
  })
})

describe('as cinco poses do sol e a luz de cada momento (seção 7)', () => {
  it('são cinco, na ordem: antes do amanhecer, nascendo, pleno, radiante, poente', () => {
    expect(POSES_DO_SOL_EM_ORDEM).toEqual(['escondido', 'nascendo', 'pleno', 'radiante', 'poente'])
    expect(Object.keys(POSES_DO_SOL)).toHaveLength(5)
  })

  it('a tabela da seção 7: translação do corpo, raios, halo e barras', () => {
    expect(POSES_DO_SOL.escondido).toMatchObject({
      corpoY: 215,
      raios: { opacidade: 0, escala: 0.55 },
      halo: { opacidade: 0.35 },
    })
    expect(POSES_DO_SOL.nascendo).toMatchObject({
      corpoY: 108,
      raios: { opacidade: 0, escala: 0.7 },
    })
    expect(POSES_DO_SOL.pleno).toMatchObject({ corpoY: 0, raios: { opacidade: 1, escala: 1 } })
    expect(POSES_DO_SOL.radiante).toMatchObject({
      raios: { escala: 1.14 },
      halo: { opacidade: 1, escala: 1.15 },
    })
    expect(POSES_DO_SOL.poente).toMatchObject({
      corpoY: 62,
      raios: { opacidade: 0.55, escala: 0.78 },
      barra1: 0.55,
      poente: true,
    })
    expect(SOL_POENTE.escuro.corpoBase).toBe('#D4508A')
    expect(SOL_POENTE.claro.corpoTopo).toBe('#D9650C')
  })

  it('cada momento tem uma pose, e o relógio sobe a luz de base até "agora" e a desce no "fim"', () => {
    expect(MOMENTOS_EM_ORDEM.map((m) => POSE_DO_MOMENTO[m])).toEqual([
      'escondido',
      'nascendo',
      'pleno',
      'radiante',
      'poente',
    ])
    const horizonte = MOMENTOS_EM_ORDEM.map((m) => LUZ_POR_MOMENTO[m].horizonte.opacidade)
    expect(horizonte).toEqual([0.3, 0.45, 0.65, 0.95, 0.15])
    expect(LUZ_POR_MOMENTO.agora.horizonte.y).toBe(-26)
    expect(LUZ_POR_MOMENTO.agora.coral.escala).toBe(1.12)
    expect(LUZ_POR_MOMENTO.fim.poente.opacidade).toBe(0.95)
    expect(LUZ_POR_MOMENTO.longe.poente.opacidade).toBe(0)
  })
})

describe('contraste dos pares da fundação (D65), nos dois temas', () => {
  for (const tema of TEMAS_TODOS) {
    it(`${tema}: todos os pares "D65" passam (4,5:1 texto, 3:1 componente)`, () => {
      const pares = paresObrigatorios(tema).filter((p) => p.nome.startsWith('D65'))
      expect(pares.length).toBeGreaterThanOrEqual(40)
      const falhas = pares
        .map((p) => ({ ...p, razao: Number(contraste(p.frente, p.fundo).toFixed(2)) }))
        .filter((p) => p.razao < p.minimo)
        .map((p) => `${p.nome}: ${p.razao} (mínimo ${p.minimo})`)
      expect(falhas).toEqual([])
    })
  }

  it('escuro: textoSuave nu sobre o brilho do horizonte no pico tem 4,5:1 ou mais (a margem curta)', () => {
    const par = medir('escuro', 'D65: textoSuave nu sobre o horizonte no pico')
    expect(par.razao).toBeGreaterThanOrEqual(MINIMO.texto)
    // Margem curta de propósito: se este número cair, baixe `brilhoHorizonte` de 0,40 para 0,34.
    expect(par.razao).toBeLessThan(4.8)
  })

  it('escuro: texto no cartão sobre o pico do coral (a tinta mais o realce)', () => {
    expect(medir('escuro', 'D65: texto no cartão sobre o pico coral').razao).toBeGreaterThan(8)
    expect(medir('escuro', 'D65: textoSuave no cartão sobre o pico coral').razao).toBeGreaterThan(
      5.2,
    )
  })

  it('o momento: texto sobre momentoTopo passa com folga nos dois temas', () => {
    expect(medir('escuro', 'D65: texto sobre momentoTopo').razao).toBeGreaterThan(11)
    expect(medir('claro', 'D65: textoSuave sobre momentoBase').razao).toBeGreaterThan(7)
  })

  it('"Desfazer" no toast: 7,3:1 no escuro e 9,0:1 no claro', () => {
    expect(medir('escuro', 'D65: Desfazer no toast').razao).toBeCloseTo(7.32, 1)
    expect(medir('claro', 'D65: Desfazer no toast').razao).toBeCloseTo(9.07, 1)
  })

  it('o preenchimento da barra de progresso contra o trilho passa 3:1', () => {
    expect(
      medir('escuro', 'D65: interface: progresso: primaria contra o trilho').razao,
    ).toBeGreaterThan(3)
    expect(
      medir('claro', 'D65: interface: progresso: primaria contra o trilho').razao,
    ).toBeGreaterThan(3)
  })

  it('o fundo do deslizar leva texto legível sobre o aceitar e o recusar', () => {
    for (const tema of TEMAS_TODOS) {
      expect(medir(tema, 'D65: texto sobre aceitarFundo').razao).toBeGreaterThanOrEqual(4.5)
      expect(medir(tema, 'D65: erro sobre recusarFundo').razao).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('a aba no escuro sobre o cartão do momento (o mais claro que passa por baixo da barra)', () => {
    const embaixo = compor(ESCURO.momentoTopo, ESCURO.fundo)
    const barra = comporCamadas([embaixo, VIDRO.barra.escuro.fundo])
    expect(contraste(ESCURO.textoSuave, barra)).toBeGreaterThanOrEqual(MINIMO.texto)
  })
})
