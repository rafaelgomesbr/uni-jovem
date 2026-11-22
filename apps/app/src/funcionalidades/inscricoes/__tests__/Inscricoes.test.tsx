import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'

import { TelaInscricoes } from '../TelaInscricoes'

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

jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`

const INSCRICOES = {
  contagem: { confirmadas: 12, espera: 1, presentes: 1 },
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
}

function montar(papel: 'organizador' | 'membro' = 'organizador', rotas = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
  return renderizarTela(<TelaInscricoes />, {
    papel,
    rotas: {
      [`GET ${CAMINHO}`]: () => ({
        status: 200,
        corpo: eventoDeTeste({ capacidade: 60, listaDeEspera: true }),
      }),
      [`GET ${CAMINHO}/inscricoes`]: () => ({ status: 200, corpo: INSCRICOES }),
      ...rotas,
    },
  })
}

beforeEach(() => jest.clearAllMocks())

describe('inscrições no visual A (D71)', () => {
  test('o cartão de vagas: "12 de 60 vagas", a espera e os presentes em número', async () => {
    await montar()
    expect(await screen.findByLabelText('12 de 60 vagas preenchidas')).toBeOnTheScreen()
    expect(screen.getByLabelText('1 na lista de espera')).toBeOnTheScreen()
    expect(screen.getByLabelText('1 presentes')).toBeOnTheScreen()
    expect(
      screen.getByRole('progressbar', { name: 'Vagas preenchidas: 12 de 60', hidden: true }),
    ).toBeOnTheScreen()
  })

  test('esgotadas: o chip diz em texto, com e sem lista de espera', async () => {
    await montar('organizador', {
      [`GET ${CAMINHO}`]: () => ({
        status: 200,
        corpo: eventoDeTeste({ capacidade: 12, listaDeEspera: false }),
      }),
    })
    expect(await screen.findByText('Esgotadas')).toBeOnTheScreen()
    expect(
      screen.getByText('As vagas acabaram e o encontro não tem lista de espera.'),
    ).toBeOnTheScreen()
  })

  test('situação em texto, não só em cor, e o filtro "Espera"', async () => {
    await montar()
    expect(await screen.findByText('Lista de espera')).toBeOnTheScreen()
    expect(screen.getByText('Confirmada')).toBeOnTheScreen()
    expect(screen.getByText('Presente')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Espera' }))
    expect(screen.queryByText('Daniela Prado')).toBeNull()
    expect(screen.getByText('Carla Dias')).toBeOnTheScreen()
  })

  test('quem organiza cancela uma inscrição e a vaga volta', async () => {
    const { servidor } = await montar('organizador', {
      [`POST ${BASE}/inscricoes/i1/cancelar`]: () => ({ status: 200, corpo: {} }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Daniela Prado\./ }))
    await usuario.press(await screen.findByRole('button', { name: /^Cancelar inscrição/ }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/inscricoes/i1/cancelar`)).toHaveLength(1),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Inscrição de Daniela Prado cancelada.' }),
    )
  })

  test('"Marcar quem chegou" na barra leva ao check-in do encontro', async () => {
    await montar()
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Marcar quem chegou' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/checkin',
      params: { eventoId: EVENTO_ID },
    })
  })

  test('o link da página pública aparece para encontro público e publicado', async () => {
    await montar()
    expect(await screen.findByText('Página pública')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeOnTheScreen()
  })

  test('membro não vê a lista: ela tem dados de contato', async () => {
    await montar('membro')
    expect(await screen.findByText('Só a organização vê a lista')).toBeOnTheScreen()
  })

  describe('os três estados', () => {
    test('vazio: o sol, o porquê e o que fazer', async () => {
      await montar('organizador', {
        [`GET ${CAMINHO}/inscricoes`]: () => ({
          status: 200,
          corpo: { contagem: { confirmadas: 0, espera: 0, presentes: 0 }, inscricoes: [] },
        }),
      })
      expect(await screen.findByText('Ninguém se inscreveu ainda.')).toBeOnTheScreen()
      expect(
        screen.getByText(
          'Compartilhe o link da página pública, logo abaixo, para receber inscrições.',
        ),
      ).toBeOnTheScreen()
    })

    test('erro: texto humano e "Tentar de novo" que recarrega', async () => {
      let n = 0
      await montar('organizador', {
        [`GET ${CAMINHO}/inscricoes`]: () =>
          ++n === 1
            ? { status: 500, corpo: { erro: 'x', mensagem: 'Falhou.' } }
            : { status: 200, corpo: INSCRICOES },
      })
      expect(await screen.findByText('Não deu para carregar as inscrições.')).toBeOnTheScreen()
      await act(async () => {
        await userEvent.setup().press(screen.getByRole('button', { name: 'Tentar de novo' }))
      })
      expect(await screen.findByText('Daniela Prado')).toBeOnTheScreen()
    })

    test('carregando: esqueleto com a forma do cartão e das linhas', async () => {
      await montar('organizador', {
        [`GET ${CAMINHO}/inscricoes`]: () => new Promise<never>(() => {}),
      })
      expect(await screen.findByLabelText('Carregando as inscrições')).toBeOnTheScreen()
    })
  })
})
