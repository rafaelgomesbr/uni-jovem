/**
 * Só o núcleo do `qrcode` (gera a matriz de módulos, sem canvas nem arquivo).
 * O pacote principal puxa renderizadores de Node; o app desenha com Views.
 */
declare module 'qrcode/lib/core/qrcode' {
  export interface MatrizDoQr {
    size: number
    get(linha: number, coluna: number): number | boolean
  }
  export function create(
    texto: string,
    opcoes?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' },
  ): { modules: MatrizDoQr }
}
