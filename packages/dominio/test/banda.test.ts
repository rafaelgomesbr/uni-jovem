import { describe, expect, it } from 'vitest'
import {
  agruparBanda,
  ehConvocacaoDeLouvor,
  ehEtapaDeLouvor,
  ehFuncaoDaBanda,
  formatarDuracaoDaMusica,
  FUNCOES_DA_BANDA,
  lerDuracaoDaMusica,
  normalizarFuncaoDaBanda,
  resumoDaBanda,
  resumoDoRepertorio,
  type PessoaDaBanda,
} from '../src/index.ts'

describe('funções da banda', () => {
  it('a lista padrão', () => {
    expect(FUNCOES_DA_BANDA).toEqual([
      'Vocal',
      'Violão',
      'Guitarra',
      'Teclado',
      'Baixo',
      'Bateria',
      'Projeção',
      'Som',
      'Outro',
    ])
  })

  it.each([
    ['Violão', 'Violão'],
    ['violao', 'Violão'],
    ['  VIOLÃO  ', 'Violão'],
    ['violão aço', 'Violão'],
    ['Voz', 'Vocal'],
    ['vocal', 'Vocal'],
    ['Backing vocal', 'Vocal'],
    ['Vocalista', 'Vocal'],
    ['guitarra solo', 'Guitarra'],
    ['Teclado', 'Teclado'],
    ['piano', 'Teclado'],
    ['Contrabaixo', 'Baixo'],
    ['baixo', 'Baixo'],
    ['Bateria', 'Bateria'],
    ['batera', 'Bateria'],
    ['Projeção', 'Projeção'],
    ['projecao', 'Projeção'],
    ['telão', 'Projeção'],
    ['Som', 'Som'],
    ['técnico de som', 'Som'],
    ['Sonoplastia', 'Som'],
    ['violão e voz', 'Violão'],
    ['voz e violão', 'Vocal'],
  ])('%s é %s', (texto, esperado) => {
    expect(normalizarFuncaoDaBanda(texto)).toBe(esperado)
  })

  it('o que não é reconhecido cai em Outro (e palavra parecida não engana)', () => {
    for (const texto of ['integrante', 'responsável', 'regente', 'percussão', '', '   ']) {
      expect(normalizarFuncaoDaBanda(texto)).toBe('Outro')
    }
    expect(normalizarFuncaoDaBanda(null)).toBe('Outro')
    expect(normalizarFuncaoDaBanda('baixista')).toBe('Baixo')
    expect(normalizarFuncaoDaBanda('resumo')).toBe('Outro')
    expect(ehFuncaoDaBanda('violão')).toBe(true)
    expect(ehFuncaoDaBanda('recepção')).toBe(false)
  })
})

describe('convocação de louvor', () => {
  it('etapa de louvor pelo nome', () => {
    expect(ehEtapaDeLouvor('Louvor')).toBe(true)
    expect(ehEtapaDeLouvor('LOUVOR e adoração')).toBe(true)
    expect(ehEtapaDeLouvor('Adoração')).toBe(true)
    expect(ehEtapaDeLouvor('Palavra')).toBe(false)
    expect(ehEtapaDeLouvor(null)).toBe(false)
    expect(ehEtapaDeLouvor('')).toBe(false)
  })

  it('é de louvor pela etapa, pela etapa do repertório ou pela função', () => {
    expect(ehConvocacaoDeLouvor({ funcao: 'integrante', etapaTitulo: 'Louvor' })).toBe(true)
    expect(ehConvocacaoDeLouvor({ funcao: 'integrante', etapaTitulo: 'Outra' })).toBe(false)
    expect(
      ehConvocacaoDeLouvor({
        funcao: 'integrante',
        etapaTitulo: 'Outra',
        etapaComRepertorio: true,
      }),
    ).toBe(true)
    expect(ehConvocacaoDeLouvor({ funcao: 'Bateria', etapaTitulo: null })).toBe(true)
    expect(ehConvocacaoDeLouvor({ funcao: 'recepção' })).toBe(false)
  })
})

const p = (funcao: string, estado: PessoaDaBanda['estado']): PessoaDaBanda => ({ funcao, estado })

describe('resumo da banda', () => {
  it('agrupa por função, na ordem da lista, com os vazios', () => {
    const grupos = agruparBanda([
      p('violao', 'confirmada'),
      p('Voz', 'pendente'),
      p('Violão', 'recusada'),
      p('Regente', 'confirmada'),
    ])
    expect(grupos.map((g) => g.funcao)).toEqual([...FUNCOES_DA_BANDA])
    const por = (f: string) => grupos.find((g) => g.funcao === f)!
    expect(por('Vocal').pessoas).toHaveLength(1)
    expect(por('Violão')).toMatchObject({ aceitaram: 1, naoPodem: 1, aguardando: 0 })
    expect(por('Bateria').pessoas).toEqual([])
    expect(por('Outro').pessoas).toHaveLength(1)
  })

  it('"5 de 7 aceitaram. Falta: bateria"', () => {
    const r = resumoDaBanda([
      p('Vocal', 'confirmada'),
      p('Vocal', 'confirmada'),
      p('Violão', 'confirmada'),
      p('Guitarra', 'confirmada'),
      p('Teclado', 'confirmada'),
      p('Bateria', 'recusada'),
      p('Baixo', 'pendente'),
    ])
    expect(r.convocados).toBe(7)
    expect(r.aceitaram).toBe(5)
    expect(r.faltam).toEqual(['Baixo', 'Bateria'])
    expect(r.texto).toBe('5 de 7 aceitaram. Falta: baixo, bateria')
  })

  it('banda completa não tem "falta"', () => {
    const r = resumoDaBanda([p('Vocal', 'confirmada'), p('Bateria', 'confirmada')])
    expect(r.faltam).toEqual([])
    expect(r.texto).toBe('2 de 2 aceitaram')
  })

  it('um aceite basta para a função; pedido de troca não conta como aceite', () => {
    expect(resumoDaBanda([p('Bateria', 'recusada'), p('Bateria', 'confirmada')]).faltam).toEqual([])
    expect(resumoDaBanda([p('Bateria', 'substituicao_pedida')]).faltam).toEqual(['Bateria'])
  })

  it('singular, ninguém convocado e função esperada sem convocado', () => {
    expect(resumoDaBanda([p('Vocal', 'confirmada')]).texto).toBe('1 de 1 aceitou')
    expect(resumoDaBanda([]).texto).toBe('')
    expect(resumoDaBanda([p('Vocal', 'confirmada')], ['Bateria']).faltam).toEqual(['Bateria'])
    expect(resumoDaBanda([], ['Bateria']).texto).toBe('')
  })

  it('"Outro" nunca é função que falta', () => {
    expect(resumoDaBanda([p('Regente', 'pendente')]).faltam).toEqual([])
  })
})

describe('resumo do repertório', () => {
  it('"4 músicas, cerca de 17 min de 15 previstos"', () => {
    const r = resumoDoRepertorio(
      [{ duracaoSeg: 240 }, { duracaoSeg: 300 }, { duracaoSeg: 250 }, { duracaoSeg: 230 }],
      15,
    )
    expect(r.texto).toBe('4 músicas, cerca de 17 min de 15 previstos')
    expect(r.passaDoPrevisto).toBe(true)
    expect(r.semDuracao).toBe(0)
  })

  it('dentro do previsto, sem previsto e uma música só', () => {
    expect(resumoDoRepertorio([{ duracaoSeg: 600 }], 15)).toMatchObject({
      texto: '1 música, cerca de 10 min de 15 previstos',
      passaDoPrevisto: false,
    })
    expect(resumoDoRepertorio([{ duracaoSeg: 600 }]).texto).toBe('1 música, cerca de 10 min')
  })

  it('músicas sem duração não entram na soma e são contadas à parte', () => {
    const r = resumoDoRepertorio([{ duracaoSeg: 300 }, { duracaoSeg: null }], 15)
    expect(r.texto).toBe('2 músicas, cerca de 5 min de 15 previstos (1 sem duração cadastrada)')
    expect(r.semDuracao).toBe(1)
    expect(resumoDoRepertorio([{ duracaoSeg: null }]).texto).toBe('1 música')
  })

  it('vazio', () => {
    expect(resumoDoRepertorio([], 15)).toMatchObject({ musicas: 0, texto: '' })
  })

  it('lê e escreve a duração da música', () => {
    expect(formatarDuracaoDaMusica(225)).toBe('3:45')
    expect(formatarDuracaoDaMusica(60)).toBe('1:00')
    expect(formatarDuracaoDaMusica(null)).toBe('')
    expect(lerDuracaoDaMusica('3:45')).toBe(225)
    expect(lerDuracaoDaMusica('225')).toBe(225)
    expect(lerDuracaoDaMusica(' 4:05 ')).toBe(245)
    expect(lerDuracaoDaMusica('')).toBeNull()
    expect(lerDuracaoDaMusica('3:75')).toBeNull()
    expect(lerDuracaoDaMusica('5')).toBeNull()
    expect(lerDuracaoDaMusica('99999')).toBeNull()
    expect(lerDuracaoDaMusica('abc')).toBeNull()
  })
})
