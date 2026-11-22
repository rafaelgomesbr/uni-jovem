import { screen, userEvent } from '@testing-library/react-native'
import { StyleSheet, useWindowDimensions } from 'react-native'

import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import { renderizarTela } from '@/testes/telas'

import { LinhaDaMusica } from '../LinhaDaMusica'

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 375, height: 812, scale: 3, fontScale: 1 })),
}))

const ITEM: ItemDoRepertorio = {
  id: 'item-1',
  ordem: 0,
  musicaId: 'mus-1',
  etapaId: null,
  tomDoDia: null,
  nota: null,
  versao: 1,
  titulo: 'Brilhar por ti',
  artista: 'Novo Tom',
  tomOriginal: 'C',
  andamentoBpm: null,
  duracaoSeg: null,
  arquivada: false,
  temCifra: true,
}

function montar(fontScale: number, aoAbrir = jest.fn(), aoMover = jest.fn()) {
  jest.mocked(useWindowDimensions).mockReturnValue({
    width: 375,
    height: 812,
    scale: 3,
    fontScale,
  })
  return renderizarTela(
    <LinhaDaMusica
      item={ITEM}
      posicao={1}
      total={3}
      ocupado={false}
      aoMover={aoMover}
      aoAbrir={aoAbrir}
    />,
    { papel: 'organizador' },
  ).then(() => ({ aoAbrir, aoMover }))
}

describe('linha de música do repertório (auditoria de UX, 43)', () => {
  test('uma linha: o artista vem com "de", e só há "Subir" e "Descer" (sem "Mais" nem Tom − e +)', async () => {
    await montar(1)
    expect(await screen.findByText('Tom C · de Novo Tom')).toBeOnTheScreen()
    expect(screen.getByText('Subir')).toBeOnTheScreen()
    expect(screen.getByText('Descer')).toBeOnTheScreen()
    expect(screen.queryByText('Mais')).toBeNull()
    expect(screen.queryByText('Tom −')).toBeNull()
  })

  test('Subir e Descer têm texto, ícone, 48 de altura no mínimo e a mesma largura', async () => {
    await montar(1)
    for (const nome of ['Subir Brilhar por ti', 'Descer Brilhar por ti']) {
      const botao = await screen.findByRole('button', { name: nome })
      const estilo = StyleSheet.flatten(botao.props.style as never) as { minHeight?: number }
      expect(estilo.minHeight).toBeGreaterThanOrEqual(48)
    }
  })

  test('a linha abre a folha da música; os botões mexem na ordem sem abri-la', async () => {
    const { aoAbrir, aoMover } = await montar(1)
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Subir Brilhar por ti' }))
    expect(aoMover).toHaveBeenCalledWith(1, 0)
    await usuario.press(screen.getByRole('button', { name: 'Descer Brilhar por ti' }))
    expect(aoMover).toHaveBeenLastCalledWith(1, 2)
    expect(aoAbrir).not.toHaveBeenCalled()
    await usuario.press(screen.getByLabelText(/^Música 2 de 3: Brilhar por ti/))
    expect(aoAbrir).toHaveBeenCalledTimes(1)
  })

  test('com fonte grande os botões vão para baixo do texto, lado a lado', async () => {
    await montar(2)
    const subir = await screen.findByRole('button', { name: 'Subir Brilhar por ti' })
    const descer = screen.getByRole('button', { name: 'Descer Brilhar por ti' })
    expect(subir).toBeOnTheScreen()
    expect(descer).toBeOnTheScreen()
    // A raiz da linha vira coluna: o texto em cima, os botões embaixo.
    const raiz = screen.getByLabelText(/^Música 2 de 3: Brilhar por ti/).parent
    const estilo = StyleSheet.flatten(raiz?.props.style as never) as { flexDirection?: string }
    expect(estilo.flexDirection).toBe('column')
  })

  test('com fonte normal a linha é uma fileira só', async () => {
    await montar(1)
    const raiz = (await screen.findByLabelText(/^Música 2 de 3: Brilhar por ti/)).parent
    const estilo = StyleSheet.flatten(raiz?.props.style as never) as { flexDirection?: string }
    expect(estilo.flexDirection).toBe('row')
  })
})
