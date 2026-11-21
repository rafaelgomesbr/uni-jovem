import { act, fireEvent, userEvent, waitFor } from '@testing-library/react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

import { trancarCofre } from '@/servicos/armazenamentoDoRefresh'
import { pedidosPara, renderizarTela, respostaEu, screen } from '@/testes/telas'

import { TelaPlataforma } from '../../plataforma/TelaPlataforma'
import { TelaSeguranca } from '../TelaSeguranca'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Redirect: () => null,
  usePreventRemove: jest.fn(() => jest.fn()),
}))
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))

const cofre = (SecureStore as unknown as { __cofre: Map<string, string> }).__cofre
const autenticar = LocalAuthentication.authenticateAsync as jest.Mock
const google = jest.requireMock('@react-native-google-signin/google-signin') as {
  __responder: (r: unknown) => void
}

const SEM_CONTAS = { provedores: [], disponiveis: ['google', 'apple'] }

beforeEach(() => {
  jest.clearAllMocks()
  cofre.clear()
  trancarCofre()
  autenticar.mockResolvedValue({ success: true })
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
})

describe('Perfil, Segurança', () => {
  test('liga o Face ID com a biometria simulada e mostra "Ligado" além da chave', async () => {
    cofre.set('uj.refresh', 'refresh-desta-sessao')
    await renderizarTela(<TelaSeguranca />, {
      rotas: { 'GET /api/v1/eu/provedores': () => ({ status: 200, corpo: SEM_CONTAS }) },
    })

    const chave = await screen.findByRole('switch', { name: 'Entrar com Face ID' })
    expect(screen.getByText('Desligado')).toBeOnTheScreen()
    await act(async () => {
      // Interruptor (2.12.8): a linha inteira é o controle; tocar liga.
      await fireEvent.press(chave)
    })

    await waitFor(() => expect(screen.getByText('Ligado')).toBeOnTheScreen())
    expect(autenticar).toHaveBeenCalledWith(
      expect.objectContaining({ promptMessage: 'Confirme para usar o Face ID' }),
    )
    expect(cofre.has('uj.refresh')).toBe(false)
    expect(cofre.get('uj.biometria.ligada')).toBe('1')
  })

  test('Face ID recusado: a chave volta e a mensagem é humana', async () => {
    cofre.set('uj.refresh', 'refresh-desta-sessao')
    autenticar.mockResolvedValue({ success: false, error: 'user_cancel' })
    await renderizarTela(<TelaSeguranca />, {
      rotas: { 'GET /api/v1/eu/provedores': () => ({ status: 200, corpo: SEM_CONTAS }) },
    })
    const chave = await screen.findByRole('switch', { name: 'Entrar com Face ID' })
    await act(async () => {
      // Interruptor (2.12.8): a linha inteira é o controle; tocar liga.
      await fireEvent.press(chave)
    })
    expect(
      await screen.findByText(
        'Não deu para confirmar o Face ID. Tente de novo ou deixe para depois.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByText('Desligado')).toBeOnTheScreen()
  })

  test('conta Google conectada aparece com o e-mail e pode ser desconectada', async () => {
    const { servidor } = await renderizarTela(<TelaSeguranca />, {
      rotas: {
        'GET /api/v1/eu/provedores': () => ({
          status: 200,
          corpo: {
            provedores: [
              { provedor: 'google', email: 'ana@gmail.com', conectadaEm: '2026-11-14T10:00:00Z' },
            ],
            disponiveis: ['google', 'apple'],
          },
        }),
        'DELETE /api/v1/eu/provedores/google': () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    expect(await screen.findByText('Conectada: ana@gmail.com')).toBeOnTheScreen()
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Desconectar a conta Google' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', '/api/v1/eu/provedores/google')).toHaveLength(1),
    )
  })

  test('conectar o Google pede a senha atual antes e manda os dois à API', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-123.apps.googleusercontent.com'
    const { servidor } = await renderizarTela(<TelaSeguranca />, {
      rotas: {
        'GET /api/v1/eu/provedores': () => ({ status: 200, corpo: SEM_CONTAS }),
        'POST /api/v1/eu/provedores/google': () => ({
          status: 200,
          corpo: { provedor: 'google', email: 'ana@gmail.com', conectadaEm: '2026-11-14' },
        }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Conectar a conta Google' }))
    const conectar = screen.getByRole('button', { name: 'Conectar com Google' })
    expect(conectar).toBeDisabled()

    await fireEvent.changeText(screen.getByLabelText('Senha atual'), 'minha senha de sempre')
    await usuario.press(screen.getByRole('button', { name: 'Conectar com Google' }))
    await act(async () => {
      google.__responder({ type: 'success', data: { idToken: 'token-para-conectar' } })
    })

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', '/api/v1/eu/provedores/google')[0]?.corpo).toEqual({
        idToken: 'token-para-conectar',
        senhaAtual: 'minha senha de sempre',
      }),
    )
  })

  test('código extra ao entrar: o Criador lê que o código é pedido na plataforma', async () => {
    const eu = respostaEu('admin')
    await renderizarTela(<TelaSeguranca />, {
      rotas: {
        'GET /api/v1/eu': () => ({
          status: 200,
          corpo: { ...eu, conta: { ...eu.conta, criador: true, doisFatores: true } },
        }),
        'GET /api/v1/eu/provedores': () => ({ status: 200, corpo: SEM_CONTAS }),
      },
    })
    expect(
      await screen.findByText(
        'Ligado. Como Criador, o código é pedido nas ações da plataforma, não ao entrar.',
      ),
    ).toBeOnTheScreen()
  })
})

describe('step-up da plataforma', () => {
  test('sem prova recente, a tela pede o código; com ele, repete com o acesso novo', async () => {
    const eu = respostaEu('admin')
    let comProva = false
    const { servidor } = await renderizarTela(<TelaPlataforma />, {
      rotas: {
        'GET /api/v1/eu': () => ({
          status: 200,
          corpo: { ...eu, conta: { ...eu.conta, criador: true, doisFatores: true } },
        }),
        'GET /api/v1/plataforma/comunidades': () =>
          comProva
            ? {
                status: 200,
                corpo: {
                  comunidades: [
                    {
                      id: 'c1',
                      nome: 'Jovens Norte',
                      cor: '#5B4BDB',
                      estado: 'ativa',
                      membrosAtivos: 12,
                      adminsAtivos: 1,
                      exclusaoAgendadaPara: null,
                    },
                  ],
                },
              }
            : {
                status: 403,
                corpo: {
                  erro: 'segundo_fator_necessario',
                  mensagem: 'Confirme o código do seu autenticador para continuar.',
                },
              },
        'POST /api/auth/2fa/provar': () => {
          comProva = true
          return { status: 200, corpo: { acesso: 'acesso-com-prova' } }
        },
      },
    })

    const campo = await screen.findByLabelText('Código do app autenticador')
    await fireEvent.changeText(campo, '123456')
    await userEvent.setup().press(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Jovens Norte')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', '/api/auth/2fa/provar')[0]?.corpo).toEqual({
      codigo: '123456',
    })
    const ultimo = pedidosPara(servidor, 'GET', '/api/v1/plataforma/comunidades').at(-1)
    expect(ultimo?.cabecalhos.authorization).toBe('Bearer acesso-com-prova')
  })
})
