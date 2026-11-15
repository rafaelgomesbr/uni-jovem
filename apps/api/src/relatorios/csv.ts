/**
 * CSV para planilhas em português: separador ";" (a vírgula é o separador
 * decimal no Excel pt-BR), quebra de linha CRLF. O BOM UTF-8 (para a planilha
 * reconhecer os acentos) entra só na entrega do arquivo (`BOM_UTF8`), não no
 * que fica guardado no banco.
 *
 * Proteção contra injeção de fórmula: célula de texto que começa com = + - @
 * tabulação ou retorno (mesmo depois de espaços) ganha um apóstrofo na frente,
 * para a planilha não executar um nome como "=HYPERLINK(...)" digitado num
 * formulário público. E TODA célula de texto vai entre aspas: aberto numa
 * planilha configurada com a vírgula como separador, "Ana,=1+1" continua uma
 * célula só, e o "=1+1" não vira uma célula nova que começa com fórmula.
 */

export type Celula = string | number | boolean | Date | null | undefined

const PERIGOSOS = /^\s*[=+\-@\t\r]/
export const BOM_UTF8 = String.fromCharCode(0xfeff)

const entreAspas = (texto: string) => `"${texto.replace(/"/g, '""')}"`

export function celulaCsv(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não'
  if (typeof valor === 'number') return String(valor)
  return entreAspas(PERIGOSOS.test(valor) ? `'${valor}` : valor)
}

export function gerarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly Celula[])[],
): string {
  const todas = [cabecalho, ...linhas].map((l) => l.map(celulaCsv).join(';'))
  return `${todas.join('\r\n')}\r\n`
}
