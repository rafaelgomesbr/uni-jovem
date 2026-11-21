import type { PropsDaAurora } from './geometriaDaAurora'

/** Props do `FundoAurora` (nativo e web): a intensidade de sempre e o movimento da tela de acesso. */
export interface PropsDoFundoAurora extends PropsDaAurora {
  /**
   * `ambiente`: deriva lenta, só na tela de acesso (D63, exceção à 2.9 que diz
   * que não há animação decorativa contínua). O resto do app é `estatico`.
   */
  movimento?: 'estatico' | 'ambiente'
  /** O coral esquenta de 55% a 100% em 800 ms: o nascer do sol da abertura. */
  amanhecer?: boolean
  /**
   * Para a deriva e volta ao repouso (painel de e-mail com teclado, tela fora
   * de foco). Com o app em segundo plano a deriva para sozinha.
   */
  pausada?: boolean
}
