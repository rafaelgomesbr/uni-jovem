import { describe, expect, it } from 'vitest'
import {
  ATRIBUICAO,
  diaDoAno,
  proximosVersiculos,
  VERSICULOS,
  versiculoDoDia,
} from '../src/index.ts'

describe('plano de versículos', () => {
  it('tem 366 versículos, sem repetição e sem texto vazio', () => {
    expect(VERSICULOS).toHaveLength(366)
    expect(new Set(VERSICULOS.map((v) => v.referencia)).size).toBe(366)
    for (const v of VERSICULOS) expect(v.texto.trim().length).toBeGreaterThan(10)
  })

  it('não traz título de salmo cortado nem travessão inventado', () => {
    for (const v of VERSICULOS) expect(v.texto).not.toMatch(/^(Salmo|Ao regente|Masquil|Mictão)/)
  })

  it('dia do ano vai de 1 a 366, inclusive em ano bissexto', () => {
    expect(diaDoAno(new Date(2026, 0, 1))).toBe(1)
    expect(diaDoAno(new Date(2026, 11, 31))).toBe(365)
    expect(diaDoAno(new Date(2028, 11, 31))).toBe(366)
  })

  it('o versículo do dia é estável para a mesma data e muda no dia seguinte', () => {
    const a = versiculoDoDia(new Date(2026, 10, 14, 7, 0))
    expect(versiculoDoDia(new Date(2026, 10, 14, 23, 59))).toEqual(a)
    expect(versiculoDoDia(new Date(2026, 10, 15, 7, 0))).not.toEqual(a)
  })

  it('agenda os próximos dias em sequência, atravessando a virada do ano', () => {
    const lista = proximosVersiculos(new Date(2026, 11, 30), 4)
    expect(lista.map((x) => x.data.getDate())).toEqual([30, 31, 1, 2])
    expect(lista[2]!.versiculo).toEqual(VERSICULOS[0])
  })

  it('o crédito da licença cita tradução, autores, data e licença', () => {
    expect(ATRIBUICAO.texto).toContain('Bíblia Livre')
    expect(ATRIBUICAO.texto).toContain('Diego Santos')
    expect(ATRIBUICAO.texto).toContain('2018')
    expect(ATRIBUICAO.texto).toContain('Atribuição 4.0')
  })
})
