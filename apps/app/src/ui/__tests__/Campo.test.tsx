import { render, screen, userEvent } from '@testing-library/react-native'
import { useState } from 'react'

import { Botao } from '../Botao'
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

  test('rótulo curto na tela, nome completo para o leitor de tela', async () => {
    await render(
      <Campo
        rotulo="Nome"
        rotuloAcessivel="Nome de quem chegou"
        value=""
        onChangeText={() => {}}
      />,
    )

    expect(screen.getByText('Nome')).toBeOnTheScreen()
    expect(screen.getByLabelText('Nome de quem chegou')).toHaveDisplayValue('')
  })

  test('campo e botão na mesma linha: o erro fica abaixo da linha inteira', async () => {
    await render(
      <Campo
        rotulo="Código de entrada"
        testID="codigo"
        value="XYZ"
        onChangeText={() => {}}
        erro="Use 10 letras e números."
        botao={<Botao titulo="Marcar" tamanho="grande" aoPressionar={() => {}} />}
      />,
    )

    // A caixa e o botão dividem a linha; o erro não fica preso só embaixo da caixa.
    const caixa = screen.getByTestId('codigo-caixa')
    const linha = caixa.parent!.parent!
    expect(linha).toHaveStyle({ flexDirection: 'row', alignItems: 'flex-end' })
    expect(screen.getByRole('button', { name: 'Marcar' })).toBeOnTheScreen()
    expect(linha).not.toContainElement(screen.getByText('Use 10 letras e números.'))
    expect(screen.getByLabelText('Código de entrada')).toHaveProp(
      'accessibilityHint',
      'Erro: Use 10 letras e números.',
    )
  })

  test('texto longo em leitura: multilinha de 160 em 17/26', async () => {
    await render(
      <Campo rotulo="Seu pedido" testID="pedido" leitura value="" onChangeText={() => {}} />,
    )

    expect(screen.getByTestId('pedido-caixa')).toHaveStyle({ minHeight: 160 })
    const campo = screen.getByLabelText('Seu pedido')
    expect(campo).toHaveProp('multiline', true)
    expect(campo).toHaveStyle({ fontSize: 17, lineHeight: 26 })
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
