import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { QuadroDeAcesso } from '../QuadroDeAcesso'

const mockVoltar = jest.fn()
jest.mock('@/ui/navegacao', () => ({
  ...jest.requireActual('@/ui/navegacao'),
  voltarOu: (...args: unknown[]) => mockVoltar(...args),
}))

beforeEach(() => jest.clearAllMocks())

describe('QuadroDeAcesso (criar conta, "Falta pouco" e convite) na direção A', () => {
  test('o sol da fundação (pose plena, sem halo) no canto, o título e o apoio', async () => {
    await render(
      <QuadroDeAcesso titulo="Criar conta" apoio="Use seu e-mail e uma senha.">
        <Text>Conteúdo do passo</Text>
      </QuadroDeAcesso>,
    )
    expect(screen.getByText('Criar conta')).toBeOnTheScreen()
    expect(screen.getByText('Use seu e-mail e uma senha.')).toBeOnTheScreen()
    expect(screen.getByText('Conteúdo do passo')).toBeOnTheScreen()
    // O mesmo `Sol` das telas (não um segundo desenho da marca): sem halo, decorativo.
    expect(screen.getByTestId('sol-corpo', { includeHiddenElements: true })).toBeOnTheScreen()
    expect(screen.queryByTestId('sol-halo', { includeHiddenElements: true })).toBeNull()
  })

  test('o voltar tem 44 pt e rótulo; sem voltar (convite pelo link), não aparece', async () => {
    const { rerender } = await render(
      <QuadroDeAcesso titulo="Criar conta">
        <Text>x</Text>
      </QuadroDeAcesso>,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(mockVoltar).toHaveBeenCalledWith('/entrar')
    await rerender(
      <QuadroDeAcesso titulo="Criar conta" semVoltar>
        <Text>x</Text>
      </QuadroDeAcesso>,
    )
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull()
  })
})
