import { screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'

import { INICIO } from '@/testes/fixturas'
import { BASE, renderizarTela } from '@/testes/telas'

import { TelaInicio } from '../TelaInicio'

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

const VISAO = {
  [`GET ${BASE}/visao-geral`]: () => ({
    status: 200,
    corpo: {
      escopo: 'minha',
      convocacoesParaResponder: 0,
      convocacoesProximas: 1,
      tarefasAbertas: 0,
      inscricoes: 0,
      presenca30dias: { presentes: 0, encontros: 0 },
      oracoesAtivas: 0,
    },
  }),
}

function inicioCom(escala: object | null) {
  return {
    proximosEventos: [
      {
        id: 'e1',
        titulo: 'Sábado com a juventude',
        categoria: 'Programação de sábado',
        inicio: INICIO,
        duracaoMin: 60,
        status: 'publicado',
        localNome: 'Salão',
        localTipo: 'interno',
      },
    ],
    minhasEscalas: escala
      ? [
          {
            id: 'a1',
            estado: 'confirmada',
            eventoId: 'e1',
            eventoTitulo: 'Sábado com a juventude',
            eventoInicio: INICIO,
            ...escala,
          },
        ]
      : [],
    minhasTarefas: [],
    substituicoesAbertas: 0,
  }
}

describe('cartão "Meu repertório" no Início (D61)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('convocado ao louvor (pela etapa): o cartão aparece e abre o Meu repertório', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => ({
          status: 200,
          corpo: inicioCom({ funcao: 'integrante', etapaTitulo: 'Louvor' }),
        }),
      },
    })
    const abrir = await screen.findByRole('button', {
      name: 'Abrir o meu repertório de Sábado com a juventude',
    })
    await userEvent.setup().press(abrir)
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
  })

  test('função de banda (violão) no encontro todo também conta', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => ({
          status: 200,
          corpo: inicioCom({ funcao: 'violão', etapaTitulo: null }),
        }),
      },
    })
    expect(await screen.findByText('Meu repertório')).toBeOnTheScreen()
  })

  test('quem não toca (recepção) e quem recusou não vê o cartão', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => ({
          status: 200,
          corpo: inicioCom({ funcao: 'recepção', etapaTitulo: 'Palavra' }),
        }),
      },
    })
    await screen.findAllByText('Sábado com a juventude', { exact: false })
    expect(screen.queryByText('Meu repertório')).toBeNull()
  })

  test('convocação de louvor recusada não mostra o cartão', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => ({
          status: 200,
          corpo: inicioCom({ funcao: 'Bateria', etapaTitulo: 'Louvor', estado: 'recusada' }),
        }),
      },
    })
    await screen.findAllByText('Sábado com a juventude', { exact: false })
    expect(screen.queryByText('Meu repertório')).toBeNull()
  })

  test('sem nenhuma convocação, nada de cartão', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: inicioCom(null) }),
      },
    })
    await screen.findAllByText('Sábado com a juventude', { exact: false })
    expect(screen.queryByText('Meu repertório')).toBeNull()
  })
})
