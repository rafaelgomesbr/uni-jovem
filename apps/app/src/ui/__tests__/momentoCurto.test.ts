import { formatarMomento, formatarMomentoCurto } from '../momento'

describe('formatarMomentoCurto', () => {
  test('data vira dia/mês/ano, que cabe numa meia coluna com fonte grande', () => {
    expect(formatarMomentoCurto('data', '2026-11-28')).toBe('28/11/2026')
  })

  test('hora fica como está; vazio e inválido não mostram nada', () => {
    expect(formatarMomentoCurto('hora', '16:00')).toBe('16:00')
    expect(formatarMomentoCurto('data', null)).toBeNull()
    expect(formatarMomentoCurto('data', '28/11/2026')).toBeNull()
    expect(formatarMomentoCurto('hora', '4pm')).toBeNull()
  })

  test('o leitor de tela segue com a forma por extenso', () => {
    expect(formatarMomento('data', '2026-11-28')).toMatch(/28 de nov/)
  })
})
