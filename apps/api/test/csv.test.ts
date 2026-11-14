import { describe, expect, it } from 'vitest'
import { BOM_UTF8, celulaCsv, gerarCsv } from '../src/relatorios/csv.ts'

describe('CSV das exportações', () => {
  it('separa por ponto e vírgula, com CRLF, e escapa aspas e quebras', () => {
    expect(
      gerarCsv(
        ['Nome', 'Obs'],
        [
          ['Ana', 'diz "oi"'],
          ['Bia; Caio', 'linha\nquebrada'],
        ],
      ),
    ).toBe('Nome;Obs\r\nAna;"diz ""oi"""\r\n"Bia; Caio";"linha\nquebrada"\r\n')
  })

  it('neutraliza fórmulas de planilha em texto vindo de formulário', () => {
    for (const perigoso of ['=SOMA(A1)', '+55 11', '-1+1', '@cmd', '\tx']) {
      expect(celulaCsv(perigoso).replace(/^"/, '').startsWith("'")).toBe(true)
    }
    // Número de verdade não é texto: fica como está.
    expect(celulaCsv(-3)).toBe('-3')
  })

  it('vazios, booleanos e datas', () => {
    expect(celulaCsv(null)).toBe('')
    expect(celulaCsv(undefined)).toBe('')
    expect(celulaCsv(true)).toBe('sim')
    expect(celulaCsv(false)).toBe('não')
    expect(celulaCsv(new Date('2026-11-14T10:00:00Z'))).toBe('2026-11-14T10:00:00.000Z')
  })

  it('o BOM é um caractere só, entregue fora do conteúdo guardado', () => {
    expect(BOM_UTF8).toBe('﻿')
    expect(gerarCsv(['A'], []).startsWith(BOM_UTF8)).toBe(false)
  })
})
