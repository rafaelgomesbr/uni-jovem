/**
 * CSV para planilhas em português: separador ";" (a vírgula é o separador
 * decimal no Excel pt-BR), quebra de linha CRLF. O BOM UTF-8 (para a planilha
 * reconhecer os acentos) entra só na entrega do arquivo (`BOM_UTF8`), não no
 * que fica guardado no banco.
 *
 * Proteção contra injeção de fórmula: célula de texto que começa com = + - @
 * tabulação ou retorno ganha um apóstrofo na frente, para a planilha não
 * executar um nome como "=HYPERLINK(...)" digitado num formulário público.
 */

export type Celula = string | number | boolean | Date | null | undefined

const PERIGOSOS = /^[=+\-@\t\r]/
export const BOM_UTF8 = String.fromCharCode(0xfeff)

export function celulaCsv(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  let texto: string
  if (valor instanceof Date) texto = valor.toISOString()
  else if (typeof valor === 'boolean') texto = valor ? 'sim' : 'não'
  else if (typeof valor === 'number') texto = String(valor)
  else texto = PERIGOSOS.test(valor) ? `'${valor}` : valor
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function gerarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly Celula[])[],
): string {
  const todas = [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(';'))
  return `${todas.join('\r\n')}\r\n`
}
