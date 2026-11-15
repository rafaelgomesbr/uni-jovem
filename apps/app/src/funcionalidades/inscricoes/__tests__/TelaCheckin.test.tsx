import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams } from 'expo-router'

import { EVENTO_ID } from '@/testes/fixturas'
import { BASE, pedidosPara, PESSOAS, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'

import { TelaCheckin } from '../TelaCheckin'
import { TelaInscricoes } from '../TelaInscricoes'
import { TelaLerQr } from '../TelaLerQr'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

// As confirmações vão em toast: o teste confere o que foi pedido (e usa o "Desfazer").
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

beforeEach(() => jest.mocked(mostrarToast).mockClear())

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`
const INSCRICAO_DANI = '66666666-6666-4666-8666-000000000001'
const INSCRICAO_BRUNO = '66666666-6666-4666-8666-000000000002'

const LISTA = {
  inscritos: [
    {
      inscricaoId: INSCRICAO_DANI,
      vinculoId: null,
      nome: 'Daniela Prado',
      telefone: '+55 11 9****-1234',
      codigo: 'ABCDEF1234',
      estado: 'confirmada',
      presente: false,
    },
    {
      inscricaoId: INSCRICAO_BRUNO,
      vinculoId: PESSOAS[1]!.vinculoId,
      nome: 'Bruno Lima',
      telefone: null,
      codigo: '0123456789',
      estado: 'confirmada',
      presente: true,
    },
  ],
  membros: PESSOAS.map((p) => ({
    vinculoId: p.vinculoId,
    nome: p.nome,
    presente: p.nome === 'Bruno Lima',
  })),
  geradoEm: '2026-11-21T18:00:00.000Z',
}

const PRESENCAS = {
  total: 1,
  presencas: [
    {
      id: 'pres-bruno',
      origem: 'manual',
      ocorridaEm: '2026-11-21T18:55:00.000Z',
      inscricaoId: INSCRICAO_BRUNO,
      vinculoId: PESSOAS[1]!.vinculoId,
      nome: 'Bruno Lima',
    },
  ],
}

function montar(rotas = {}) {
  ;(useLocalSearchParams as jest.Mock).mockReturnValue({ eventoId: EVENTO_ID })
  return renderizarTela(<TelaCheckin />, {
    rotas: {
      [`GET ${CAMINHO}/checkin`]: () => ({ status: 200, corpo: LISTA }),
      [`GET ${CAMINHO}/presencas`]: () => ({ status: 200, corpo: PRESENCAS }),
      ...rotas,
    },
  })
}

describe('check-in sem câmera', () => {
  test('contador em texto: presentes de inscritos', async () => {
    await montar()
    expect(await screen.findByLabelText('1 presente de 2 inscritos')).toBeOnTheScreen()
    // Campo e botão de 48 na mesma linha: o código e o "Marcar".
    expect(screen.getByLabelText('Código de entrada')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Marcar presença pelo código' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ler QR' })).toBeOnTheScreen()
  })

  test('busca pelo nome e marca a presença da inscrição, com chave de idempotência', async () => {
    const { servidor } = await montar({
      [`POST ${CAMINHO}/presencas`]: () => ({
        status: 200,
        corpo: { id: 'pres-dani', jaRegistrada: false },
      }),
      [`DELETE ${CAMINHO}/presencas/pres-dani`]: () => ({ status: 200, corpo: { ok: true } }),
    })

    await fireEvent.changeText(await screen.findByLabelText('Buscar pelo nome'), 'dani')
    expect(screen.queryByText('Carla Dias')).toBeNull()
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Marcar presença: Daniela Prado' }))

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)[0]?.corpo).toMatchObject({
        origem: 'manual',
        inscricaoId: INSCRICAO_DANI,
        chaveIdempotencia: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith(
        expect.objectContaining({ texto: 'Presença de Daniela Prado registrada.' }),
      ),
    )
    // O "Desfazer" do toast apaga a presença que acabou de ser criada.
    const pedido = jest.mocked(mostrarToast).mock.calls[0]?.[0]
    await act(async () => pedido?.acao?.aoPressionar())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/presencas/pres-dani`)).toHaveLength(1),
    )
  })

  test('membro sem inscrição aparece uma vez só e é marcado pelo vínculo', async () => {
    const { servidor } = await montar({
      [`POST ${CAMINHO}/presencas`]: () => ({
        status: 200,
        corpo: { id: 'p', jaRegistrada: false },
      }),
    })
    // Bruno é membro e inscrito: não aparece duplicado.
    expect(await screen.findAllByText('Bruno Lima')).toHaveLength(1)
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Marcar presença: Carla Dias' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)[0]?.corpo).toMatchObject({
        vinculoId: PESSOAS[2]!.vinculoId,
      }),
    )
  })

  test('desfazer presença apaga o registro certo', async () => {
    const { servidor } = await montar({
      [`DELETE ${CAMINHO}/presencas/pres-bruno`]: () => ({ status: 200, corpo: { ok: true } }),
    })

    const usuario = userEvent.setup()
    // Tocar numa pessoa presente abre a folha com "Desfazer presença".
    await usuario.press(await screen.findByRole('button', { name: /^Bruno Lima\..*Presente/ }))
    await usuario.press(await screen.findByRole('button', { name: 'Desfazer presença' }))

    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/presencas/pres-bruno`)).toHaveLength(1),
    )
  })

  test('código digitado com formato errado não vai à rede', async () => {
    const { servidor } = await montar()
    await fireEvent.changeText(await screen.findByLabelText('Código de entrada'), 'XYZ')
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Marcar presença pelo código' }))
    expect(await screen.findByText('O código tem 10 letras (A a F) e números.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/presencas`)).toHaveLength(0)
  })
})

describe('lista de inscrições', () => {
  test('contagens e estados em texto, não só em cor', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ eventoId: EVENTO_ID })
    await renderizarTela(<TelaInscricoes />, {
      rotas: {
        [`GET ${CAMINHO}`]: () => ({ status: 404, corpo: { erro: 'x', mensagem: 'x' } }),
        [`GET ${CAMINHO}/inscricoes`]: () => ({
          status: 200,
          corpo: {
            contagem: { confirmadas: 1, espera: 1, presentes: 1 },
            inscricoes: [
              {
                id: 'i1',
                origem: 'publica',
                nome: 'Daniela Prado',
                telefone: '+5511912341234',
                email: null,
                estado: 'confirmada',
                codigoCheckin: 'ABCDEF1234',
                criadoEm: '2026-11-15T10:00:00.000Z',
                promovidaEm: null,
                presente: true,
              },
              {
                id: 'i2',
                origem: 'membro',
                nome: 'Carla Dias',
                telefone: null,
                email: null,
                estado: 'espera',
                codigoCheckin: '0000000000',
                criadoEm: '2026-11-15T11:00:00.000Z',
                promovidaEm: null,
                presente: false,
              },
            ],
          },
        }),
      },
    })

    expect(await screen.findByLabelText('1 na lista de espera')).toBeOnTheScreen()
    expect(screen.getByText('Lista de espera')).toBeOnTheScreen()
    expect(screen.getByText('Presente')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Espera' }))
    expect(screen.queryByText('Daniela Prado')).toBeNull()
    expect(screen.getByText('Carla Dias')).toBeOnTheScreen()
  })
})

describe('check-in por QR', () => {
  test('o código lido pela câmera registra a presença com origem "qr"', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ eventoId: EVENTO_ID })
    const { servidor } = await renderizarTela(<TelaLerQr />, {
      rotas: {
        [`GET ${CAMINHO}/checkin`]: () => ({ status: 200, corpo: LISTA }),
        [`POST ${CAMINHO}/presencas`]: () => ({
          status: 200,
          corpo: { id: 'pres-dani', jaRegistrada: false },
        }),
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
      expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Presença de Daniela Prado registrada.' }),
    )
    // O caminho sem câmera continua a um toque.
    expect(screen.getByRole('button', { name: 'Buscar pelo nome, sem câmera' })).toBeOnTheScreen()
  })

  test('sem permissão da câmera: explica e oferece a busca por nome', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ eventoId: EVENTO_ID })
    const negada = { granted: false, canAskAgain: false, status: 'denied', expires: 'never' }
    ;(useCameraPermissions as jest.Mock).mockReturnValueOnce([negada, jest.fn()])
    ;(useCameraPermissions as jest.Mock).mockReturnValue([negada, jest.fn()])
    await renderizarTela(<TelaLerQr />, {
      rotas: { [`GET ${CAMINHO}/checkin`]: () => ({ status: 200, corpo: LISTA }) },
    })
    expect(await screen.findByRole('button', { name: 'Abrir os ajustes' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Buscar pelo nome, sem câmera' })).toBeOnTheScreen()
  })
})
