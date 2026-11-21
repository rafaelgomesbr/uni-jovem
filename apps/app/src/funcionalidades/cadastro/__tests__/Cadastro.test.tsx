import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import type { ReactElement } from 'react'
import { View } from 'react-native'

import { ProvedorDeSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { clienteDeConsultaDeTeste, servidorFalso, type Rota } from '@/testes/dubles'

import { TelaEntrar } from '../../autenticacao/TelaEntrar'
import { marcarMenorDe16 } from '../../convite/travaDeIdade'
import { TelaCompletarCadastro } from '../TelaCompletarCadastro'
import { TelaCriarConta } from '../TelaCriarConta'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  useIsFocused: jest.fn(() => true),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

const cofre = (SecureStore as unknown as { __cofre: Map<string, string> }).__cofre
const google = jest.requireMock('@react-native-google-signin/google-signin') as {
  __responder: (r: unknown) => void
}

const EU = {
  conta: {
    id: 'conta-nova',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    whatsapp: null,
    criador: false,
    doisFatores: false,
  },
  comunidades: [],
}
const SESSAO = { segundoFator: false, acesso: 'acesso-1', refresh: 'refresh-1' }
const SENHA = 'uma frase bem longa'

async function renderizar(ui: ReactElement, rotas: Record<string, Rota>) {
  const servidor = servidorFalso({ 'GET /api/v1/eu': () => ({ status: 200, corpo: EU }), ...rotas })
  globalThis.fetch = servidor.fetch
  await render(
    <QueryClientProvider client={clienteDeConsultaDeTeste()}>
      <ProvedorDeSessao>{ui}</ProvedorDeSessao>
    </QueryClientProvider>,
  )
  return servidor
}

const corpoDe = (servidor: ReturnType<typeof servidorFalso>, caminho: string) =>
  servidor.pedidos.find((p) => p.url.endsWith(caminho))?.corpo

describe('Criar conta (D63): e-mail e senha, depois "Falta pouco"', () => {
  const fetchOriginal = globalThis.fetch
  beforeEach(async () => {
    jest.clearAllMocks()
    await api.encerrarSessao()
    cofre.clear()
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
  })

  async function preencherDados(senha = SENHA) {
    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@exemplo.com')
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), senha)
  }

  async function preencherFaltaPouco(faixa: RegExp | string = 'Tenho 18 anos ou mais.') {
    await fireEvent.changeText(await screen.findByLabelText('Como você se chama?'), 'Ana Souza')
    await fireEvent.press(screen.getByRole('radio', { name: faixa }))
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Li e concordo com os Termos de Uso e a Política de Privacidade.',
      }),
    )
  }

  test('dois passos: e-mail e senha juntos, depois nome, idade e Termos; uma só chamada cria a conta e abre a sessão', async () => {
    const servidor = await renderizar(<TelaCriarConta />, {
      'POST /api/auth/cadastro/criar': () => ({ status: 200, corpo: SESSAO }),
    })
    expect(await screen.findByRole('header', { name: 'Crie sua conta' })).toBeOnTheScreen()
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByRole('header', { name: 'Falta pouco' })).toBeOnTheScreen()
    // TC-01.v2: o aviso de que conta de menor de 16 é encerrada continua ali, palavra por palavra.
    expect(screen.getByText(/conta de quem tem menos de 16 anos é encerrada/)).toBeOnTheScreen()
    // Nada foi enviado antes da segunda tela.
    expect(servidor.pedidos.filter((p) => p.url.includes('/cadastro/'))).toHaveLength(0)
    await preencherFaltaPouco(/^Tenho 16 ou 17 anos/)
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() =>
      expect(servidor.pedidos.some((p) => p.url.endsWith('/api/v1/eu'))).toBe(true),
    )
    expect(corpoDe(servidor, '/cadastro/criar')).toMatchObject({
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      faixaEtaria: '16_17',
      // A opção de 16 ou 17 anos já declara que o responsável sabe e concorda (TC-01.v2).
      aceites: { termos: true, responsavelCiente: true },
      senha: SENHA,
    })
    expect(servidor.pedidos.some((p) => p.url.includes('/iniciar'))).toBe(false)
  })

  test('o campo da senha é de senha nova e não pede "repita a senha": o Mostrar o substitui', async () => {
    await renderizar(<TelaCriarConta />, {})
    const campo = await screen.findByLabelText('Crie uma senha')
    expect(campo.props).toMatchObject({
      autoComplete: 'new-password',
      textContentType: 'newPassword',
      secureTextEntry: true,
    })
    expect(screen.getByLabelText('E-mail').props).toMatchObject({
      autoComplete: 'email',
      textContentType: 'emailAddress',
    })
    expect(screen.queryByLabelText('Repita a senha')).toBeNull()
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeOnTheScreen()
  })

  test('o status da senha é vivo e em texto: quanto falta e, ao chegar, "Senha boa."', async () => {
    await renderizar(<TelaCriarConta />, {})
    expect(
      await screen.findByText('Pelo menos 10 caracteres. Uma frase curta funciona bem.'),
    ).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'curta123')
    expect(screen.getByText('8 de 10 caracteres')).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'frase bem longa')
    expect(screen.getByText('Senha boa.')).toBeOnTheScreen()
  })

  test('e-mail incompleto, senha curta ou parecida com o e-mail: o erro diz o que fazer, sem sair da tela', async () => {
    const servidor = await renderizar(<TelaCriarConta />, {})
    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@')
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'curta123')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(
      await screen.findByText(
        'Esse e-mail parece incompleto. Confira se tem @ e o final, como nome@exemplo.com.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByText('Faltam 2 caracteres. Use pelo menos 10; uma frase curta funciona.'),
    ).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'mariana@exemplo.com')
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'minhamariana2026')
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect(
      await screen.findByText(
        'Essa senha lembra seu e-mail ou seu nome. Escolha uma que só você saiba.',
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('header', { name: 'Falta pouco' })).toBeNull()
    expect(servidor.pedidos).toHaveLength(0)
  })

  test('voltar de "Falta pouco" não perde o que foi digitado', async () => {
    await renderizar(<TelaCriarConta />, {})
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.changeText(await screen.findByLabelText('Como você se chama?'), 'Ana')
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect((await screen.findByLabelText('E-mail')).props.value).toBe('ana@exemplo.com')
    expect(screen.getByLabelText('Crie uma senha').props.value).toBe(SENHA)
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    expect((await screen.findByLabelText('Como você se chama?')).props.value).toBe('Ana')
  })

  test('senha recusada pela API volta para a primeira tela, com o erro e sem perder os dados', async () => {
    await renderizar(<TelaCriarConta />, {
      'POST /api/auth/cadastro/criar': () => ({
        status: 400,
        corpo: { erro: 'senha_fraca', mensagem: 'Escolha uma senha mais forte.' },
      }),
    })
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await preencherFaltaPouco()
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Escolha uma senha mais forte.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Crie uma senha').props.value).toBe(SENHA)
    expect(screen.getByLabelText('E-mail').props.value).toBe('ana@exemplo.com')
  })

  test('e-mail que já tem conta: volta ao e-mail com "Este e-mail já tem conta." e as saídas Entrar e Esqueci a senha', async () => {
    await renderizar(<TelaCriarConta />, {
      'POST /api/auth/cadastro/criar': () => ({
        status: 409,
        corpo: { erro: 'conta_existente', mensagem: 'Este e-mail já tem conta.' },
      }),
    })
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await preencherFaltaPouco()
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Este e-mail já tem conta.')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Esqueci a senha' }))
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/recuperar-senha',
      params: { email: 'ana@exemplo.com' },
    })
    await fireEvent.press(screen.getAllByRole('button', { name: 'Entrar' })[0]!)
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/entrar',
      params: { modo: 'email', email: 'ana@exemplo.com' },
    })
  })

  test('"Já tem conta? Entrar" leva ao e-mail da entrada, com o e-mail já digitado', async () => {
    await renderizar(<TelaCriarConta />, {})
    await fireEvent.changeText(await screen.findByLabelText('E-mail'), 'ana@exemplo.com')
    await fireEvent.press(screen.getByRole('button', { name: 'Já tem conta? Entrar' }))
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/entrar',
      params: { modo: 'email', email: 'ana@exemplo.com' },
    })
  })

  test('não fala em confirmar e-mail nem em código (ADR 0008)', async () => {
    await renderizar(<TelaCriarConta />, {})
    await screen.findByRole('header', { name: 'Crie sua conta' })
    expect(screen.queryByText(/confirmar o e-mail/i)).toBeNull()
    expect(screen.queryByText(/código/i)).toBeNull()
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('header', { name: 'Falta pouco' })
    expect(screen.queryByText(/confirmar/i)).toBeNull()
    expect(screen.queryByText(/código/i)).toBeNull()
  })

  test('menos de 16: a mensagem da TC-01.v2 e nenhum botão para criar', async () => {
    await renderizar(<TelaCriarConta />, {})
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tenho menos de 16 anos.' }))
    expect(
      screen.getByText(/seu pai, sua mãe ou seu responsável pode inscrever você/),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull()
  })

  test('Criar conta fica desabilitado, com o motivo escrito, até a idade e os Termos', async () => {
    await renderizar(<TelaCriarConta />, {})
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('header', { name: 'Falta pouco' })
    const criar = screen.getByRole('button', { name: 'Criar conta' })
    expect(criar).toBeDisabled()
    expect(screen.getByText('Responda quantos anos você tem.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('radio', { name: 'Tenho 18 anos ou mais.' }))
    expect(
      screen.getByText('Para criar a conta, é preciso concordar com os Termos de Uso.'),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Li e concordo com os Termos de Uso e a Política de Privacidade.',
      }),
    )
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled()
  })

  test('aparelho travado: o cadastro não abre', async () => {
    await marcarMenorDe16()
    await renderizar(<TelaCriarConta />, {})
    expect(await screen.findByText('Ainda não dá para criar a conta')).toBeOnTheScreen()
    expect(screen.queryByLabelText('E-mail')).toBeNull()
  })
})

describe('Google ou Apple com e-mail novo: "Falta pouco"', () => {
  const fetchOriginal = globalThis.fetch
  beforeEach(async () => {
    jest.clearAllMocks()
    await api.encerrarSessao()
    cofre.clear()
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com'
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  })

  const PENDENTE = {
    cadastroPendente: true,
    tokenDeCadastro: 'token-de-cadastro',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
  }

  test('a API devolve cadastroPendente; idade e aceites concluem com o token', async () => {
    const servidor = await renderizar(
      <View>
        <TelaEntrar />
        <TelaCompletarCadastro />
      </View>,
      {
        'POST /api/auth/provedor/google': () => ({ status: 200, corpo: PENDENTE }),
        'POST /api/auth/provedor/concluir-cadastro': () => ({ status: 200, corpo: SESSAO }),
      },
    )
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await act(async () => {
      google.__responder({ type: 'success', data: { idToken: 'token-do-google' } })
    })
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/completar-cadastro'))
    // A mesma tela de quem criou a conta por e-mail, sem pedir o nome (o Google o entregou).
    expect(await screen.findByRole('header', { name: 'Falta pouco' })).toBeOnTheScreen()
    expect(
      screen.getByText('Olá, Ana Souza. Vamos criar sua conta com ana@exemplo.com.'),
    ).toBeOnTheScreen()
    expect(screen.queryByLabelText('Como você se chama?')).toBeNull()

    await fireEvent.press(screen.getByRole('radio', { name: 'Tenho 18 anos ou mais.' }))
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Li e concordo com os Termos de Uso e a Política de Privacidade.',
      }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() =>
      expect(corpoDe(servidor, '/provedor/concluir-cadastro')).toMatchObject({
        tokenDeCadastro: 'token-de-cadastro',
        faixaEtaria: '18_mais',
        aceites: { termos: true },
      }),
    )
  })

  test('Apple: o nome vem junto, a conta nasce sem código nem e-mail de confirmação e o texto não o menciona', async () => {
    ;(AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true)
    ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: 'token-da-apple',
      fullName: { givenName: 'Ana', familyName: 'Souza' },
    })
    const servidor = await renderizar(
      <View>
        <TelaEntrar />
        <TelaCompletarCadastro />
      </View>,
      {
        'POST /api/auth/provedor/apple': () => ({ status: 200, corpo: PENDENTE }),
        'POST /api/auth/provedor/concluir-cadastro': () => ({ status: 200, corpo: SESSAO }),
      },
    )
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com a Apple' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/completar-cadastro'))
    expect(corpoDe(servidor, '/provedor/apple')).toMatchObject({
      identityToken: 'token-da-apple',
      nome: 'Ana Souza',
    })
    expect(await screen.findByRole('header', { name: 'Falta pouco' })).toBeOnTheScreen()
    expect(screen.queryByText(/confirmou seu e-mail/)).toBeNull()

    await fireEvent.press(screen.getByRole('radio', { name: 'Tenho 18 anos ou mais.' }))
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Li e concordo com os Termos de Uso e a Política de Privacidade.',
      }),
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() =>
      expect(corpoDe(servidor, '/provedor/concluir-cadastro')).toMatchObject({
        tokenDeCadastro: 'token-de-cadastro',
        faixaEtaria: '18_mais',
      }),
    )
    // A conta nova abre a sessão; sem comunidade, o Início mostra "Comece por aqui" (teste próprio).
    await waitFor(() =>
      expect(servidor.pedidos.some((p) => p.url.endsWith('/api/v1/eu'))).toBe(true),
    )
    ;(AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false)
  })

  test('menos de 16 pelo Google: nada é criado e o token do cadastro é descartado', async () => {
    const servidor = await renderizar(
      <View>
        <TelaEntrar />
        <TelaCompletarCadastro />
      </View>,
      { 'POST /api/auth/provedor/google': () => ({ status: 200, corpo: PENDENTE }) },
    )
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await act(async () => {
      google.__responder({ type: 'success', data: { idToken: 'token-do-google' } })
    })
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tenho menos de 16 anos.' }))
    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull()
    expect(corpoDe(servidor, '/provedor/concluir-cadastro')).toBeUndefined()
  })

  test('sem cadastro pendente (app reaberto): manda começar de novo', async () => {
    await renderizar(<TelaCompletarCadastro />, {})
    expect(await screen.findByText('Comece de novo')).toBeOnTheScreen()
  })
})
