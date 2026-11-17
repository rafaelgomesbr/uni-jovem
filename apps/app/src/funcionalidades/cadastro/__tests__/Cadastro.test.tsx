import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
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
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

const cofre = (SecureStore as unknown as { __cofre: Map<string, string> }).__cofre
const google = jest.requireMock('expo-auth-session/providers/google') as {
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

describe('Criar conta (ADR 0007)', () => {
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

  async function preencherDados() {
    await fireEvent.changeText(await screen.findByLabelText('Nome'), 'Ana Souza')
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
    await fireEvent.press(screen.getByRole('radio', { name: /^Tenho 16 ou 17 anos/ }))
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Li e concordo com os Termos de Uso e a Política de Privacidade.',
      }),
    )
  }

  test('dois passos: dados e aceites, depois código e senha numa tela só; abre a sessão', async () => {
    const servidor = await renderizar(<TelaCriarConta />, {
      'POST /api/auth/cadastro/iniciar': () => ({ status: 200, corpo: { ok: true } }),
      'POST /api/auth/cadastro/concluir': () => ({ status: 200, corpo: SESSAO }),
    })
    // TC-01.v2: o aviso de que conta de menor de 16 é encerrada.
    expect(
      await screen.findByText(/conta de quem tem menos de 16 anos é encerrada/),
    ).toBeOnTheScreen()
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }))

    expect(await screen.findByText('Confira seu e-mail')).toBeOnTheScreen()
    // A opção de 16 ou 17 anos já declara que o responsável sabe (TC-01.v2).
    expect(corpoDe(servidor, '/cadastro/iniciar')).toEqual({
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      faixaEtaria: '16_17',
      aceites: { termos: true, responsavelCiente: true },
      plataforma: 'ios',
      turnstile: undefined,
    })

    await fireEvent.changeText(screen.getByLabelText('Código de 6 números'), '123456')
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'uma frase bem longa')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() =>
      expect(servidor.pedidos.some((p) => p.url.endsWith('/api/v1/eu'))).toBe(true),
    )
    expect(corpoDe(servidor, '/cadastro/concluir')).toMatchObject({
      email: 'ana@exemplo.com',
      codigo: '123456',
      senha: 'uma frase bem longa',
    })
  })

  test('código errado volta para o campo do código, sem perder a senha', async () => {
    await renderizar(<TelaCriarConta />, {
      'POST /api/auth/cadastro/iniciar': () => ({ status: 200, corpo: { ok: true } }),
      'POST /api/auth/cadastro/concluir': () => ({
        status: 400,
        corpo: { erro: 'codigo_invalido', mensagem: 'Código incorreto. Confira o e-mail.' },
      }),
    })
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }))
    await fireEvent.changeText(await screen.findByLabelText('Código de 6 números'), '000000')
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'uma frase bem longa')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Código incorreto. Confira o e-mail.')).toBeOnTheScreen()
    expect(screen.getByLabelText('Crie uma senha').props.value).toBe('uma frase bem longa')
  })

  test('e-mail que já tem conta: oferece entrar ou recuperar a senha', async () => {
    await renderizar(<TelaCriarConta />, {
      'POST /api/auth/cadastro/iniciar': () => ({ status: 200, corpo: { ok: true } }),
      'POST /api/auth/cadastro/concluir': () => ({
        status: 409,
        corpo: { erro: 'conta_existente', mensagem: 'Este e-mail já tem conta.' },
      }),
    })
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }))
    await fireEvent.changeText(await screen.findByLabelText('Código de 6 números'), '123456')
    await fireEvent.changeText(screen.getByLabelText('Crie uma senha'), 'uma frase bem longa')
    await fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Esqueci a senha' }))
    expect(router.replace).toHaveBeenCalledWith('/recuperar-senha')
  })

  test('cadastro por e-mail indisponível (503): a mensagem e os botões de Google e Apple', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com'
    await renderizar(<TelaCriarConta />, {
      'POST /api/auth/cadastro/iniciar': () => ({
        status: 503,
        corpo: { erro: 'cadastro_indisponivel', mensagem: 'Use Google ou Apple.' },
      }),
    })
    await preencherDados()
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByText('Cadastro por e-mail indisponível agora')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Continuar com o Google' })).toBeOnTheScreen()
  })

  test('menos de 16: a mensagem da TC-01.v2 e, depois, o aparelho fica travado por 24 horas', async () => {
    await renderizar(<TelaCriarConta />, {})
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tenho menos de 16 anos.' }))
    expect(
      screen.getByText(/seu pai, sua mãe ou seu responsável pode inscrever você/),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Enviar código' })).toBeNull()
  })

  test('aparelho travado: o cadastro não abre', async () => {
    await marcarMenorDe16()
    await renderizar(<TelaCriarConta />, {})
    expect(await screen.findByText('Ainda não dá para criar a conta')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Nome')).toBeNull()
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

  test('a API devolve cadastroPendente; idade e aceites concluem com o token', async () => {
    const servidor = await renderizar(
      <View>
        <TelaEntrar />
        <TelaCompletarCadastro />
      </View>,
      {
        'POST /api/auth/provedor/google': () => ({
          status: 200,
          corpo: {
            cadastroPendente: true,
            tokenDeCadastro: 'token-de-cadastro',
            nome: 'Ana Souza',
            email: 'ana@exemplo.com',
          },
        }),
        'POST /api/auth/provedor/concluir-cadastro': () => ({ status: 200, corpo: SESSAO }),
      },
    )
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar com o Google' }))
    await act(async () => {
      google.__responder({ type: 'success', params: { id_token: 'token-do-google' } })
    })
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/completar-cadastro'))
    expect(await screen.findByText('Falta pouco')).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('radio', { name: 'Tenho 18 anos ou mais.' }))
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Li e concordo com os Termos de Uso e a Política de Privacidade.',
      }),
    )
    // A tela Entrar também tem "Criar conta": o da barra de "Falta pouco" é o último.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Criar conta' }).at(-1)!)
    await waitFor(() =>
      expect(corpoDe(servidor, '/provedor/concluir-cadastro')).toMatchObject({
        tokenDeCadastro: 'token-de-cadastro',
        faixaEtaria: '18_mais',
        aceites: { termos: true },
      }),
    )
  })

  test('sem cadastro pendente (app reaberto): manda começar de novo', async () => {
    await renderizar(<TelaCompletarCadastro />, {})
    expect(await screen.findByText('Comece de novo')).toBeOnTheScreen()
  })
})
