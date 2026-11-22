/**
 * A faixa do encanto é região `status`, mas o iOS não fala sozinho: a frase é anunciada uma vez.
 */
import { act, render, screen } from '@testing-library/react-native'

import { anunciar } from '@/ui/anunciar'

import { FaixaDoEncanto } from '../EncantoDoSol'

jest.mock('@/ui/anunciar', () => ({ anunciar: jest.fn() }))

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
})
afterEach(() => jest.useRealTimers())

describe('FaixaDoEncanto', () => {
  test('anuncia a frase uma vez ao aparecer, sem repetir enquanto a faixa fica na tela', async () => {
    await render(<FaixaDoEncanto texto="Que bom ter você no Louvor." aoTerminar={jest.fn()} />)
    expect(screen.getByText('Que bom ter você no Louvor.')).toBeOnTheScreen()
    expect(anunciar).toHaveBeenCalledTimes(1)
    expect(anunciar).toHaveBeenCalledWith('Que bom ter você no Louvor.')

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000)
    })
    expect(anunciar).toHaveBeenCalledTimes(1)
  })
})
