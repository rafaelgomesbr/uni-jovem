import {
  ajudaDoTituloEmBranco,
  alternarDia,
  diasDoAtalho,
  emOrdem,
  horaDoDia,
  MAXIMO_DE_ENCONTROS_EM_LOTE,
  quantosComHoraDiferente,
  resumoDosDias,
  sugestaoDeTitulo,
} from '../variosDias'

// Novembro de 2026: 22 é domingo, 25 quarta, 27 sexta, 28 sábado, 29 domingo.
describe('vários dias de uma vez (D78)', () => {
  test('alternar marca e desmarca, sempre em ordem e sem repetir', () => {
    let dias: string[] = []
    dias = alternarDia(dias, '2026-11-29')
    dias = alternarDia(dias, '2026-11-27')
    dias = alternarDia(dias, '2026-11-28')
    expect(dias).toEqual(['2026-11-27', '2026-11-28', '2026-11-29'])
    expect(alternarDia(dias, '2026-11-28')).toEqual(['2026-11-27', '2026-11-29'])
    expect(emOrdem(['2026-11-29', '2026-11-27', '2026-11-29'])).toEqual([
      '2026-11-27',
      '2026-11-29',
    ])
  })

  test('o limite é de 14 dias: o 15º não entra, mas quem já está marcado sempre pode sair', () => {
    const quatorze = Array.from(
      { length: MAXIMO_DE_ENCONTROS_EM_LOTE },
      (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`,
    )
    expect(MAXIMO_DE_ENCONTROS_EM_LOTE).toBe(14)
    expect(alternarDia(quatorze, '2026-12-20')).toEqual(quatorze)
    expect(alternarDia(quatorze, '2026-12-01')).toHaveLength(13)
  })

  test('"Fim de semana": o próximo sábado e o domingo; no domingo, só o de hoje', () => {
    // Quarta, 25/11: sábado 28 e domingo 29.
    expect(diasDoAtalho('fim_de_semana', '2026-11-25')).toEqual(['2026-11-28', '2026-11-29'])
    // Sábado, 28/11: ele mesmo e o domingo.
    expect(diasDoAtalho('fim_de_semana', '2026-11-28')).toEqual(['2026-11-28', '2026-11-29'])
    // Domingo, 29/11: o sábado já passou.
    expect(diasDoAtalho('fim_de_semana', '2026-11-29')).toEqual(['2026-11-29'])
  })

  test('"Esta semana": de hoje até o sábado, nunca um dia que já passou', () => {
    expect(diasDoAtalho('semana', '2026-11-25')).toEqual([
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    ])
    expect(diasDoAtalho('semana', '2026-11-22')).toHaveLength(7)
    expect(diasDoAtalho('semana', '2026-11-28')).toEqual(['2026-11-28'])
  })

  test('o resumo diz quantos encontros e quais dias, ou o dia por extenso quando é um só', () => {
    expect(resumoDosDias([])).toBe('Nenhum dia escolhido.')
    expect(resumoDosDias(['2026-11-29'])).toBe('Domingo, 29 de novembro')
    expect(resumoDosDias(['2026-11-27', '2026-11-28', '2026-11-29'])).toBe(
      '3 encontros: sex 27, sáb 28, dom 29',
    )
  })

  test('a hora de cada dia: a própria, se ajustada; senão a de todos', () => {
    const dias = ['2026-11-28', '2026-11-29']
    const horas = { '2026-11-29': '10:00' }
    expect(horaDoDia('2026-11-28', horas, '16:00')).toBe('16:00')
    expect(horaDoDia('2026-11-29', horas, '16:00')).toBe('10:00')
    expect(quantosComHoraDiferente(dias, horas, '16:00')).toBe(1)
    // A mesma hora ajustada à mão não conta como diferente.
    expect(quantosComHoraDiferente(dias, { '2026-11-29': '16:00' }, '16:00')).toBe(0)
  })

  test('o título em branco é o nome do dia; em vários dias, o de cada um', () => {
    expect(sugestaoDeTitulo([])).toBe('Encontro')
    expect(sugestaoDeTitulo(['2026-11-29'])).toBe('Domingo')
    expect(sugestaoDeTitulo(['2026-11-25'])).toBe('Quarta')
    expect(sugestaoDeTitulo(['2026-11-29', '2026-11-27'])).toBe('Sexta, Domingo')
    expect(ajudaDoTituloEmBranco(['2026-11-29'])).toBe('Em branco, o título é "Domingo".')
    expect(ajudaDoTituloEmBranco(['2026-11-28', '2026-11-29'])).toBe(
      'Em branco, cada encontro leva o nome do próprio dia.',
    )
  })
})
