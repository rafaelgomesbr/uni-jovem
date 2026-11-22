/**
 * D78: a barra de ação "solta" flutua sobre a tela, sem a faixa de vidro (sem fundo, sem borda de
 * cima, sem sombra de faixa), 12 acima da barra de abas flutuante, alinhada à margem do conteúdo, e
 * a tela reserva o espaço no fim da rolagem. A barra comum (com faixa) segue como era.
 */
import { ESPACO, RITMO } from '@uj/tokens'
import { render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'

import { alturaDaBarraDeAcao, BarraDeAcao, ContextoDaBarraFlutuanteEmbaixo } from '../BarraDeAcao'
import { Botao } from '../Botao'
import { ContextoDaBarraDeAbas, Tela } from '../Tela'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))

/** Espaço da barra flutuante num iPhone com Face ID: 24 do fim e 66 de barra. */
const BARRA = 90

type No = ReturnType<typeof screen.getByText>

/** Os estilos de todos os ancestrais de um nó, do mais perto ao mais longe. */
function estilosAcima(no: No): Record<string, unknown>[] {
  const lista: Record<string, unknown>[] = []
  let atual: No | null = no.parent
  while (atual) {
    lista.push((StyleSheet.flatten(atual.props.style) as Record<string, unknown> | undefined) ?? {})
    atual = atual.parent
  }
  return lista
}

describe('barra de ação solta (D78)', () => {
  test('sem faixa: nenhum fundo nem borda de cima em volta dos botões', async () => {
    await render(
      <ContextoDaBarraFlutuanteEmbaixo.Provider value={BARRA}>
        <BarraDeAcao solta>
          <Botao titulo="Publicar" aoPressionar={() => undefined} />
        </BarraDeAcao>
      </ContextoDaBarraFlutuanteEmbaixo.Provider>,
    )
    const acima = estilosAcima(screen.getByText('Publicar'))
    expect(acima.some((e) => e.borderTopWidth !== undefined)).toBe(false)
    // O fundo do botão é do botão; em volta dele, nada pintado.
    const emVolta = acima.slice(acima.findIndex((e) => e.paddingBottom !== undefined))
    expect(emVolta.some((e) => e.backgroundColor !== undefined)).toBe(false)
  })

  test('a barra comum continua com a faixa (borda de cima)', async () => {
    await render(
      <ContextoDaBarraFlutuanteEmbaixo.Provider value={0}>
        <BarraDeAcao>
          <Botao titulo="Salvar" aoPressionar={() => undefined} />
        </BarraDeAcao>
      </ContextoDaBarraFlutuanteEmbaixo.Provider>,
    )
    expect(
      estilosAcima(screen.getByText('Salvar')).some((e) => e.borderTopWidth !== undefined),
    ).toBe(true)
  })

  test('flutua 12 acima da barra de abas, na margem do conteúdo, deixando o toque passar em volta', async () => {
    await render(
      <ContextoDaBarraFlutuanteEmbaixo.Provider value={BARRA}>
        <BarraDeAcao solta>
          <Botao titulo="Publicar" aoPressionar={() => undefined} />
        </BarraDeAcao>
      </ContextoDaBarraFlutuanteEmbaixo.Provider>,
    )
    const botao = screen.getByText('Publicar')
    const contenedor = estilosAcima(botao).find((e) => e.paddingBottom !== undefined)!
    expect(contenedor.paddingBottom).toBe(BARRA + ESPACO.e12)
    expect(contenedor.paddingHorizontal).toBe(RITMO.margemDaTela)
    let atual: No | null = botao.parent
    let comToqueLivre = false
    while (atual) {
      if (atual.props.pointerEvents === 'box-none') comToqueLivre = true
      atual = atual.parent
    }
    expect(comToqueLivre).toBe(true)
  })

  test('na Tela, o fim da rolagem reserva a barra solta e o conteúdo nunca fica coberto', async () => {
    await render(
      <ContextoDaBarraDeAbas.Provider value={BARRA}>
        <Tela
          pilha
          titulo="Encontro"
          barraDeAcao={
            <BarraDeAcao solta>
              <Botao titulo="Publicar" aoPressionar={() => undefined} />
            </BarraDeAcao>
          }
        >
          <Text>Último bloco</Text>
        </Tela>
      </ContextoDaBarraDeAbas.Provider>,
    )
    let atual: No | null = screen.getByText('Último bloco').parent
    let fim: number | undefined
    while (atual) {
      if (atual.props.contentContainerStyle !== undefined) {
        fim = (StyleSheet.flatten(atual.props.contentContainerStyle) as { paddingBottom?: number })
          .paddingBottom
        break
      }
      atual = atual.parent
    }
    // No mínimo, o botão grande, o respiro e a barra de abas (o fim real vem da altura medida).
    expect(fim).toBeGreaterThanOrEqual(alturaDaBarraDeAcao(BARRA) - ESPACO.e12 * 2)
  })
})
