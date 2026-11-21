import { GEOMETRIA_DO_SOL } from '@uj/tokens'

/**
 * Geometria do sol da marca (D63), no quadro de 1024 do `icon.png` recortado
 * num quadrado de 712. Funções puras: o desenho (`MarcaDoSol`) só as usa.
 */

const { quadro, centro, raioDoCorpo, raios, barra1, barra2 } = GEOMETRIA_DO_SOL

/** `viewBox` do recorte quadrado. */
export const VIEWBOX_DO_SOL = `${quadro.x} ${quadro.y} ${quadro.lado} ${quadro.lado}`

/** Onde fica o horizonte, de cima para baixo, em fração do lado (cerca de 0,62). */
export const FRACAO_DO_HORIZONTE = (centro.y - quadro.y) / quadro.lado

/** O semicírculo do corpo: arco por cima, base reta no horizonte. */
export function caminhoDoCorpo(): string {
  const esquerda = centro.x - raioDoCorpo
  const direita = centro.x + raioDoCorpo
  return `M${esquerda} ${centro.y} A${raioDoCorpo} ${raioDoCorpo} 0 0 1 ${direita} ${centro.y} Z`
}

export interface RaioDoSol {
  angulo: number
  /** Início e fim do traço (as pontas redondas acrescentam metade da espessura). */
  x1: number
  y1: number
  x2: number
  y2: number
  /** Centro do raio, em fração do lado (para a escala partir do próprio centro). */
  origem: { x: number; y: number }
}

/** Os 5 raios: de 150 a 30 graus, a partir do centro do corpo, de 269 a 352 de distância. */
export function raiosDoSol(): RaioDoSol[] {
  return raios.angulos.map((angulo) => {
    const rad = (angulo * Math.PI) / 180
    const ponto = (r: number) => ({
      x: Math.round((centro.x + r * Math.cos(rad)) * 100) / 100,
      y: Math.round((centro.y - r * Math.sin(rad)) * 100) / 100,
    })
    const a = ponto(raios.de)
    const b = ponto(raios.ate)
    return {
      angulo,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      origem: {
        x: ((a.x + b.x) / 2 - quadro.x) / quadro.lado,
        y: ((a.y + b.y) / 2 - quadro.y) / quadro.lado,
      },
    }
  })
}

export interface BarraDoSol {
  x: number
  y: number
  largura: number
  altura: number
  raio: number
}

export function barrasDoSol(): { barra1: BarraDoSol; barra2: BarraDoSol } {
  return {
    barra1: { ...barra1, raio: barra1.altura / 2 },
    barra2: { ...barra2, raio: barra2.altura / 2 },
  }
}

/** Centro do corpo em fração do lado: a escala do halo e do sol parte dele. */
export const CENTRO_DO_SOL = {
  x: (centro.x - quadro.x) / quadro.lado,
  y: (centro.y - quadro.y) / quadro.lado,
}
