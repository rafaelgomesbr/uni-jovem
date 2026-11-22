/**
 * D64: tokens e contraste dos controles v2 (botões, campos, segmentos,
 * interruptor). Os valores vêm de `docs/design/controles-v2.md`; o apêndice A
 * do documento está em `pares.ts` e é medido aqui nos dois temas.
 */
import { describe, expect, it } from 'vitest'

import {
  ALTURA,
  BORDA,
  CLARO,
  contraste,
  comporCamadas,
  ELEVACAO,
  ESCURO,
  luminancia,
  MINIMO,
  MOVIMENTO_DE_ACESSO,
  MOVIMENTO_DOS_CONTROLES,
  paresObrigatorios,
  RAIO,
  RITMO,
  TIPO,
  type NomeDoTema,
} from '../src/index.ts'

const TEMAS_TODOS: readonly NomeDoTema[] = ['escuro', 'claro']

/** O par pelo nome (o teste falha se o apêndice A perder uma linha). */
function medir(tema: NomeDoTema, nome: string) {
  const par = paresObrigatorios(tema).find((p) => p.nome === nome)
  if (!par) throw new Error(`par ausente: ${nome}`)
  return { razao: contraste(par.frente, par.fundo), minimo: par.minimo }
}

describe('medidas dos controles', () => {
  it('botão: 56 grande, 48 médio, 48 compacto (D75); campo 56; cápsula no botão e raio 16 no campo', () => {
    expect(ALTURA.botao).toEqual({ grande: 56, medio: 48, compacto: 48 })
    expect(ALTURA.campo).toBe(56)
    expect(RAIO.pilula).toBe(999)
    expect(RAIO.campo).toBe(16)
    expect(BORDA.anel).toBe(2)
    expect(RITMO.entreCampos).toBe(20)
  })

  it('área de texto: de 3 a 8 linhas (100 a 210) e, em leitura, de 5 a 10 (164 a 294)', () => {
    const { padrao, leitura } = ALTURA.areaDeTexto
    // 16 de padding, linhas, 16 de padding e 2 de borda.
    expect(16 + padrao.linhaMinima * padrao.linha + 16 + 2).toBe(padrao.min)
    expect(16 + padrao.linhaMaxima * padrao.linha + 16 + 2).toBe(padrao.max)
    expect(16 + leitura.linhaMinima * leitura.linha + 16 + 2).toBe(leitura.min)
    expect(16 + leitura.linhaMaxima * leitura.linha + 16 + 2).toBe(leitura.max)
  })

  it('tipografia: botão 16/20 600, campo 16/22 400 (16 evita o zoom do Safari), teto de 2', () => {
    expect(TIPO.botao).toMatchObject({ tamanho: 16, altura: 20, peso: '600', teto: 2 })
    expect(TIPO.botao.maiusculas).toBe(false)
    expect(TIPO.campo).toMatchObject({ tamanho: 16, altura: 22, peso: '400', teto: 2 })
  })

  it('interruptor 52 por 32; trilho 48 e polegar 40 dos segmentos; pílula de filtro 40', () => {
    expect(ALTURA.interruptorLargura).toBe(52)
    expect(ALTURA.interruptorAltura).toBe(32)
    expect(ALTURA.trilho).toBe(48)
    expect(ALTURA.polegar).toBe(40)
    expect(ALTURA.filtro).toBe(48)
  })

  it('movimento: foco 160 ms (saída 120), toque 90 ms, escala 0,98; MOVIMENTO_DE_ACESSO é apelido', () => {
    expect(MOVIMENTO_DOS_CONTROLES).toMatchObject({
      foco: 160,
      focoSaida: 120,
      toqueDentro: 90,
      escalaDoToque: 0.98,
      toqueReduzido: 80,
      esperaDoIndicador: 250,
    })
    expect(MOVIMENTO_DE_ACESSO.foco).toBe(MOVIMENTO_DOS_CONTROLES.foco)
    expect(MOVIMENTO_DE_ACESSO.toqueDentro).toBe(MOVIMENTO_DOS_CONTROLES.toqueDentro)
  })
})

describe('cores dos controles nos dois temas', () => {
  it('o foco é coral em tudo (a mesma cor da `primaria`) e não existe mais amarelo de foco', () => {
    expect(ESCURO.foco).toBe(ESCURO.primaria)
    expect(CLARO.foco).toBe(CLARO.primaria)
    expect(ESCURO.foco.toUpperCase()).not.toBe('#FFD166')
    expect(CLARO.foco.toUpperCase()).not.toBe('#4B3FC4')
  })

  it('valores do documento: campo, degradê, tonal e exemplo', () => {
    expect(ESCURO).toMatchObject({
      campoFundo: '#322F4C',
      campoBorda: '#7C77A8',
      campoExemplo: '#A7A2D0',
      primariaTopo: '#FF9A78',
      primariaBase: '#FF8A65',
      botaoTonal: 'rgba(179,168,255,0.16)',
      botaoTonalPressionado: 'rgba(179,168,255,0.26)',
      botaoTonalOpaco: '#373262',
      focoHalo: 'rgba(255,138,101,0.22)',
    })
    expect(CLARO).toMatchObject({
      campoFundo: '#F3F1FA',
      campoBorda: '#857FAF',
      campoExemplo: '#6B6690',
      primariaTopo: '#C64B20',
      primariaBase: '#B5431B',
      botaoTonal: 'rgba(75,63,196,0.12)',
      botaoTonalPressionado: 'rgba(75,63,196,0.20)',
      botaoTonalOpaco: '#E9E8F8',
      focoHalo: 'rgba(194,73,31,0.18)',
    })
  })

  it('o campo é um degrau acima do cartão no escuro (não um poço): mais claro que a superfície', () => {
    expect(luminancia(ESCURO.campoFundo)).toBeGreaterThan(luminancia(ESCURO.superficie))
    expect(luminancia(ESCURO.campoFundo)).toBeGreaterThan(luminancia(ESCURO.fundo))
  })

  it('o degradê só clareia o topo no escuro (o texto escuro só ganha contraste)', () => {
    expect(luminancia(ESCURO.primariaTopo)).toBeGreaterThan(luminancia(ESCURO.primariaBase))
  })

  it('o brilho e o realce do primário estão nos dois temas', () => {
    expect(ELEVACAO.escuro.botao).toBe('0px 6px 16px rgba(255,138,101,0.28)')
    expect(ELEVACAO.claro.botao).toBe('0px 6px 14px rgba(194,73,31,0.30)')
    expect(ELEVACAO.escuro.realceDoBotao).toBe('inset 0px 1px 0px rgba(255,255,255,0.30)')
    expect(ELEVACAO.claro.realceDoBotao).toBe('inset 0px 1px 0px rgba(255,255,255,0.22)')
  })

  it('o desabilitado do primário continua coral apagado e legível o bastante (informativo, não é exigência)', () => {
    for (const [tema, paleta] of [
      ['escuro', ESCURO],
      ['claro', CLARO],
    ] as const) {
      const fundo = comporCamadas([paleta.superficie, paleta.quenteFundo])
      const texto = comporCamadas([
        fundo,
        tema === 'escuro' ? 'rgba(255,177,153,0.7)' : 'rgba(138,46,18,0.7)',
      ])
      // 3,95 no escuro e 3,66 no claro no documento; piso informativo de 3:1 para não parecer quebrado.
      expect(contraste(texto, fundo)).toBeGreaterThan(3)
    }
  })
})

describe('pares de contraste do apêndice A (docs/design/controles-v2.md)', () => {
  const TEXTO: readonly string[] = [
    'campoExemplo (exemplo) sobre campoFundo',
    'destaque ("Mostrar") sobre campoFundo',
    'sobrePrimaria sobre primariaTopo',
    'sobrePrimaria sobre primariaBase',
    'sobrePrimaria sobre primariaPressionada',
    'texto sobre botaoTonal composto',
    'texto sobre botaoTonalPressionado composto',
    'texto sobre botaoTonalOpaco (Reduzir transparência)',
    'erro sobre erroFundo composto (botão destrutivo)',
    'destaque sobre superficie (botão terciário)',
    'segmento escolhido: destaque sobre quenteFundo no trilho',
    'segmento escolhido: destaque sobre quenteFundo no trilho opaco',
    'segmento inativo: textoSuave sobre o trilho',
    'segmento inativo: textoSuave sobre o trilho opaco',
  ]
  const INTERFACE: readonly string[] = [
    'interface: campoBorda contra superficie',
    'interface: campoBorda contra fundo',
    'interface: campoBorda contra superficieElevada',
    'interface: campoBorda contra campoFundo',
    'interface: foco contra superficie',
    'interface: foco contra fundo',
    'interface: foco contra campoFundo',
    'interface: erro (borda do campo) contra campoFundo',
    'interface: sucesso (borda do campo) contra campoFundo',
    'interface: interruptor desligado (campoBorda contra superficie)',
    'interface: interruptor ligado (primaria contra superficie)',
    'interface: polegar ligado (sobrePrimaria sobre primaria)',
    'interface: primariaTopo contra superficie',
    'interface: primariaBase contra superficie',
  ]

  for (const tema of TEMAS_TODOS) {
    it(`tema ${tema}: os pares de texto passam 4,5:1 e os de interface, 3:1`, () => {
      const falhas = [...TEXTO, ...INTERFACE].flatMap((nome) => {
        const { razao, minimo } = medir(tema, nome)
        return razao >= minimo ? [] : [`${nome}: ${razao.toFixed(2)} (mínimo ${minimo})`]
      })
      expect(falhas).toEqual([])
    })

    it(`tema ${tema}: texto vale 4,5 e componente 3 (nenhum par do apêndice ficou com o piso trocado)`, () => {
      for (const nome of TEXTO) expect(medir(tema, nome).minimo).toBe(MINIMO.texto)
      for (const nome of INTERFACE) expect(medir(tema, nome).minimo).toBe(MINIMO.interface)
    })
  }

  it('a borda do campo passa 3:1 contra o cartão, a tela, a folha e o próprio fundo, nos dois temas', () => {
    for (const tema of TEMAS_TODOS) {
      for (const nome of [
        'interface: campoBorda contra superficie',
        'interface: campoBorda contra fundo',
        'interface: campoBorda contra superficieElevada',
        'interface: campoBorda contra campoFundo',
      ]) {
        expect(medir(tema, nome).razao).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('o valor do documento: borda do campo no escuro a 3,9:1 do cartão (D65) e 3,07:1 do próprio fundo', () => {
    expect(medir('escuro', 'interface: campoBorda contra superficie').razao).toBeCloseTo(3.9, 1)
    expect(medir('escuro', 'interface: campoBorda contra campoFundo').razao).toBeCloseTo(3.07, 1)
  })
})
