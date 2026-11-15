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
    ).toBe('"Nome";"Obs"\r\n"Ana";"diz ""oi"""\r\n"Bia; Caio";"linha\nquebrada"\r\n')
  })

  it('toda célula de texto vai entre aspas: a vírgula não abre outra célula com fórmula', () => {
    // Numa planilha com vírgula como separador, sem aspas viraria "Ana" e "=1+1".
    expect(celulaCsv('Ana,=1+1')).toBe('"Ana,=1+1"')
    expect(gerarCsv(['A', 'B'], [['Ana,=1+1', 'x']])).toBe('"A";"B"\r\n"Ana,=1+1";"x"\r\n')
  })

  it('o apóstrofo também vale depois de espaços iniciais', () => {
    for (const perigoso of [' =SOMA(A1)', '  +1', ' \t-1', ' @cmd']) {
      expect(celulaCsv(perigoso)).toBe(`"'${perigoso}"`)
    }
    expect(celulaCsv(' Ana')).toBe('" Ana"')
  })

  it('neutraliza fórmulas de planilha em texto vindo de formulário', () => {
    for (const perigoso of ['=SOMA(A1)', '+55 11', '-1+1', '@cmd', '\tx']) {
      expect(celulaCsv(perigoso).startsWith(`"'`)).toBe(true)
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
