import type { NomeDoTema } from './cores.ts'

/**
 * Fundo Aurora (seção 2.3): brilho coral no canto superior direito e violeta
 * à esquerda. A Aurora é uma camada absoluta no topo do conteúdo rolável e
 * rola junto; o deslocamento vertical acompanha a área segura, para o brilho
 * ficar sempre na mesma posição em relação ao cabeçalho (é sobre essa
 * posição que o contraste foi medido).
 *
 * O degradê é `radial-gradient(circle, cor 0%, transparente 70%)`, igual ao
 * mockup. Em CSS (e no React Native, que segue o CSS), o círculo sem tamanho
 * vai até o canto mais distante da caixa: a cor some a 70% de r·√2 do centro,
 * não a 70% do raio. É com essa queda que `alfaDaAurora` calcula o pior ponto.
 */
export const AURORA = {
  /** Topo da área segura no quadro do mockup (padding de 56 = 48 + 8). */
  areaSeguraDeReferencia: 48,
  /** Largura do quadro do mockup. */
  larguraDeReferencia: 390,
  paradaFinal: 0.7,
  /** Telas de pilha: 60% da opacidade, mesma geometria. */
  intensidadeNaPilha: 0.6,
  coral: {
    lado: 380,
    // Mockup: topo -140 e direita -120; deslocado 20 e 20 para o status passar AA (1.11, item 2).
    topo: -160,
    direita: -140,
    escuro: 'rgba(255,138,101,0.55)',
    claro: 'rgba(255,138,101,0.30)',
  },
  violeta: {
    lado: 360,
    topo: 120,
    esquerda: -160,
    escuro: 'rgba(124,108,255,0.45)',
    claro: 'rgba(124,108,255,0.22)',
  },
  /**
   * Deriva lenta, só na tela de acesso (D63: exceção limitada à 2.9, que diz
   * que não há animação decorativa contínua). Cada brilho vai e volta até a
   * posição de repouso (a medida do contraste) e para sozinho depois de
   * `meiasVoltas` (84 s o coral, 108 s o violeta). Só `transform` e `opacity`.
   */
  deriva: {
    coral: { x: -14, y: 12, escala: 1.06, opacidade: 0.9, meioCiclo: 14_000, meiasVoltas: 6 },
    violeta: { x: 16, y: -10, escala: 1.05, opacidade: 0.92, meioCiclo: 18_000, meiasVoltas: 6 },
    /** O coral esquenta na abertura: o "nascer do sol". */
    abertura: { duracao: 800, opacidadeInicial: 0.55, escalaInicial: 0.94 },
  },
} as const

export type BrilhoDaAurora = 'coral' | 'violeta'

export interface Ponto {
  x: number
  y: number
}

/** Centro de cada brilho no quadro de referência (390 de largura, área segura de 48). */
export function centroDoBrilho(brilho: BrilhoDaAurora): Ponto {
  if (brilho === 'coral') {
    const { lado, topo, direita } = AURORA.coral
    return { x: AURORA.larguraDeReferencia + -direita - lado / 2, y: topo + lado / 2 }
  }
  const { lado, topo, esquerda } = AURORA.violeta
  return { x: esquerda + lado / 2, y: topo + lado / 2 }
}

/** Alfa do brilho num ponto do quadro de referência (0 fora do círculo). */
export function alfaDaAurora(
  brilho: BrilhoDaAurora,
  ponto: Ponto,
  tema: NomeDoTema,
  intensidade = 1,
): number {
  const { lado } = AURORA[brilho]
  const raio = lado / 2
  const centro = centroDoBrilho(brilho)
  const distancia = Math.hypot(ponto.x - centro.x, ponto.y - centro.y)
  if (distancia > raio) return 0
  const fim = AURORA.paradaFinal * raio * Math.SQRT2
  const pico = Number(/,\s*([\d.]+)\s*\)$/.exec(AURORA[brilho][tema])?.[1] ?? 0)
  return Math.max(0, pico * intensidade * (1 - distancia / fim))
}

/** A cor do brilho (`rgba`) com o alfa daquele ponto, pronta para compor sobre o fundo. */
export function corDaAuroraNoPonto(
  brilho: BrilhoDaAurora,
  ponto: Ponto,
  tema: NomeDoTema,
  intensidade = 1,
): string {
  const alfa = alfaDaAurora(brilho, ponto, tema, intensidade)
  const rgb = /^rgba\(([^)]*),[^,]*\)$/.exec(AURORA[brilho][tema])?.[1] ?? '0,0,0'
  return `rgba(${rgb},${Math.round(alfa * 10000) / 10000})`
}

/**
 * Pontos críticos, no quadro de referência:
 * - `status`: o ponto do texto "Sincronizado 14:32" mais perto do centro
 *   coral (linha de 44 a 8 da área segura; texto de 18 de altura, à direita);
 * - `conteudoSobACoral`: o ponto mais alto que um texto de cartão pode
 *   ocupar, logo abaixo da linha do cabeçalho;
 * - `conteudoSobAVioleta`: texto de cartão no pico violeta (x = 20 + 18).
 */
export const PONTOS_CRITICOS_DA_AURORA = {
  status: { x: centroDoBrilho('coral').x, y: AURORA.areaSeguraDeReferencia + 8 + 13 },
  conteudoSobACoral: {
    x: centroDoBrilho('coral').x,
    y: AURORA.areaSeguraDeReferencia + 8 + 44 + 16,
  },
  conteudoSobAVioleta: { x: 20 + 18, y: centroDoBrilho('violeta').y },
} as const satisfies Record<string, Ponto>
