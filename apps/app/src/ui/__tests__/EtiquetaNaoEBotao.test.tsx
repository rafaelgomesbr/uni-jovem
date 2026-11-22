/**
 * D79: a forma separa ação de estado. Etiqueta de estado (Chip) é retângulo arredondado de raio 8,
 * sem sombra; botão, filtro e segmento seguem na pílula. O recuo interno dos cartões é 16.
 */
import { render, screen } from '@testing-library/react-native'
import { RAIO, RITMO } from '@uj/tokens'
import { StyleSheet } from 'react-native'
import { Text } from 'react-native'

import { Botao } from '../Botao'
import { Cartao } from '../Cartao'
import { CartaoDoMomento } from '../CartaoDoMomento'
import { Chip } from '../Chip'
import { PilulasDeFiltro } from '../PilulasDeFiltro'

function achatado(no: { props: { style?: unknown } }) {
  return StyleSheet.flatten(no.props.style as never) as Record<string, unknown>
}

/** O primeiro ancestral com raio: a caixa do chip ou do botão. */
function caixaDe(texto: string) {
  let no = screen.getByText(texto).parent
  while (no && achatado(no as never).borderRadius === undefined) no = no.parent
  return achatado(no as never)
}

describe('etiqueta de estado não parece botão (D79)', () => {
  test('o chip tem raio 8 e nenhuma sombra; o botão e a pílula de filtro seguem em cápsula', async () => {
    await render(
      <>
        <Chip situacao="rascunho" />
        <Chip tom="alerta" icone="avisoAlerta" texto="Sem músicas" />
        <Botao titulo="Ver quem vai" variante="secundario" aoPressionar={() => {}} />
        <PilulasDeFiltro
          rotulo="Filtrar"
          pilulas={[{ valor: 'a', rotulo: 'Filtro A' }]}
          selecionadas={[]}
          aoMudar={() => {}}
        />
      </>,
    )
    expect(RAIO.etiqueta).toBe(8)
    for (const texto of ['Rascunho', 'Sem músicas']) {
      const caixa = caixaDe(texto)
      expect(caixa.borderRadius).toBe(8)
      expect(caixa.boxShadow).toBeUndefined()
    }
    expect(achatado(screen.getByRole('button', { name: 'Ver quem vai' })).borderRadius).toBe(999)
    expect(JSON.stringify(screen.getByRole('radio', { name: /Filtro A/ }).props.style)).toContain(
      '999',
    )
  })
})

describe('recuo interno de 16 em todo cartão (D79)', () => {
  test('o token vale 16 e o Cartão e o Cartão do momento o usam', async () => {
    expect(RITMO.recuoDoCartao).toBe(16)
    await render(
      <>
        <Cartao>
          <Text>dentro do cartão</Text>
        </Cartao>
        <CartaoDoMomento titulo="Culto" meta="Dom., 29 nov. · 16:00" />
      </>,
    )
    expect(
      JSON.stringify(screen.getByText('dentro do cartão').parent?.parent?.props.style),
    ).toMatch(/"padding":16/)
    const miolo = JSON.stringify(screen.getByTestId('cartao-do-momento').children[0])
    expect(miolo).toBeDefined()
  })
})
