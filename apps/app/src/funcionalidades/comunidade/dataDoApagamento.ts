import { dataDoInstante, formatarDataLocal, fusoDoAparelho } from '@/utilidades/datas'

/** "30/12/2026": quando a comunidade é apagada de vez (o fuso do aparelho, só para mostrar). */
export function dataDoApagamento(iso: string): string {
  return formatarDataLocal(dataDoInstante(iso, fusoDoAparelho()))
}
