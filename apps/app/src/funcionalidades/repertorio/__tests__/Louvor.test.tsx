import { screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'

import { renderizarTela } from '@/testes/telas'

import { TelaLouvor } from '../TelaLouvor'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

describe('atalho Louvor (D61)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('leva ao Meu repertório, à Biblioteca, aos músicos e aos encontros', async () => {
    await renderizarTela(<TelaLouvor />, { papel: 'membro' })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Meu repertório\./ }))
    expect(router.push).toHaveBeenLastCalledWith('/meu-repertorio')
    await usuario.press(screen.getByRole('button', { name: /^Biblioteca de músicas\./ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/conteudos',
      params: { tipo: 'musicas' },
    })
    await usuario.press(screen.getByRole('button', { name: /^Músicos\./ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/conteudos',
      params: { tipo: 'musicos' },
    })
    await usuario.press(screen.getByRole('button', { name: /^Encontros\./ }))
    expect(router.push).toHaveBeenLastCalledWith('/agenda')
  })

  test('lembra que letra e cifra ficam só dentro da comunidade', async () => {
    await renderizarTela(<TelaLouvor />, { papel: 'membro' })
    expect(await screen.findByText('Só dentro da comunidade')).toBeOnTheScreen()
  })
})
