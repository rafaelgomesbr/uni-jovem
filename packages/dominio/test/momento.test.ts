import { describe, expect, it } from 'vitest'
import {
  ehTituloDeDiaDaSemana,
  estadoDoMomento,
  horaNoFuso,
  MAXIMO_DE_ENCONTROS_EM_LOTE,
  mesmaFuncao,
  nomeDoDiaDaData,
  proximaDataParaCopiar,
  rotuloCurtoDoDia,
  sugerirParaFuncao,
  tituloNaData,
  tituloPadraoDoEncontro,
} from '../src/index.ts'

const FUSO = 'America/Sao_Paulo'
// Sábado, 28/11/2026, 16:00 em Brasília (UTC-3).
const INICIO = new Date('2026-11-28T19:00:00Z')

function em(iso: string, extra: object = {}) {
  return estadoDoMomento({
    agora: new Date(iso),
    inicio: INICIO,
    duracaoMin: 60,
    fuso: FUSO,
    ...extra,
  })
}

describe('estado do cartão do momento', () => {
  it('longe: dias antes', () => {
    expect(em('2026-11-23T12:00:00Z')).toBe('longe')
    expect(em('2026-11-26T20:00:00Z')).toBe('longe')
  })

  it('véspera: o dia anterior, em hora de parede do fuso do encontro', () => {
    expect(em('2026-11-27T12:00:00Z')).toBe('vespera')
    // 27/11 23:30 em Brasília ainda é véspera, mesmo sendo 28/11 em UTC.
    expect(em('2026-11-28T02:30:00Z')).toBe('vespera')
  })

  it('no dia: do começo do dia local até a hora', () => {
    // 28/11 00:30 em Brasília.
    expect(em('2026-11-28T03:30:00Z')).toBe('no_dia')
    expect(em('2026-11-28T18:59:00Z')).toBe('no_dia')
  })

  it('acontecendo: do início ao fim; terminou depois', () => {
    expect(em('2026-11-28T19:00:00Z')).toBe('acontecendo')
    expect(em('2026-11-28T19:59:00Z')).toBe('acontecendo')
    expect(em('2026-11-28T20:00:00Z')).toBe('terminou')
    expect(em('2026-11-30T20:00:00Z')).toBe('terminou')
  })

  it('o ao vivo vence o relógio', () => {
    // Passou do horário, mas ainda em andamento (estourou).
    expect(em('2026-11-28T21:00:00Z', { situacaoAoVivo: 'em_andamento' })).toBe('acontecendo')
    expect(em('2026-11-28T21:00:00Z', { situacaoAoVivo: 'pausado' })).toBe('acontecendo')
    // Encerrado antes da hora prevista.
    expect(em('2026-11-28T19:30:00Z', { situacaoAoVivo: 'encerrado' })).toBe('terminou')
    // Não iniciado não muda nada.
    expect(em('2026-11-28T12:00:00Z', { situacaoAoVivo: 'nao_iniciado' })).toBe('no_dia')
  })
})

describe('data do "Igual ao último sábado"', () => {
  it('a semana seguinte ao último, se ainda é futuro', () => {
    expect(
      proximaDataParaCopiar({
        dataDaOrigem: '2026-11-21',
        hoje: '2026-11-22',
      }),
    ).toBe('2026-11-28')
  })

  it('nunca pula para longe: a data é a mais próxima, mesmo que já tenha encontro (o app avisa)', () => {
    // Meses de encontros no mesmo dia da semana não empurram a sugestão para abril (D74).
    expect(proximaDataParaCopiar({ dataDaOrigem: '2026-11-21', hoje: '2026-11-22' })).toBe(
      '2026-11-28',
    )
    expect(proximaDataParaCopiar({ dataDaOrigem: '2026-11-14', hoje: '2026-11-22' })).toBe(
      '2026-11-28',
    )
  })

  it('origem antiga: o primeiro mesmo dia da semana depois de hoje', () => {
    expect(
      proximaDataParaCopiar({
        dataDaOrigem: '2026-09-05',
        hoje: '2026-11-22',
      }),
    ).toBe('2026-11-28')
  })

  it('hoje não conta: precisa ser depois de hoje', () => {
    expect(
      proximaDataParaCopiar({
        dataDaOrigem: '2026-11-21',
        hoje: '2026-11-28',
      }),
    ).toBe('2026-12-05')
  })

  it('atravessa a virada do ano', () => {
    expect(
      proximaDataParaCopiar({
        dataDaOrigem: '2026-12-26',
        hoje: '2026-12-27',
      }),
    ).toBe('2027-01-02')
  })
})

describe('hora de parede', () => {
  it('no fuso do encontro, não em UTC', () => {
    expect(horaNoFuso(INICIO, FUSO)).toBe('16:00')
    expect(horaNoFuso(new Date('2026-11-28T02:30:00Z'), FUSO)).toBe('23:30')
    expect(horaNoFuso(new Date('2026-11-28T03:05:00Z'), FUSO)).toBe('00:05')
  })
})

describe('mesma função', () => {
  it.each([
    ['Bateria', 'bateria', true],
    ['Violão', 'violao', true],
    ['voz', 'Vocal', true],
    ['Recepção', 'recepcao', true],
    ['Recepção', 'Projeção', false],
    ['Bateria', 'Baixo', false],
    ['Coordenação', 'Recepção', false],
  ])('%s e %s', (a, b, esperado) => {
    expect(mesmaFuncao(a, b)).toBe(esperado)
  })
})

describe('sugestões por função', () => {
  const d = (iso: string) => new Date(iso)
  const historico = [
    { vinculoId: 'marcos', funcao: 'Bateria', quando: d('2026-11-14T19:00:00Z') },
    { vinculoId: 'marcos', funcao: 'bateria', quando: d('2026-11-07T19:00:00Z') },
    { vinculoId: 'marcos', funcao: 'Bateria', quando: d('2026-10-31T19:00:00Z') },
    { vinculoId: 'leo', funcao: 'Bateria', quando: d('2026-11-21T19:00:00Z') },
    { vinculoId: 'bruno', funcao: 'Violão', quando: d('2026-11-21T19:00:00Z') },
    { vinculoId: 'davi', funcao: 'Bateria', quando: d('2026-11-14T19:00:00Z') },
  ]

  it('mais vezes primeiro; quem não tocou bateria não aparece sem disponibilidade', () => {
    const r = sugerirParaFuncao({
      funcao: 'Bateria',
      historico,
      disponibilidade: new Map(),
      excluir: new Set(),
    })
    expect(r.sugeridas.map((s) => s.vinculoId)).toEqual(['marcos', 'leo', 'davi'])
    expect(r.sugeridas[0]).toMatchObject({ vezes: 3, disponivelNoDia: null })
    expect(r.naoDisponiveis).toEqual([])
  })

  it('quem serviu e pode neste dia sobe; quem só pode neste dia entra depois', () => {
    const r = sugerirParaFuncao({
      funcao: 'Bateria',
      historico,
      disponibilidade: new Map([
        ['davi', true],
        ['ana', true],
      ]),
      excluir: new Set(),
    })
    expect(r.sugeridas.map((s) => s.vinculoId)).toEqual(['davi', 'marcos', 'leo', 'ana'])
    expect(r.sugeridas.at(-1)).toMatchObject({ vezes: 0, disponivelNoDia: true })
  })

  it('quem disse que não pode sai das sugestões; quem já está convocado também', () => {
    const r = sugerirParaFuncao({
      funcao: 'Bateria',
      historico,
      disponibilidade: new Map([['marcos', false]]),
      excluir: new Set(['leo']),
    })
    expect(r.sugeridas.map((s) => s.vinculoId)).toEqual(['davi'])
    expect(r.naoDisponiveis).toEqual(['marcos'])
  })

  it('respeita o limite', () => {
    const r = sugerirParaFuncao({
      funcao: 'Bateria',
      historico,
      disponibilidade: new Map(),
      excluir: new Set(),
      limite: 2,
    })
    expect(r.sugeridas).toHaveLength(2)
  })
})

describe('título que combina com o dia (D78)', () => {
  // 28/11/2026 é sábado, 29 é domingo, 2/12 é quarta.
  it('o nome do dia vem da data, não de um dia fixo', () => {
    expect(nomeDoDiaDaData('2026-11-28')).toBe('Sábado')
    expect(nomeDoDiaDaData('2026-11-29')).toBe('Domingo')
    expect(nomeDoDiaDaData('2026-12-02')).toBe('Quarta')
    expect(nomeDoDiaDaData('2026-12-04')).toBe('Sexta')
  })

  it('o título padrão é o dia da data, ou "Encontro" sem data', () => {
    expect(tituloPadraoDoEncontro('2026-11-29')).toBe('Domingo')
    expect(tituloPadraoDoEncontro('2026-12-02')).toBe('Quarta')
    expect(tituloPadraoDoEncontro(null)).toBe('Encontro')
    expect(tituloPadraoDoEncontro()).toBe('Encontro')
  })

  it('só o título que é apenas o nome de um dia acompanha a data', () => {
    expect(tituloNaData('Sábado', '2026-11-29')).toBe('Domingo')
    expect(tituloNaData('sabado', '2026-12-02')).toBe('Quarta')
    expect(tituloNaData('Terça-feira', '2026-11-29')).toBe('Domingo')
    expect(tituloNaData('Sábado', '2026-11-28')).toBe('Sábado')
  })

  it('o título que a pessoa escreveu nunca é trocado', () => {
    expect(tituloNaData('Sábado Jovem', '2026-11-29')).toBe('Sábado Jovem')
    expect(tituloNaData('Retiro de domingo', '2026-12-02')).toBe('Retiro de domingo')
    expect(tituloNaData('Culto', '2026-11-29')).toBe('Culto')
    expect(ehTituloDeDiaDaSemana('Sábado Jovem')).toBe(false)
    expect(ehTituloDeDiaDaSemana('  Domingo ')).toBe(true)
  })

  it('o rótulo curto de cada dia, para listar vários numa linha', () => {
    expect(['2026-11-27', '2026-11-28', '2026-11-29'].map(rotuloCurtoDoDia)).toEqual([
      'sex 27',
      'sáb 28',
      'dom 29',
    ])
    expect(MAXIMO_DE_ENCONTROS_EM_LOTE).toBe(14)
  })
})
