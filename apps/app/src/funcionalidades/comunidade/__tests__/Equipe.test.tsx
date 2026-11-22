import { fireEvent, screen } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import { BASE, PESSOAS, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { TelaComunidade } from '../TelaComunidade'
import { resumoDoConvite, TelaConvidar } from '../TelaConvidar'
import { TelaMembro } from '../TelaMembro'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}))

jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))

// As confirmações vão em toast: o teste confere o que foi pedido.
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const TOKEN = 'a'.repeat(43)
const LINK = `https://app.exemplo/convite#t=${TOKEN}`

function euComoCriador(comComunidade: boolean) {
  const base = respostaEu('membro')
  return () => ({
    status: 200,
    corpo: {
      conta: { ...base.conta, criador: true, doisFatores: true },
      comunidades: comComunidade ? base.comunidades : [],
    },
  })
}

beforeEach(() => {
  jest.mocked(mostrarToast).mockClear()
  jest.mocked(confirmar).mockReset()
  jest.mocked(useLocalSearchParams).mockReturnValue({})
})

describe('aba Comunidade sem comunidade', () => {
  test('o Criador sem comunidade vê como criar a primeira e entrar com convite', async () => {
    await renderizarTela(<TelaComunidade />, {
      rotas: { 'GET /api/v1/eu': euComoCriador(false) },
    })
    expect(await screen.findByRole('button', { name: 'Criar comunidade' })).toBeOnTheScreen()
    // Entrar com um convite: a pílula vazia do topo leva até lá (quadro 10).
    expect(
      screen.getByRole('button', { name: 'Sem comunidade. Entrar numa comunidade' }),
    ).toBeOnTheScreen()
  })
})

describe('papéis que cada um concede', () => {
  test('organizador não cria convite (nem de administrador)', async () => {
    await renderizarTela(<TelaConvidar />, { papel: 'organizador' })
    expect(await screen.findByText('Convites são criados pela administração')).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Administrador' })).toBeNull()
  })

  test('organizador não vê opção de conceder administrador a uma pessoa', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ vinculoId: PESSOAS[1]!.vinculoId })
    await renderizarTela(<TelaMembro />, { papel: 'organizador' })
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Administrador' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar papel' })).toBeNull()
  })

  test('admin concede até administrador (em "Mais opções", fechado por padrão)', async () => {
    await renderizarTela(<TelaConvidar />, { papel: 'admin' })
    expect(
      await screen.findByRole('button', { name: 'Convidar para Jovens Centro' }),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Administrador' })).toBeNull()
    await fireEvent.press(
      screen.getByRole('button', { name: /^Mais opções: função, validade e e-mail/ }),
    )
    expect(await screen.findByRole('radio', { name: 'Administrador' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Organizador' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Membro' })).toBeOnTheScreen()
  })
})

describe('convites', () => {
  test('um botão só: o padrão (Membro, 7 dias, para quem abrir primeiro) está escrito abaixo', async () => {
    await renderizarTela(<TelaConvidar />, { papel: 'admin' })
    expect(
      await screen.findByText('Entra como Membro. O link vale 7 dias, para quem abrir primeiro.'),
    ).toBeOnTheScreen()
    expect(resumoDoConvite('organizador', '3', 'lia@exemplo.com')).toBe(
      'Entra como Organizador. O link vale 3 dias, só para lia@exemplo.com.',
    )
    expect(resumoDoConvite('membro', '1', '')).toBe(
      'Entra como Membro. O link vale 1 dia, para quem abrir primeiro.',
    )
  })

  test('criar convite mostra o link com Copiar, Compartilhar e o QR', async () => {
    const { servidor } = await renderizarTela(<TelaConvidar />, {
      papel: 'admin',
      rotas: {
        [`POST ${BASE}/convites`]: () => ({
          status: 200,
          corpo: { id: 'c1', link: LINK, expiraEm: '2026-11-21T12:00:00.000Z' },
        }),
      },
    })
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Convidar para Jovens Centro' }),
    )

    expect(await screen.findByRole('button', { name: 'Copiar link' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toBeOnTheScreen()
    expect(screen.getByText(LINK)).toBeOnTheScreen()
    expect(screen.getByText(/Vale até/)).toBeOnTheScreen()
    // O QR aparece sob pedido, para quem está ao lado.
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar o QR' }))
    expect(screen.getByLabelText('QR com o link do convite')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/convites`)[0]?.corpo).toEqual({
      papel: 'membro',
      validadeDias: 7,
    })
  })
})
