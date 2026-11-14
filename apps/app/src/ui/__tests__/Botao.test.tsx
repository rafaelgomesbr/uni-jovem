import { render, screen, userEvent } from '@testing-library/react-native'

import { Botao } from '../Botao'

describe('Botao', () => {
  test('é anunciado como botão com o próprio título e responde ao toque', async () => {
    const aoPressionar = jest.fn()
    await render(<Botao titulo="Salvar dados" aoPressionar={aoPressionar} />)

    const botao = screen.getByRole('button', { name: 'Salvar dados' })
    await userEvent.setup().press(botao)

    expect(aoPressionar).toHaveBeenCalledTimes(1)
  })

  test('aceita rótulo acessível mais completo que o título', async () => {
    await render(
      <Botao
        titulo="Desconectar"
        rotuloAcessivel="Desconectar iPhone 15"
        aoPressionar={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Desconectar iPhone 15' })).toBeOnTheScreen()
  })

  test('desabilitado explica o motivo na tela e para o leitor de tela', async () => {
    const aoPressionar = jest.fn()
    await render(
      <Botao
        titulo="Agendar exclusão"
        aoPressionar={aoPressionar}
        desabilitado
        motivo="Digite o nome exato da comunidade para liberar."
      />,
    )

    const botao = screen.getByRole('button', { name: 'Agendar exclusão' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveProp('accessibilityHint', 'Digite o nome exato da comunidade para liberar.')
    expect(screen.getByText('Digite o nome exato da comunidade para liberar.')).toBeOnTheScreen()
    await userEvent.setup().press(botao)
    expect(aoPressionar).not.toHaveBeenCalled()
  })

  test('carregando fica ocupado e não aceita toque duplo', async () => {
    const aoPressionar = jest.fn()
    await render(<Botao titulo="Entrar" aoPressionar={aoPressionar} carregando />)

    const botao = screen.getByRole('button', { name: 'Entrar' })
    expect(botao).toBeBusy()
    expect(botao).toBeDisabled()
  })
})
