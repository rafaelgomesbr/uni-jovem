import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { ProvedorDeSessao } from '@/estado/sessao'
import { clienteDeConsultaDeTeste, servidorFalso } from '@/testes/dubles'

import { TelaEntrar } from '../TelaEntrar'

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }))

const MENSAGEM = 'E-mail ou senha incorretos.'

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
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => {
    globalThis.fetch = fetchOriginal
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

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
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

    await userEvent.setup().press(screen.getByRole('button', { name: 'Entrar' }))

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

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'uma frase longa')
    await usuario.press(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/segundo-fator'))
  })
})
