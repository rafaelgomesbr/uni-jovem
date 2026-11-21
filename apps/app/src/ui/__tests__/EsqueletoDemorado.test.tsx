/**
 * D58: carregamento longo não deixa a pessoa sem saída. Passados 10 s, o
 * esqueleto avisa que está demorando e oferece "Tentar de novo".
 */
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { AVISO_DE_DEMORA, BlocoDeEsqueleto, DEMORA_DO_ESQUELETO_MS, Esqueleto } from '../Esqueleto'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

function Carregando({ aoTentarDeNovo }: { aoTentarDeNovo?: () => void }) {
  return (
    <Esqueleto rotulo="Carregando a agenda" {...(aoTentarDeNovo ? { aoTentarDeNovo } : {})}>
      <BlocoDeEsqueleto altura={20} />
    </Esqueleto>
  )
}

describe('esqueleto que demora', () => {
  test('no começo não mostra o aviso; depois de 10 s mostra com "Tentar de novo"', async () => {
    await render(<Carregando />)
    await act(() => jest.advanceTimersByTimeAsync(DEMORA_DO_ESQUELETO_MS - 1))
    expect(screen.queryByText(AVISO_DE_DEMORA)).toBeNull()
    await act(() => jest.advanceTimersByTimeAsync(1))
    expect(screen.getByText(AVISO_DE_DEMORA)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('a tela pode escolher o que "Tentar de novo" faz; o aviso some e a contagem recomeça', async () => {
    const aoTentarDeNovo = jest.fn()
    await render(<Carregando aoTentarDeNovo={aoTentarDeNovo} />)
    await act(() => jest.advanceTimersByTimeAsync(DEMORA_DO_ESQUELETO_MS))
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(AVISO_DE_DEMORA)).toBeNull()
    await act(() => jest.advanceTimersByTimeAsync(DEMORA_DO_ESQUELETO_MS))
    expect(screen.getByText(AVISO_DE_DEMORA)).toBeOnTheScreen()
  })

  test('sem escolha, refaz a consulta que ainda carrega pela primeira vez', async () => {
    const consulta = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    const buscar = jest.fn(() => new Promise<never>(() => undefined))
    function Tela(): ReactNode {
      const q = useQuery({ queryKey: ['agenda'], queryFn: buscar })
      return q.isPending ? <Carregando /> : null
    }
    await render(
      <QueryClientProvider client={consulta}>
        <Tela />
      </QueryClientProvider>,
    )
    expect(buscar).toHaveBeenCalledTimes(1)
    await act(() => jest.advanceTimersByTimeAsync(DEMORA_DO_ESQUELETO_MS))
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(buscar).toHaveBeenCalledTimes(2)
  })
})
