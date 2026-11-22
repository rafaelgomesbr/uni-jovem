import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { TelaPedidosEConvites } from '../TelaPedidosEConvites'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const PEDIDOS = {
  pedidos: [
    {
      id: 'pe1',
      nome: 'Pedro Alves',
      mensagem: 'Sou do grupo de sábado',
      origem: 'busca',
      estado: 'pendente',
      criadoEm: '2026-11-15T12:00:00.000Z',
      decididoEm: null,
    },
  ],
}

beforeEach(() => {
  jest.mocked(mostrarToast).mockClear()
  jest.mocked(confirmar).mockReset()
  jest.mocked(useLocalSearchParams).mockReturnValue({})
})

describe('Pedidos de entrada (organização, D70)', () => {
  test('organizador vê o pedido, aceita e a API é chamada; sem convites (só a administração)', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ segmento: 'pedidos' })
    const { servidor } = await renderizarTela(<TelaPedidosEConvites />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/pedidos`]: () => ({ status: 200, corpo: PEDIDOS }),
        [`POST ${BASE}/pedidos/pe1/aceitar`]: () => ({ status: 200, corpo: { estado: 'aceito' } }),
      },
    })
    expect(await screen.findByText('“Sou do grupo de sábado”')).toBeOnTheScreen()
    expect(screen.getByText(/pela busca/)).toBeOnTheScreen()
    // Um segmento só: não há o que alternar, e convites não são do organizador.
    expect(screen.queryByRole('radio')).toBeNull()
    expect(pedidosPara(servidor, 'GET', `${BASE}/convites`)).toHaveLength(0)
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar o pedido de Pedro Alves' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/pedidos/pe1/aceitar`)).toHaveLength(1),
    )
  })

  test('administração: o contador vai no segmento e recusar pergunta antes ("Cancelar" não manda nada)', async () => {
    jest.mocked(confirmar).mockResolvedValueOnce(false)
    const { servidor } = await renderizarTela(<TelaPedidosEConvites />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}/pedidos`]: () => ({ status: 200, corpo: PEDIDOS }),
        [`GET ${BASE}/convites`]: () => ({ status: 200, corpo: { convites: [] } }),
      },
    })
    expect(await screen.findByRole('radio', { name: 'Pedidos (1)' })).toBeOnTheScreen()
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Recusar o pedido de Pedro Alves' }),
    )
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/pedidos/pe1/recusar`)).toHaveLength(0)
  })

  test('membro: a tela diz que é da organização e a API não é chamada', async () => {
    const { servidor } = await renderizarTela(<TelaPedidosEConvites />, { papel: 'membro' })
    expect(await screen.findByText('Pedidos de entrada são da organização')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', `${BASE}/pedidos`)).toHaveLength(0)
    expect(pedidosPara(servidor, 'GET', `${BASE}/convites`)).toHaveLength(0)
  })
})

describe('Convites (administração)', () => {
  test('sem convites: o vazio ensina e tem uma ação', async () => {
    await renderizarTela(<TelaPedidosEConvites />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}/pedidos`]: () => ({ status: 200, corpo: { pedidos: [] } }),
        [`GET ${BASE}/convites`]: () => ({ status: 200, corpo: { convites: [] } }),
      },
    })
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Convites' }))
    expect(await screen.findByText('Ainda não há convites')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Convidar a primeira pessoa' })).toBeOnTheScreen()
  })

  test('o toque na notificação (`?segmento=convites`) abre direto nos convites', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ segmento: 'convites' })
    await renderizarTela(<TelaPedidosEConvites />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}/pedidos`]: () => ({ status: 200, corpo: { pedidos: [] } }),
        [`GET ${BASE}/convites`]: () => ({ status: 200, corpo: { convites: [] } }),
      },
    })
    expect(await screen.findByText('Ainda não há convites')).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Convites' })).toBeChecked()
  })

  test('cancelar o convite pede confirmação antes de chamar a API', async () => {
    const { servidor } = await renderizarTela(<TelaPedidosEConvites />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}/pedidos`]: () => ({ status: 200, corpo: { pedidos: [] } }),
        [`GET ${BASE}/convites`]: () => ({
          status: 200,
          corpo: {
            convites: [
              {
                id: 'c1',
                papel: 'organizador',
                emailDestino: 'lia@exemplo.com',
                criadoEm: '2026-11-14T12:00:00.000Z',
                expiraEm: '2026-11-21T12:00:00.000Z',
                situacao: 'valido',
              },
            ],
          },
        }),
        [`POST ${BASE}/convites/c1/revogar`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Convites (1)' }))
    const convite = await screen.findByRole('button', {
      name: /^Convite de Organizador\. Válido\. Para lia@exemplo\.com/,
    })
    expect(screen.getByText('Válido')).toBeOnTheScreen()

    // Tocar no convite abre a folha; "Cancelar convite" pede a confirmação nativa.
    jest.mocked(confirmar).mockResolvedValueOnce(false)
    await usuario.press(convite)
    await usuario.press(await screen.findByRole('button', { name: /^Cancelar convite/ }))
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1))
    expect(jest.mocked(confirmar).mock.calls[0]?.[0]).toMatchObject({
      titulo: 'Cancelar este convite?',
      destrutivo: true,
    })
    expect(pedidosPara(servidor, 'POST', `${BASE}/convites/c1/revogar`)).toHaveLength(0)

    jest.mocked(confirmar).mockResolvedValueOnce(true)
    await usuario.press(convite)
    await usuario.press(await screen.findByRole('button', { name: /^Cancelar convite/ }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/convites/c1/revogar`)).toHaveLength(1),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Convite cancelado. O link deixou de funcionar.',
      }),
    )
  })
})
