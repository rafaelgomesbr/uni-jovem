import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { ATRIBUICAO, versiculoDoDia } from '@uj/conteudo'
import * as Notifications from 'expo-notifications'

import { agendarVersiculos } from '@/servicos/notificacoesDoSistema'
import { pedidosPara, renderizarTela } from '@/testes/telas'

import { reiniciarPermissaoParaTestes } from '../../notificacoes/permissao'
import { DIAS_AGENDADOS, planejarVersiculos, PREFIXO } from '../plano'
import { TelaSobreATraducao, TelaVersiculo } from '../TelaVersiculo'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const PREFERENCIAS = {
  versiculo: { ativo: true, hora: '07:00' },
  aparelhoAtual: { registrado: false },
}

const permissoes = Notifications.getPermissionsAsync as jest.Mock

function permissaoDoSistema(status: 0 | 1 | 2) {
  const resposta = {
    granted: status === 2,
    canAskAgain: status !== 1,
    status: ['undetermined', 'denied', 'granted'][status],
    expires: 'never',
    ios: { status },
  }
  permissoes.mockResolvedValue(resposta)
  ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
    ...resposta,
    granted: true,
    status: 'granted',
    ios: { status: 2 },
  })
}

describe('plano de versículos', () => {
  test('30 dias, no horário escolhido, começando amanhã se o de hoje já passou', () => {
    const agora = new Date(2026, 10, 14, 9, 30)
    const plano = planejarVersiculos(agora, '07:00')
    expect(plano).toHaveLength(DIAS_AGENDADOS)
    expect(plano[0]!.quando).toEqual(new Date(2026, 10, 15, 7, 0))
    expect(plano[0]!.id).toBe(`${PREFIXO}2026-11-15`)
    expect(plano[0]!.corpo).toBe(versiculoDoDia(new Date(2026, 10, 15)).texto)
    expect(new Set(plano.map((p) => p.id)).size).toBe(DIAS_AGENDADOS)
    expect(planejarVersiculos(new Date(2026, 10, 14, 6, 0), '07:00')[0]!.quando).toEqual(
      new Date(2026, 10, 14, 7, 0),
    )
  })

  test('sem permissão do sistema, só cancela os do versículo e não agenda nada', async () => {
    permissaoDoSistema(1)
    ;(Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
      { identifier: `${PREFIXO}2026-11-15` },
      { identifier: 'outra-coisa' },
    ])
    expect(await agendarVersiculos(planejarVersiculos(new Date(), '07:00'))).toBe(0)
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1)
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      `${PREFIXO}2026-11-15`,
    )
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
  })
})

describe('tela do versículo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarPermissaoParaTestes()
  })

  test('ligado no app e bloqueado no sistema aparecem separados, com atalho para os Ajustes', async () => {
    permissaoDoSistema(1)
    await renderizarTela(<TelaVersiculo />, {
      rotas: { 'GET /api/v1/eu/notificacoes': () => ({ status: 200, corpo: PREFERENCIAS }) },
    })
    expect(
      await screen.findByRole('checkbox', { name: 'Receber o versículo do dia' }),
    ).toBeChecked()
    expect(await screen.findByText('Ligado no app, bloqueado no sistema')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Abrir os Ajustes do aparelho' })).toBeOnTheScreen()
  })

  test('a permissão só é pedida depois da explicação e do toque em "Ativar"', async () => {
    permissaoDoSistema(0)
    await renderizarTela(<TelaVersiculo />, {
      rotas: { 'GET /api/v1/eu/notificacoes': () => ({ status: 200, corpo: PREFERENCIAS }) },
    })
    expect(await screen.findByText('Quer ser avisado?')).toBeOnTheScreen()
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Ativar' }))
    await waitFor(() => expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Permitidas no sistema')).toBeOnTheScreen()
  })

  test('mudar o horário salva na conta', async () => {
    permissaoDoSistema(2)
    const { servidor } = await renderizarTela(<TelaVersiculo />, {
      rotas: {
        'GET /api/v1/eu/notificacoes': () => ({ status: 200, corpo: PREFERENCIAS }),
        'PUT /api/v1/eu/notificacoes': () => ({
          status: 200,
          corpo: { versiculo: { ativo: true, hora: '21:30' } },
        }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Horário'), '21h30')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar horário' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PUT', '/api/v1/eu/notificacoes')[0]?.corpo).toEqual({
        versiculoHora: '21:30',
      }),
    )
  })

  test('"Sobre a tradução" traz o crédito completo da licença', async () => {
    await renderizarTela(<TelaSobreATraducao />)
    expect(await screen.findByText(ATRIBUICAO.texto)).toBeOnTheScreen()
    expect(screen.getByText(ATRIBUICAO.licenca)).toBeOnTheScreen()
  })
})
