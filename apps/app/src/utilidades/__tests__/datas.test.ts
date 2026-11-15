import {
  falarCronometro,
  formatarCronometro,
  formatarDataPorExtenso,
  formatarDuracao,
  formatarHora,
  formatarQuando,
  gradeDoMes,
  instanteDeDataEHora,
  lerDataDigitada,
  lerHoraDigitada,
  somarMeses,
} from '../datas'

describe('datas no fuso da comunidade', () => {
  test('hora de parede em São Paulo e em Lisboa para o mesmo instante', () => {
    expect(formatarHora('2026-11-21T19:00:00.000Z', 'America/Sao_Paulo')).toBe('16:00')
    expect(formatarHora('2026-11-21T19:00:00.000Z', 'Europe/Lisbon')).toBe('19:00')
  })

  test('data e hora digitadas viram o instante certo, inclusive com horário de verão', () => {
    expect(instanteDeDataEHora('2026-11-21', '16:00', 'America/Sao_Paulo')).toBe(
      '2026-11-21T19:00:00.000Z',
    )
    // Lisboa em julho está em UTC+1.
    expect(instanteDeDataEHora('2026-07-04', '16:00', 'Europe/Lisbon')).toBe(
      '2026-07-04T15:00:00.000Z',
    )
  })

  test('textos absolutos, nunca relativos', () => {
    expect(formatarQuando('2026-11-21T19:00:00.000Z', 'America/Sao_Paulo')).toBe(
      'sáb, 21/11/2026 às 16:00',
    )
    expect(formatarDataPorExtenso('2026-11-21')).toBe('sábado, 21 de novembro de 2026')
    expect(formatarDuracao(65)).toBe('1 h 05 min')
    expect(formatarDuracao(45)).toBe('45 min')
  })

  test('leitura do que a pessoa digita', () => {
    expect(lerDataDigitada('21/11/2026')).toBe('2026-11-21')
    expect(lerDataDigitada('2026-11-21')).toBe('2026-11-21')
    expect(lerDataDigitada('31/02/2026')).toBeNull()
    expect(lerDataDigitada('amanhã')).toBeNull()
    expect(lerHoraDigitada('16h')).toBe('16:00')
    expect(lerHoraDigitada('16h30')).toBe('16:30')
    expect(lerHoraDigitada('1630')).toBe('16:30')
    expect(lerHoraDigitada('24:00')).toBeNull()
  })

  test('grade do mês começa no domingo e cobre 6 semanas', () => {
    const grade = gradeDoMes('2026-11-15')
    expect(grade).toHaveLength(42)
    expect(grade[0]).toBe('2026-11-01') // 01/11/2026 é domingo
    expect(somarMeses('2026-12-20', 1)).toBe('2027-01-01')
  })

  test('cronômetro na tela e por extenso para o leitor de tela', () => {
    expect(formatarCronometro(307_000)).toBe('05:07')
    expect(formatarCronometro(3_907_000)).toBe('1:05:07')
    expect(falarCronometro(307_000)).toBe('5 minutos e 7 segundos')
  })
})
