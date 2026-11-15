import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { reiniciarPermissaoParaTestes } from '../permissao'
import { TelaNotificacoes } from '../TelaNotificacoes'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const CONTA = { versiculo: { ativo: true, hora: '07:00' }, aparelhoAtual: { registrado: false } }

function preferencias(todas: boolean) {
  return {
    todas,
    tipos: [
      { tipo: 'eventos', ativo: true },
      { tipo: 'escalas', ativo: false },
    ],
  }
}

/** Permissão do sistema já concedida (o caso comum depois do primeiro uso). */
function permitido() {
  ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: 'granted',
    expires: 'never',
    ios: { status: 2 },
  })
}

describe('notificações', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarPermissaoParaTestes()
    permitido()
  })

  test('interruptor por tipo manda só aquele tipo; a permissão do aparelho aparece à parte', async () => {
    const { servidor } = await renderizarTela(<TelaNotificacoes />, {
      papel: 'membro',
      rotas: {
        'GET /api/v1/eu/notificacoes': () => ({ status: 200, corpo: CONTA }),
        [`GET ${BASE}/notificacoes/preferencias`]: () => ({
          status: 200,
          corpo: preferencias(true),
        }),
        [`PUT ${BASE}/notificacoes/preferencias`]: () => ({
          status: 200,
          corpo: {
            todas: true,
            tipos: [
              { tipo: 'eventos', ativo: true },
              { tipo: 'escalas', ativo: true },
            ],
          },
        }),
      },
    })

    expect(await screen.findByText('Permitidas no sistema')).toBeOnTheScreen()
    expect(await screen.findByRole('switch', { name: 'Receber de Jovens Centro' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Eventos' })).toBeChecked()
    const escalas = screen.getByRole('switch', { name: 'Escalas' })
    expect(escalas).not.toBeChecked()

    await fireEvent.press(escalas)
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PUT', `${BASE}/notificacoes/preferencias`)[0]?.corpo).toEqual({
        tipos: { escalas: true },
      }),
    )
  })

  test('com o principal desligado, os tipos ficam desabilitados e dizem por quê', async () => {
    await renderizarTela(<TelaNotificacoes />, {
      papel: 'membro',
      rotas: {
        'GET /api/v1/eu/notificacoes': () => ({ status: 200, corpo: CONTA }),
        [`GET ${BASE}/notificacoes/preferencias`]: () => ({
          status: 200,
          corpo: preferencias(false),
        }),
      },
    })

    expect(
      await screen.findByRole('switch', { name: 'Receber de Jovens Centro' }),
    ).not.toBeChecked()
    const eventos = screen.getByRole('switch', { name: 'Eventos' })
    expect(eventos).toBeDisabled()
    expect(eventos).not.toBeChecked()
    expect(screen.getAllByText('Ligue "Receber de Jovens Centro" para escolher.')).toHaveLength(2)
  })

  test('a linha do versículo mostra o horário e abre a tela dele', async () => {
    await renderizarTela(<TelaNotificacoes />, {
      papel: 'membro',
      rotas: {
        'GET /api/v1/eu/notificacoes': () => ({ status: 200, corpo: CONTA }),
        [`GET ${BASE}/notificacoes/preferencias`]: () => ({
          status: 200,
          corpo: preferencias(true),
        }),
      },
    })

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Versículo do dia. Ligado, às 07:00' }),
    )
    expect(router.push).toHaveBeenCalledWith('/versiculo')
  })
})
