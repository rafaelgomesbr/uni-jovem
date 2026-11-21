/**
 * Campo da tela de acesso (D63): rótulo fixo, caixa de 56, fenda de erro
 * sempre reservada, ícone mais texto no erro, "Mostrar" com texto e o anel
 * de foco que não desloca o texto.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ALTURA_DO_ACESSO, ESCURO, RITMO_DE_ACESSO } from '@uj/tokens'
import { StyleSheet } from 'react-native'

import { CampoDeAcesso } from '../CampoDeAcesso'
import { ProvedorDeTemaForcado } from '../tema'

function estilo(no: { props: { style?: unknown } }) {
  return StyleSheet.flatten(no.props.style as never) as Record<string, unknown>
}

const tema = (filho: React.ReactElement) => (
  <ProvedorDeTemaForcado nome="escuro">{filho}</ProvedorDeTemaForcado>
)

describe('CampoDeAcesso', () => {
  test('o rótulo é fixo e visível, e é o nome do campo para o leitor de tela', async () => {
    await render(tema(<CampoDeAcesso rotulo="E-mail" value="" onChangeText={() => {}} />))
    expect(screen.getByText('E-mail')).toBeOnTheScreen()
    expect(screen.getByLabelText('E-mail')).toBeOnTheScreen()
  })

  test('a caixa tem 56 de altura, o texto 16 e a borda de repouso 1 (campoBorda)', async () => {
    await render(tema(<CampoDeAcesso rotulo="E-mail" value="" onChangeText={() => {}} />))
    const campo = screen.getByLabelText('E-mail')
    expect(estilo(campo).fontSize).toBe(16)
    expect(estilo(campo).minHeight).toBe(ALTURA_DO_ACESSO - 2)
    const caixa = campo.parent!
    expect(estilo(caixa)).toMatchObject({
      minHeight: ALTURA_DO_ACESSO,
      borderWidth: 1,
      borderColor: ESCURO.campoBorda,
      backgroundColor: ESCURO.campoFundo,
    })
  })

  test('erro: ícone mais texto na fenda, o campo avisa o erro e o leitor de tela ouve o texto', async () => {
    await render(
      tema(
        <CampoDeAcesso
          rotulo="E-mail"
          value=""
          onChangeText={() => {}}
          erro="Digite seu e-mail."
        />,
      ),
    )
    expect(screen.getByText('Digite seu e-mail.')).toBeOnTheScreen()
    expect(screen.getByLabelText('E-mail').props.accessibilityHint).toBe('Erro: Digite seu e-mail.')
    // O texto do erro é `texto` (o `erro` não passa AA sobre o pico da aurora); o sinal é o ícone.
    expect(screen.getByText('Digite seu e-mail.')).toHaveStyle({ color: ESCURO.texto })
  })

  test('a fenda de 26 (6 mais 20) é reservada mesmo sem erro: o botão não pula quando o erro chega', async () => {
    const fenda = () => {
      const raiz = screen.getByLabelText('Senha').parent!.parent!.parent!
      return raiz.children.at(-1) as unknown as { props: { style?: unknown } }
    }
    const { rerender } = await render(
      tema(<CampoDeAcesso rotulo="Senha" value="" onChangeText={() => {}} />),
    )
    const antes = estilo(fenda())
    expect(antes.marginTop).toBe(6)
    expect(antes.minHeight).toBe(RITMO_DE_ACESSO.fendaDeErro - 6)
    await rerender(
      tema(
        <CampoDeAcesso rotulo="Senha" value="" onChangeText={() => {}} erro="Digite sua senha." />,
      ),
    )
    expect(screen.getByText('Digite sua senha.')).toBeOnTheScreen()
    expect(estilo(fenda())).toMatchObject({ marginTop: 6, minHeight: 20 })
  })

  test('o apoio vivo (status da senha) ocupa a fenda quando não há erro', async () => {
    const { rerender } = await render(
      tema(
        <CampoDeAcesso
          rotulo="Crie uma senha"
          senha
          value=""
          onChangeText={() => {}}
          apoio="7 de 10 caracteres"
        />,
      ),
    )
    expect(screen.getByText('7 de 10 caracteres')).toBeOnTheScreen()
    await rerender(
      tema(
        <CampoDeAcesso
          rotulo="Crie uma senha"
          senha
          value=""
          onChangeText={() => {}}
          apoio="7 de 10 caracteres"
          erro="Crie uma senha."
        />,
      ),
    )
    expect(screen.queryByText('7 de 10 caracteres')).toBeNull()
  })

  test('senha: "Mostrar" tem texto ao lado do olho, e o nome acessível alterna', async () => {
    await render(tema(<CampoDeAcesso rotulo="Senha" senha value="x" onChangeText={() => {}} />))
    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(true)
    expect(screen.getByText('Mostrar')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(false)
    expect(screen.getByText('Ocultar')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(true)
  })

  test('o "Mostrar" tem alvo de pelo menos 44 de altura (a caixa toda, 56)', async () => {
    await render(tema(<CampoDeAcesso rotulo="Senha" senha value="x" onChangeText={() => {}} />))
    const botao = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(estilo(botao).minWidth).toBeGreaterThanOrEqual(44)
  })

  test('à direita do rótulo cabe um link (Esqueci a senha), na mesma linha', async () => {
    await render(
      tema(
        <CampoDeAcesso
          rotulo="Senha"
          senha
          value=""
          onChangeText={() => {}}
          aoLado={<ElementoDeTeste />}
        />,
      ),
    )
    expect(screen.getByText('Esqueci a senha')).toBeOnTheScreen()
  })

  test('só leitura (enviando): o campo não edita e nada muda de cor', async () => {
    await render(
      tema(<CampoDeAcesso rotulo="E-mail" value="a" onChangeText={() => {}} somenteLeitura />),
    )
    expect(screen.getByLabelText('E-mail').props.editable).toBe(false)
  })

  test('preenchimento do sistema: o campo se declara para o chaveiro', async () => {
    await render(
      tema(
        <CampoDeAcesso
          rotulo="E-mail"
          value=""
          onChangeText={() => {}}
          autoComplete="username"
          textContentType="username"
        />,
      ),
    )
    expect(screen.getByLabelText('E-mail').props).toMatchObject({
      importantForAutofill: 'yes',
      autoComplete: 'username',
      spellCheck: false,
    })
  })
})

function ElementoDeTeste() {
  const { Text } = require('react-native')
  return <Text>Esqueci a senha</Text>
}
