import { render, screen, userEvent } from '@testing-library/react-native'
import { TEMAS } from '@uj/tokens'
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

  test('texto longo em leitura: área de 5 a 10 linhas (164 a 294), em 17/26', async () => {
    await render(
      <Campo rotulo="Seu pedido" testID="pedido" leitura value="" onChangeText={() => {}} />,
    )

    expect(screen.getByTestId('pedido-caixa')).toHaveStyle({ minHeight: 164, maxHeight: 294 })
    const campo = screen.getByLabelText('Seu pedido')
    expect(campo).toHaveProp('multiline', true)
    expect(campo).toHaveStyle({ fontSize: 17, lineHeight: 26 })
  })

  test('área de texto: cresce de 3 a 8 linhas (100 a 210) e rola por dentro depois disso', async () => {
    await render(
      <Campo rotulo="Descrição" testID="desc" multiline value="" onChangeText={() => {}} />,
    )

    // 16 de padding, 3 linhas de 22, 16 de padding e 2 de borda = 100; 8 linhas = 210.
    expect(screen.getByTestId('desc-caixa')).toHaveStyle({ minHeight: 100, maxHeight: 210 })
    expect(screen.getByLabelText('Descrição')).toHaveStyle({
      minHeight: 98,
      maxHeight: 208,
      paddingVertical: 16,
      lineHeight: 22,
    })
  })

  test('área de texto com `linhas` próprias: de 2 a 4 linhas', async () => {
    await render(
      <Campo
        rotulo="Nota"
        testID="nota"
        multiline
        linhas={{ min: 2, max: 4 }}
        value=""
        onChangeText={() => {}}
      />,
    )

    expect(screen.getByTestId('nota-caixa')).toHaveStyle({
      minHeight: 2 * 22 + 34,
      maxHeight: 4 * 22 + 34,
    })
  })

  test('contador: normal até 90% do limite; depois ganha peso 600 e alerta; no limite, vira erro', async () => {
    const { rerender } = await render(
      <Campo
        rotulo="Pedido"
        multiline
        maxLength={100}
        mostrarContador
        value={'a'.repeat(10)}
        onChangeText={() => {}}
      />,
    )
    expect(screen.getByText('10/100')).toHaveStyle({ color: TEMAS.claro.base.textoSuave })

    await rerender(
      <Campo
        rotulo="Pedido"
        multiline
        maxLength={100}
        mostrarContador
        value={'a'.repeat(90)}
        onChangeText={() => {}}
      />,
    )
    expect(screen.getByText('90/100')).toHaveStyle({ color: TEMAS.claro.base.texto })
    expect(screen.getByLabelText('90 de 100 caracteres')).toBeOnTheScreen()

    await rerender(
      <Campo
        rotulo="Pedido"
        multiline
        maxLength={100}
        mostrarContador
        value={'a'.repeat(100)}
        onChangeText={() => {}}
      />,
    )
    expect(screen.getByLabelText('100 de 100 caracteres, limite atingido')).toBeOnTheScreen()
  })

  test('limpar: aparece com texto, apaga ao tocar e some com o campo vazio', async () => {
    const aoMudar = jest.fn()
    const { rerender } = await render(
      <Campo rotulo="Nome" limpavel value="Ana" onChangeText={aoMudar} />,
    )
    await userEvent.setup().press(screen.getByRole('button', { name: 'Limpar Nome' }))
    expect(aoMudar).toHaveBeenCalledWith('')

    await rerender(<Campo rotulo="Nome" limpavel value="" onChangeText={aoMudar} />)
    expect(screen.queryByRole('button', { name: 'Limpar Nome' })).toBeNull()
  })

  test('senha: o botão tem o olho e a palavra "Mostrar" ou "Ocultar", com alvo de 44', async () => {
    await render(<Campo rotulo="Senha" senha value="x" onChangeText={() => {}} />)
    expect(screen.getByText('Mostrar')).toBeOnTheScreen()
    const botao = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(botao).toHaveStyle({ minHeight: 44, minWidth: 44 })
    await userEvent.setup().press(botao)
    expect(screen.getByText('Ocultar')).toBeOnTheScreen()
  })

  test('prefixo e sufixo ficam dentro da caixa, em texto suave', async () => {
    await render(
      <Campo rotulo="Valor" prefixo="R$" sufixo="/mês" value="10" onChangeText={() => {}} />,
    )
    expect(screen.getByText('R$')).toBeOnTheScreen()
    expect(screen.getByText('/mês')).toBeOnTheScreen()
  })

  test('preenchimento do sistema: quem declara autoComplete também liga o importantForAutofill', async () => {
    await render(
      <Campo
        rotulo="E-mail"
        value=""
        onChangeText={() => {}}
        autoComplete="email"
        textContentType="emailAddress"
      />,
    )
    expect(screen.getByLabelText('E-mail')).toHaveProp('importantForAutofill', 'yes')
    expect(screen.getByLabelText('E-mail')).toHaveProp('textContentType', 'emailAddress')
  })

  test('ao lado de um botão, o botão vira peça do campo: 56 e o raio do campo, não cápsula', async () => {
    await render(
      <Campo
        rotulo="Código"
        value=""
        onChangeText={() => {}}
        botao={<Botao titulo="Colar" variante="secundario" aoPressionar={() => {}} />}
      />,
    )
    expect(screen.getByRole('button', { name: 'Colar' })).toHaveStyle({
      minHeight: 56,
      borderRadius: 16,
    })
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
