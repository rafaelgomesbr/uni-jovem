import { describe, expect, it } from 'vitest'
import { dataNoFuso, dataValida, gerarDatas, instanteNoFuso } from '../src/index.ts'

describe('gerarDatas', () => {
  it('todo sábado', () => {
    const d = gerarDatas(
      { frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [6] },
      '2026-11-14',
      '2026-12-13',
    )
    expect(d).toEqual(['2026-11-14', '2026-11-21', '2026-11-28', '2026-12-05', '2026-12-12'])
  })

  it('início no meio da semana começa no próximo dia válido; quinzenal pula semanas', () => {
    const d = gerarDatas(
      { frequencia: 'semanal', intervaloSemanas: 2, diasDaSemana: [6] },
      '2026-11-11',
      '2026-12-31',
    )
    expect(d).toEqual(['2026-11-14', '2026-11-28', '2026-12-12', '2026-12-26'])
  })

  it('vários dias por semana, respeitando a data de fim (inclusive)', () => {
    const d = gerarDatas(
      { frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [3, 6] },
      '2026-11-01',
      '2027-01-01',
      '2026-11-14',
    )
    expect(d).toEqual(['2026-11-04', '2026-11-07', '2026-11-11', '2026-11-14'])
  })

  it('primeiro sábado do mês e último sábado do mês', () => {
    expect(
      gerarDatas(
        { frequencia: 'mensal', modo: 'semana_do_mes', semana: 1, diaDaSemana: 6 },
        '2026-11-01',
        '2027-02-01',
      ),
    ).toEqual(['2026-11-07', '2026-12-05', '2027-01-02'])
    expect(
      gerarDatas(
        { frequencia: 'mensal', modo: 'semana_do_mes', semana: -1, diaDaSemana: 6 },
        '2026-11-01',
        '2027-02-01',
      ),
    ).toEqual(['2026-11-28', '2026-12-26', '2027-01-30'])
  })

  it('dia 31: meses sem o dia ficam sem ocorrência (não viram dia 1)', () => {
    expect(
      gerarDatas({ frequencia: 'mensal', modo: 'dia_do_mes', dia: 31 }, '2027-01-01', '2027-06-01'),
    ).toEqual(['2027-01-31', '2027-03-31', '2027-05-31'])
  })

  it('teto de ocorrências por chamada', () => {
    const d = gerarDatas(
      { frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [0, 1, 2, 3, 4, 5, 6] },
      '2026-01-01',
      '2030-01-01',
    )
    expect(d.length).toBe(400)
  })
})

describe('instanteNoFuso', () => {
  it('São Paulo (sem horário de verão desde 2019): 16h = 19h UTC', () => {
    expect(instanteNoFuso('2026-11-21', '16:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-11-21T19:00:00.000Z',
    )
  })

  it('Nova York: a mesma hora de parede antes e depois da mudança de horário', () => {
    expect(instanteNoFuso('2026-03-07', '16:00', 'America/New_York').toISOString()).toBe(
      '2026-03-07T21:00:00.000Z',
    )
    expect(instanteNoFuso('2026-03-14', '16:00', 'America/New_York').toISOString()).toBe(
      '2026-03-14T20:00:00.000Z',
    )
  })

  it('hora que não existe (início do horário de verão) avança; hora repetida usa a primeira', () => {
    // 2026-03-08 02:30 não existe em Nova York (02:00 vira 03:00).
    expect(instanteNoFuso('2026-03-08', '02:30', 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    )
    // 2026-11-01 01:30 acontece duas vezes; a primeira é em EDT (UTC-4).
    expect(instanteNoFuso('2026-11-01', '01:30', 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    )
  })

  it('data de parede de um instante', () => {
    expect(dataNoFuso(new Date('2026-11-22T01:00:00Z'), 'America/Sao_Paulo')).toBe('2026-11-21')
    expect(dataNoFuso(new Date('2026-11-22T04:00:00Z'), 'America/Sao_Paulo')).toBe('2026-11-22')
  })

  it('valida datas', () => {
    expect(dataValida('2026-02-29')).toBe(false)
    expect(dataValida('2028-02-29')).toBe(true)
  })
})
