import { render, screen, userEvent } from '@testing-library/react-native'
import { useState } from 'react'

import { Campo } from '../Campo'

describe('Campo', () => {
  test('o rótulo visível é o nome acessível do campo', async () => {
    await render(<Campo rotulo="E-mail" value="" onChangeText={() => {}} />)

    expect(screen.getByText('E-mail')).toBeOnTheScreen()
    expect(screen.getByLabelText('E-mail')).toHaveDisplayValue('')
  })

  test('mostra o erro abaixo e o associa ao campo', async () => {
    await render(
      <Campo
        rotulo="E-mail"
        value="ana@"
        onChangeText={() => {}}
        erro="Informe um e-mail válido."
      />,
    )

    expect(screen.getByText('Informe um e-mail válido.')).toBeOnTheScreen()
    expect(screen.getByLabelText('E-mail')).toHaveProp(
      'accessibilityHint',
      'Erro: Informe um e-mail válido.',
    )
  })

  test('a ajuda também é associada ao campo', async () => {
    await render(<Campo rotulo="WhatsApp" ajuda="Com DDD." value="" onChangeText={() => {}} />)

    expect(screen.getByLabelText('WhatsApp')).toHaveProp('accessibilityHint', 'Com DDD.')
  })

  test('campo de senha esconde o texto e tem botão acessível para mostrar', async () => {
    const usuario = userEvent.setup()
    await render(<Campo rotulo="Senha" senha value="segredo" onChangeText={() => {}} />)

    expect(screen.getByLabelText('Senha')).toHaveProp('secureTextEntry', true)
    await usuario.press(screen.getByRole('button', { name: 'Mostrar senha' }))

    expect(screen.getByLabelText('Senha')).toHaveProp('secureTextEntry', false)
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeOnTheScreen()
  })

  test('repassa o que a pessoa digita', async () => {
    function NomeControlado() {
      const [nome, setNome] = useState('')
      return <Campo rotulo="Nome" value={nome} onChangeText={setNome} />
    }
    await render(<NomeControlado />)

    await userEvent.setup().type(screen.getByLabelText('Nome'), 'Ana')

    expect(screen.getByLabelText('Nome')).toHaveDisplayValue('Ana')
  })
})
