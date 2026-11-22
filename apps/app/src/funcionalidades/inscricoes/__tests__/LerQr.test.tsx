import { act, screen, waitFor } from '@testing-library/react-native'
import { useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams } from 'expo-router'

import { EVENTO_ID } from '@/testes/fixturas'
import { BASE, pedidosPara, PESSOAS, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'

import { TelaLerQr } from '../TelaLerQr'

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

jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

beforeEach(() => jest.clearAllMocks())

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`

const LISTA = {
  inscritos: [
    {
      inscricaoId: '66666666-6666-4666-8666-000000000001',
      vinculoId: null,
      nome: 'Daniela Prado',
      telefone: null,
      codigo: 'ABCDEF1234',
      estado: 'confirmada',
      presente: false,
    },
  ],
  membros: PESSOAS.map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, presente: false })),
  geradoEm: '2026-11-21T18:00:00.000Z',
}

describe('check-in por QR', () => {
  test('o código lido pela câmera registra a presença com origem "qr" e a câmera segue aberta', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
    const { servidor } = await renderizarTela(<TelaLerQr />, {
      rotas: {
        [`GET ${CAMINHO}/checkin`]: () => ({ status: 200, corpo: LISTA }),
        [`POST ${CAMINHO}/presencas`]: () => ({
          status: 200,
          corpo: { id: 'pres-dani', jaRegistrada: false },
        }),
        [`DELETE ${CAMINHO}/presencas/pres-dani`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })

    await screen.findByLabelText('Visor da câmera. Aponte para o QR de entrada.')
    // A câmera simulada repassa as props; o teste faz o papel do leitor nativo.
    const camera = screen.getByTestId('camera')
    await act(async () => {
      ;(camera.props as { onBarcodeScanned: (r: { data: string }) => void }).onBarcodeScanned({
        data: 'abcdef1234',
      })
    })

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)[0]?.corpo).toMatchObject({
        origem: 'qr',
        codigo: 'ABCDEF1234',
      }),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith(
        expect.objectContaining({ texto: 'Presença de Daniela Prado registrada.' }),
      ),
    )
    // Lida a pessoa errada, o Desfazer do toast apaga a presença sem sair da câmera.
    const pedido = jest.mocked(mostrarToast).mock.calls[0]?.[0]
    await act(async () => pedido?.acao?.aoPressionar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/presencas/pres-dani`)).toHaveLength(1),
    )
    // O caminho sem câmera continua a um toque.
    expect(screen.getByRole('button', { name: 'Buscar pelo nome, sem câmera' })).toBeOnTheScreen()
  })

  test('QR que não é do app: avisa em texto e nada vai à rede', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
    const { servidor } = await renderizarTela(<TelaLerQr />, {
      rotas: { [`GET ${CAMINHO}/checkin`]: () => ({ status: 200, corpo: LISTA }) },
    })
    await screen.findByLabelText('Visor da câmera. Aponte para o QR de entrada.')
    await act(async () => {
      ;(
        screen.getByTestId('camera').props as { onBarcodeScanned: (r: { data: string }) => void }
      ).onBarcodeScanned({ data: 'https://exemplo.com/qualquer-coisa' })
    })
    expect(mostrarToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'erro',
        texto: expect.stringContaining('não é um código de entrada'),
      }),
    )
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)).toHaveLength(0)
  })

  test('sem permissão da câmera: explica e oferece a busca por nome', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
    const negada = { granted: false, canAskAgain: false, status: 'denied', expires: 'never' }
    jest.mocked(useCameraPermissions).mockReturnValue([negada, jest.fn()] as never)
    await renderizarTela(<TelaLerQr />, {
      rotas: { [`GET ${CAMINHO}/checkin`]: () => ({ status: 200, corpo: LISTA }) },
    })
    expect(await screen.findByRole('button', { name: 'Abrir os ajustes' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Buscar pelo nome, sem câmera' })).toBeOnTheScreen()
  })
})
