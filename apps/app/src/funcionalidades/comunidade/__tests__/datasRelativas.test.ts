import { dataRelativa } from '../datasRelativas'

const AGORA = new Date('2026-11-22T15:00:00.000Z')
const antes = (dias: number, horas = 0) =>
  new Date(AGORA.getTime() - dias * 86_400_000 - horas * 3_600_000).toISOString()

describe('dataRelativa: "há 2 dias" no mural, em palavras', () => {
  test('hoje, ontem e dias', () => {
    expect(dataRelativa(antes(0, 3), AGORA)).toBe('hoje')
    expect(dataRelativa(antes(1, 2), AGORA)).toBe('ontem')
    expect(dataRelativa(antes(2, 1), AGORA)).toBe('há 2 dias')
    expect(dataRelativa(antes(13), AGORA)).toBe('há 13 dias')
  })

  test('semanas até um mês e meio; depois, a data escrita', () => {
    expect(dataRelativa(antes(14), AGORA)).toBe('há 2 semanas')
    expect(dataRelativa(antes(30), AGORA)).toBe('há 4 semanas')
    expect(dataRelativa(antes(60), AGORA)).toBe('23/09/2026')
  })

  test('o futuro (relógio do aparelho atrasado) e a data inválida não quebram', () => {
    expect(dataRelativa(new Date(AGORA.getTime() + 3_600_000).toISOString(), AGORA)).toBe('hoje')
    expect(dataRelativa('isto não é data', AGORA)).toBe('')
  })
})
