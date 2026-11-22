import type { Paleta } from '@uj/tokens'

/**
 * Opções da pilha para uma folha NATIVA (`formSheet`): a única fonte, para o layout do app e o
 * da entrada (nenhum layout escreve `sheetAllowedDetents` à mão).
 *
 * POR QUE `fitToContents` e não uma lista de alturas (`[0.5, 1]`): com a lista, a altura do
 * conteúdo vem do tamanho que o sistema dá à folha (o filho `flex: 1` e a rolagem medem a partir
 * dele). No iOS 26, na versão de react-native-screens do app, a folha de "Comunidades" abriu com
 * a alça e o corpo TODO em branco (build 10, 22/11/2026): o conteúdo mediu zero. Com
 * `fitToContents` a folha tem a altura do PRÓPRIO conteúdo, então o conteúdo nunca depende de
 * uma altura que o sistema ainda não mandou. A contrapartida é regra de código: o conteúdo de
 * uma folha nativa nunca usa `flex: 1` nem `height: '100%'` (`Folha` já limita a rolagem com
 * `maxHeight`). O teste `FolhaNativa` confere as duas coisas.
 */
export function opcoesDaFolhaNativa(cores: Pick<Paleta, 'superficieElevada'>) {
  return {
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    // Grabber do sistema, raio 28 e a superfície elevada nas outras plataformas (2.12.19).
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    contentStyle: { backgroundColor: cores.superficieElevada },
  } as const
}

/**
 * Altura máxima da rolagem de uma folha: a janela menos a área segura de cima e uma faixa de
 * 56 para o sistema mostrar a tela de trás. Nunca menos que 240, para o conteúdo caber em
 * janelas muito baixas (paisagem).
 */
export function alturaMaximaDaFolha(alturaDaJanela: number, margemDeCima: number): number {
  return Math.max(240, Math.round(alturaDaJanela - margemDeCima - 56))
}
