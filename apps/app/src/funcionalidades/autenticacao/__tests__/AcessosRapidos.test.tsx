/**
 * D60: presença dos acessos rápidos por plataforma, o que o clique dispara em
 * cada provedor e as mensagens humanas quando o provedor falha.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform } from 'react-native'

import { ProvedorDeSessao } from '@/estado/sessao'
import { clienteDeConsultaDeTeste } from '@/testes/dubles'

import { AcessosRapidos } from '../provedores/AcessosRapidos'
import { pedirCredencialDaApple } from '../provedores/BotaoApple'
import { EntradaComProvedores } from '../provedores/EntradaComProvedores'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }))

const disponivelNaApple = AppleAuthentication.isAvailableAsync as jest.Mock
const entrarNaApple = AppleAuthentication.signInAsync as jest.Mock
const google = jest.requireMock('@react-native-google-signin/google-signin') as {
  GoogleSignin: { signIn: jest.Mock }
  __responder: (r: unknown) => void
}

function acessos(sobrescrever: Partial<Parameters<typeof AcessosRapidos>[0]> = {}) {
  return (
    <AcessosRapidos
      carregando={null}
      aoObterTokenDoGoogle={jest.fn()}
      aoPedirApple={jest.fn()}
      aoFalhar={jest.fn()}
      {...sobrescrever}
    />
  )
}

function limparAmbiente() {
  jest.clearAllMocks()
  disponivelNaApple.mockResolvedValue(false)
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
}

const ID_IOS = 'ios-123.apps.googleusercontent.com'

describe('acessos rápidos por plataforma', () => {
  beforeEach(limparAmbiente)
  afterEach(() => jest.restoreAllMocks())

  test('iOS com tudo: Apple primeiro, Google depois, os dois em português', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
    disponivelNaApple.mockResolvedValue(true)
    await render(acessos())
    await screen.findByRole('button', { name: 'Continuar com a Apple' })
    const botoes = screen.getAllByRole('button')
    expect(botoes.map((b) => b.props.accessibilityLabel)).toEqual([
      'Continuar com a Apple',
      'Continuar com o Google',
    ])
  })

  test('Android: só o Google, e a Apple nem é consultada', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = 'android-123.apps.googleusercontent.com'
    disponivelNaApple.mockResolvedValue(true)
    await render(acessos())
    await act(async () => undefined)
    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull()
    expect(disponivelNaApple).not.toHaveBeenCalled()
  })

  test('web: o Google aparece quando há o ID web; a Apple não existe na web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-123.apps.googleusercontent.com'
    await render(acessos())
    await act(async () => undefined)
    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull()
  })

  test('sem nada configurado, nenhum botão', async () => {
    await render(acessos())
    await act(async () => undefined)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  test('a Apple tocada chama o fluxo da Apple; enquanto ela trabalha, o Google fica inativo', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
    disponivelNaApple.mockResolvedValue(true)
    const aoPedirApple = jest.fn()
    const { rerender } = await render(acessos({ aoPedirApple }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
    expect(aoPedirApple).toHaveBeenCalledTimes(1)

    await rerender(acessos({ aoPedirApple, carregando: 'apple' }))
    expect(screen.getByRole('button', { name: 'Continuar com a Apple' })).toBeBusy()
    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeDisabled()
  })

  test('o Google tocado abre o login do Google e entrega o ID token', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
    const aoObterTokenDoGoogle = jest.fn()
    await render(acessos({ aoObterTokenDoGoogle }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await act(async () => {
      google.__responder({ type: 'success', data: { idToken: 'token-do-google' } })
    })
    expect(google.GoogleSignin.signIn).toHaveBeenCalled()
    expect(aoObterTokenDoGoogle).toHaveBeenCalledWith('token-do-google')
  })

  test('o Google falhou: a mensagem é humana, sem termo técnico', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
    const aoFalhar = jest.fn()
    google.GoogleSignin.signIn.mockRejectedValueOnce(new Error('DEVELOPER_ERROR 10'))
    await render(acessos({ aoFalhar }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await waitFor(() =>
      expect(aoFalhar).toHaveBeenCalledWith(
        'Não foi possível entrar com o Google. Confira sua conexão e tente de novo.',
      ),
    )
  })

  test('cancelar no Google não é erro', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
    const aoFalhar = jest.fn()
    google.GoogleSignin.signIn.mockRejectedValueOnce({ code: 'SIGN_IN_CANCELLED' })
    await render(acessos({ aoFalhar }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await act(async () => undefined)
    expect(aoFalhar).not.toHaveBeenCalled()
  })
})

describe('credencial da Apple', () => {
  beforeEach(limparAmbiente)

  test('entrar e criar conta pedem também o nome; o nome vai junto quando a Apple o entrega', async () => {
    entrarNaApple.mockResolvedValue({
      identityToken: 'token-da-apple',
      fullName: { givenName: 'Ana', familyName: 'Souza' },
    })
    const credencial = await pedirCredencialDaApple({ comNome: true })
    expect(credencial?.nome).toBe('Ana Souza')
    const pedido = entrarNaApple.mock.calls[0]![0] as { requestedScopes: number[] }
    expect(pedido.requestedScopes).toEqual([
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ])
  })

  test('sem o nome (a Apple só o entrega na primeira vez), a credencial vai sem a chave', async () => {
    entrarNaApple.mockResolvedValue({ identityToken: 'token-da-apple', fullName: null })
    const credencial = await pedirCredencialDaApple({ comNome: true })
    expect(credencial).not.toHaveProperty('nome')
  })

  test('confirmações (excluir conta, conectar) não pedem o nome', async () => {
    entrarNaApple.mockResolvedValue({ identityToken: 'token-da-apple' })
    await pedirCredencialDaApple()
    const pedido = entrarNaApple.mock.calls[0]![0] as { requestedScopes: number[] }
    expect(pedido.requestedScopes).toEqual([AppleAuthentication.AppleAuthenticationScope.EMAIL])
  })

  test('cancelar na folha da Apple devolve nulo, sem erro', async () => {
    entrarNaApple.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' })
    await expect(pedirCredencialDaApple()).resolves.toBeNull()
  })
})

describe('EntradaComProvedores (cadastro)', () => {
  beforeEach(limparAmbiente)

  function entrada() {
    return (
      <QueryClientProvider client={clienteDeConsultaDeTeste()}>
        <ProvedorDeSessao>
          <EntradaComProvedores separador="ou crie com e-mail" />
        </ProvedorDeSessao>
      </QueryClientProvider>
    )
  }

  test('sem provedor, não desenha nada (nem o separador)', async () => {
    await render(entrada())
    await act(async () => undefined)
    expect(screen.queryByText('ou crie com e-mail')).toBeNull()
  })

  test('com provedor, os botões vêm junto do separador', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = ID_IOS
    await render(entrada())
    expect(await screen.findByRole('button', { name: 'Continuar com o Google' })).toBeOnTheScreen()
    expect(screen.getByText('ou crie com e-mail')).toBeOnTheScreen()
  })
})
