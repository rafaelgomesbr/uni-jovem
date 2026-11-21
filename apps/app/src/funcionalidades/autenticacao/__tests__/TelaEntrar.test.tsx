import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { Platform, StyleSheet } from 'react-native'

import { ProvedorDeSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { ligarBiometria, trancarCofre } from '@/servicos/armazenamentoDoRefresh'
import { clienteDeConsultaDeTeste, servidorFalso } from '@/testes/dubles'

import { TelaEntrar } from '../TelaEntrar'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }))

const MENSAGEM = 'E-mail ou senha incorretos.'

const cofre = (SecureStore as unknown as { __cofre: Map<string, string> }).__cofre
const lerSeguro = SecureStore.getItemAsync as jest.Mock
const lerSeguroOriginal = lerSeguro.getMockImplementation()!
const disponivelNaApple = AppleAuthentication.isAvailableAsync as jest.Mock
const entrarNaApple = AppleAuthentication.signInAsync as jest.Mock
const google = jest.requireMock('@react-native-google-signin/google-signin') as {
  __responder: (r: unknown) => void
}

const EU = {
  conta: {
    id: 'conta-1',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    whatsapp: null,
    criador: false,
    doisFatores: false,
  },
  comunidades: [],
}
const SESSAO = { segundoFator: false, acesso: 'acesso-1', refresh: 'refresh-novo' }

function renderizar() {
  const consultas = clienteDeConsultaDeTeste()
  return render(
    <QueryClientProvider client={consultas}>
      <ProvedorDeSessao>
        <TelaEntrar />
      </ProvedorDeSessao>
    </QueryClientProvider>,
  )
}

describe('tela Entrar', () => {
  const fetchOriginal = globalThis.fetch
  beforeEach(async () => {
    jest.clearAllMocks()
    await api.encerrarSessao()
    cofre.clear()
    trancarCofre()
    lerSeguro.mockImplementation(lerSeguroOriginal)
    disponivelNaApple.mockResolvedValue(false)
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    delete process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
    jest.restoreAllMocks()
  })

  test('mostra a mensagem de credenciais inválidas que veio da API', async () => {
    const servidor = servidorFalso({
      'POST /api/auth/entrar': () => ({
        status: 401,
        corpo: { erro: 'credenciais_invalidas', mensagem: MENSAGEM },
      }),
    })
    globalThis.fetch = servidor.fetch
    const usuario = userEvent.setup()
    await renderizar()

    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@exemplo.com')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha errada demais')
    await usuario.press(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(MENSAGEM)).toBeOnTheScreen()
    expect(servidor.pedidos[0]?.corpo).toMatchObject({
      email: 'ana@exemplo.com',
      senha: 'senha errada demais',
      plataforma: 'ios',
    })
    expect(router.push).not.toHaveBeenCalled()
  })

  test('sem preencher, aponta os campos sem ir à rede', async () => {
    const servidor = servidorFalso({})
    globalThis.fetch = servidor.fetch
    await renderizar()

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Entrar' }))

    expect(screen.getByText('Informe seu e-mail.')).toBeOnTheScreen()
    expect(screen.getByText('Informe sua senha.')).toBeOnTheScreen()
    expect(servidor.pedidos).toHaveLength(0)
  })

  test('com verificação em duas etapas, segue para a tela do código', async () => {
    const servidor = servidorFalso({
      'POST /api/auth/entrar': () => ({
        status: 200,
        corpo: { segundoFator: true, desafio: 'desafio-longo-o-bastante' },
      }),
    })
    globalThis.fetch = servidor.fetch
    const usuario = userEvent.setup()
    await renderizar()

    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@exemplo.com')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'uma frase longa')
    await usuario.press(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/segundo-fator'))
  })

  test('sem IDs do Google e sem a Apple disponível: só e-mail e senha', async () => {
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    await screen.findByLabelText('E-mail')
    expect(screen.queryByRole('button', { name: 'Continuar com o Google' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Continuar com a Apple' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Entrar com Face ID/ })).toBeNull()
  })

  test('com o ID do Google do iOS, o botão aparece e o ID token vai para a API', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com'
    const servidor = servidorFalso({
      'POST /api/auth/provedor/google': () => ({ status: 200, corpo: SESSAO }),
      'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
    })
    globalThis.fetch = servidor.fetch
    await renderizar()

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await act(async () => {
      google.__responder({ type: 'success', data: { idToken: 'token-do-google' } })
    })

    await waitFor(() =>
      expect(servidor.pedidos.find((p) => p.url.endsWith('/provedor/google'))?.corpo).toMatchObject(
        { idToken: 'token-do-google', plataforma: 'ios' },
      ),
    )
  })

  test('conta Google sem convite: mostra a mensagem da API pedindo convite', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com'
    const mensagem = 'Não encontramos uma conta do Uni Jovem ligada a esta conta Google.'
    globalThis.fetch = servidorFalso({
      'POST /api/auth/provedor/google': () => ({
        status: 401,
        corpo: { erro: 'conta_nao_encontrada', mensagem },
      }),
    }).fetch
    await renderizar()
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await act(async () => {
      google.__responder({ type: 'success', data: { idToken: 'token-sem-conta' } })
    })
    expect(await screen.findByText(mensagem)).toBeOnTheScreen()
  })

  test('no iOS com a Apple disponível: botão em português, e o nonce cru vai junto do token', async () => {
    disponivelNaApple.mockResolvedValue(true)
    entrarNaApple.mockResolvedValue({ identityToken: 'token-da-apple' })
    const servidor = servidorFalso({
      'POST /api/auth/provedor/apple': () => ({ status: 200, corpo: SESSAO }),
      'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
    })
    globalThis.fetch = servidor.fetch
    await renderizar()

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))

    await waitFor(() => expect(servidor.pedidos.some((p) => p.url.endsWith('/apple'))).toBe(true))
    const corpo = servidor.pedidos.find((p) => p.url.endsWith('/apple'))!.corpo as {
      identityToken: string
      nonce: string
    }
    expect(corpo.identityToken).toBe('token-da-apple')
    // A Apple recebeu o SHA-256 do nonce; a API recebe o cru e confere o par.
    const pedidoAApple = entrarNaApple.mock.calls[0]![0] as { nonce: string }
    expect(pedidoAApple.nonce).toBe(
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, corpo.nonce),
    )
    expect(corpo.nonce).not.toBe(pedidoAApple.nonce)
  })

  test('no Android, sem botão da Apple mesmo que o módulo diga que existe', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    disponivelNaApple.mockResolvedValue(true)
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    await screen.findByLabelText('E-mail')
    await act(async () => undefined)
    expect(screen.queryByRole('button', { name: 'Continuar com a Apple' })).toBeNull()
    expect(disponivelNaApple).not.toHaveBeenCalled()
  })

  test('o topo traz a marca, o título e a frase de apoio, e o título é cabeçalho', async () => {
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    expect(await screen.findByRole('header', { name: 'Bem-vindo de volta' })).toBeOnTheScreen()
    expect(screen.getByText(/Entre para ver a agenda/)).toBeOnTheScreen()
  })

  test('a ordem na tela: acessos rápidos, "ou com e-mail", campos, Entrar, Criar conta e convite', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com'
    disponivelNaApple.mockResolvedValue(true)
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    await screen.findByRole('button', { name: 'Continuar com a Apple' })

    const nomes = screen
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel as string)
      .filter((n) => n !== 'Mostrar senha')
    expect(nomes).toEqual([
      'Continuar com a Apple',
      'Continuar com o Google',
      'Esqueci a senha',
      'Entrar',
      'Criar conta',
      'Tenho um link de convite',
    ])
    expect(screen.getByText('ou com e-mail')).toBeOnTheScreen()
  })

  test('sem acesso rápido, não há "ou com e-mail": o formulário abre a tela', async () => {
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    await screen.findByLabelText('E-mail')
    expect(screen.queryByText('ou com e-mail')).toBeNull()
  })

  test('Android: Google e e-mail, sem a Apple', async () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = 'android-123.apps.googleusercontent.com'
    disponivelNaApple.mockResolvedValue(true)
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    expect(await screen.findByRole('button', { name: 'Continuar com o Google' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull()
    expect(screen.getByText('ou com e-mail')).toBeOnTheScreen()
    expect(screen.getByLabelText('E-mail')).toBeOnTheScreen()
  })

  test('campos: teclado, preenchimento automático e senha com mostrar e ocultar', async () => {
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    const email = await screen.findByLabelText('E-mail')
    expect(email.props).toMatchObject({
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      autoComplete: 'username',
      textContentType: 'username',
    })
    const senha = screen.getByLabelText('Senha')
    expect(senha.props).toMatchObject({
      autoComplete: 'current-password',
      textContentType: 'password',
      secureTextEntry: true,
    })
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha').props.secureTextEntry).toBe(false)
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeOnTheScreen()
  })

  test('rodapé: Criar conta e o link de convite levam às telas certas', async () => {
    globalThis.fetch = servidorFalso({}).fetch
    const usuario = userEvent.setup()
    await renderizar()
    await usuario.press(await screen.findByRole('button', { name: 'Criar conta' }))
    expect(router.push).toHaveBeenCalledWith('/criar-conta')
    await usuario.press(screen.getByRole('button', { name: 'Tenho um link de convite' }))
    expect(router.push).toHaveBeenCalledWith('/colar-convite')
  })

  test('a Apple entrega o nome na primeira vez e ele vai para a API junto do token', async () => {
    disponivelNaApple.mockResolvedValue(true)
    entrarNaApple.mockResolvedValue({
      identityToken: 'token-da-apple',
      fullName: { givenName: 'Ana', familyName: 'Souza' },
    })
    const servidor = servidorFalso({
      'POST /api/auth/provedor/apple': () => ({
        status: 200,
        corpo: {
          cadastroPendente: true,
          tokenDeCadastro: 'token-de-cadastro',
          nome: 'Ana Souza',
          email: 'ana@exemplo.com',
        },
      }),
    })
    globalThis.fetch = servidor.fetch
    await renderizar()
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/completar-cadastro'))
    expect(servidor.pedidos.find((p) => p.url.endsWith('/provedor/apple'))?.corpo).toMatchObject({
      identityToken: 'token-da-apple',
      nome: 'Ana Souza',
    })
  })

  test('a Apple falhou: mensagem humana perto dos botões, sem termo técnico', async () => {
    disponivelNaApple.mockResolvedValue(true)
    entrarNaApple.mockRejectedValue(new Error('ASAuthorizationError 1000'))
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent(/Não deu certo/)
    expect(screen.queryByText(/ASAuthorization/)).toBeNull()
  })

  test('cancelar na folha da Apple não mostra erro', async () => {
    disponivelNaApple.mockResolvedValue(true)
    entrarNaApple.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' })
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
    await act(async () => undefined)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('todo botão tem nome acessível e nenhum alvo é menor que 44', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com'
    disponivelNaApple.mockResolvedValue(true)
    globalThis.fetch = servidorFalso({}).fetch
    await renderizar()
    await screen.findByRole('button', { name: 'Continuar com a Apple' })
    for (const botao of screen.getAllByRole('button')) {
      expect(botao.props.accessibilityLabel).toBeTruthy()
      const e = StyleSheet.flatten(botao.props.style as never) as { minHeight?: number }
      expect(e?.minHeight ?? 44).toBeGreaterThanOrEqual(44)
    }
  })

  test('sessão trancada pelo Face ID: cancelar mostra "Entrar com Face ID", e ele abre a sessão', async () => {
    // Aparelho com a biometria ligada e o app recém-aberto (chave fora da memória).
    cofre.set('uj.refresh', 'refresh-guardado')
    await ligarBiometria()
    trancarCofre()
    let recusar = true
    lerSeguro.mockImplementation(
      async (chave: string, opcoes?: { requireAuthentication?: boolean }) => {
        if (opcoes?.requireAuthentication && recusar) throw new Error('cancelado')
        return lerSeguroOriginal(chave, opcoes)
      },
    )
    const servidor = servidorFalso({
      'POST /api/auth/renovar': () => ({ status: 200, corpo: SESSAO }),
      'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
    })
    globalThis.fetch = servidor.fetch
    await renderizar()

    const botao = await screen.findByRole('button', { name: 'Entrar com Face ID' })
    expect(servidor.pedidos).toHaveLength(0)
    // A senha continua como alternativa na mesma tela.
    expect(screen.getByLabelText('Senha')).toBeOnTheScreen()

    recusar = false
    await userEvent.setup().press(botao)
    await waitFor(() =>
      expect(servidor.pedidos.find((p) => p.url.endsWith('/renovar'))?.corpo).toEqual({
        refresh: 'refresh-guardado',
      }),
    )
  })
})
