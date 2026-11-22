import type { MomentoDoDia } from '@uj/tokens'

import type { PropsDaAurora } from './geometriaDaAurora'

/** Props do `FundoAurora` (nativo e web): a intensidade de sempre e o movimento da tela de acesso. */
export interface PropsDoFundoAurora extends PropsDaAurora {
  /**
   * `ambiente`: deriva lenta (D63 abriu a exceção à 2.9, que diz que não há animação
   * decorativa contínua, para a tela de acesso; a D67 estendeu a todas as telas com a
   * Aurora). Sempre desligada com "Reduzir movimento". `estatico` é o padrão do componente
   * solto; a `Tela` usa `ambiente`.
   */
  movimento?: 'estatico' | 'ambiente'
  /**
   * O momento do encontro: o brilho coral esquenta e se reposiciona com o relógio (opacidade,
   * escala e deslocamento em 900 ms). Sem ele, o coral fica no repouso de sempre.
   */
  momento?: MomentoDoDia
  /** O coral esquenta de 55% a 100% em 800 ms: o nascer do sol da abertura. */
  amanhecer?: boolean
  /**
   * Para a deriva e volta ao repouso (painel de e-mail com teclado, tela fora
   * de foco). Com o app em segundo plano a deriva para sozinha.
   */
  pausada?: boolean
}
