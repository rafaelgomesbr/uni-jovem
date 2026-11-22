import { screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'

import { INICIO } from '@/testes/fixturas'
import { inicioComMomento, momentoDeTeste, parteDoMomento, RELOGIO } from '@/testes/momento'
import { BASE, renderizarTela } from '@/testes/telas'
import type { ParteDoMomento } from '@/servicos/contratoV3'

import { escalaDeLouvor } from '../../repertorio/souDoLouvor'
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
  [`GET ${BASE}/visao-geral?escopo=minha`]: () => ({
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

const rotasCom = (parte: Partial<ParteDoMomento> | null, relogio: object = {}) => ({
  ...VISAO,
  [`GET ${BASE}/inicio`]: () => ({
    status: 200,
    corpo: inicioComMomento(
      momentoDeTeste({
        ...relogio,
        suaParte: parte ? [parteDoMomento({ estado: 'confirmada', ...parte })] : [],
      }),
    ),
  }),
})

const ABRIR = { name: 'Abrir o meu repertório de Sábado Jovem' }

describe('modo músico no Início (D61, D62, D68): o botão "Abrir o repertório" no cartão do momento', () => {
  beforeEach(() => jest.clearAllMocks())

  test('convocado ao louvor (pela etapa): é o primário do cartão e leva ao Meu repertório', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'integrante', etapaTitulo: 'Louvor' }),
    })
    const abrir = await screen.findByRole('button', ABRIR)
    await userEvent.setup().press(abrir)
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
    // O cartão "Meu repertório" não existe mais no Início.
    expect(screen.queryByText('Meu repertório')).toBeNull()
  })

  test('função de banda (violão) no encontro inteiro também conta', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'violão', etapaTitulo: null }),
    })
    expect(await screen.findByRole('button', ABRIR)).toBeOnTheScreen()
  })

  test('quem não toca (recepção) não vê o botão', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'recepção', etapaTitulo: 'Palavra' }),
    })
    await screen.findByText('Sua parte: Palavra · recepção')
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
  })

  test('convocação de louvor recusada não mostra o botão nem a linha "Sua parte"', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'Bateria', etapaTitulo: 'Louvor', estado: 'recusada' }),
    })
    await screen.findByText('Você avisou que não pode. A liderança será avisada.')
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
    expect(screen.queryByText(/^Sua parte/)).toBeNull()
  })

  test('convocação de louvor ainda pendente: primeiro responder; o repertório só depois de aceitar', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'Vocal', etapaTitulo: 'Louvor', estado: 'pendente' }),
    })
    expect(await screen.findByRole('button', { name: /^Aceitar a convocação/ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
  })

  test('sem nenhuma convocação, nada de botão', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'membro', rotas: rotasCom(null) })
    await screen.findByRole('button', { name: 'Ver o encontro' })
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
  })

  test('na véspera o primário é "Como chegar", e o repertório continua a um toque', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'Vocal', etapaTitulo: 'Louvor' }, RELOGIO.vespera),
    })
    expect(
      await screen.findByRole('button', { name: 'Como chegar a Sábado Jovem' }),
    ).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', ABRIR))
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
  })
})

describe('escalaDeLouvor', () => {
  const base = {
    id: 'a1',
    estado: 'confirmada',
    eventoId: 'e1',
    eventoTitulo: 'Sábado',
    eventoInicio: INICIO,
    funcao: 'Vocal',
    etapaTitulo: null,
  } as const

  test('acha a convocação de banda e ignora a recusada e a de outra função', () => {
    expect(escalaDeLouvor([{ ...base, funcao: 'Recepção' }])).toBeNull()
    expect(escalaDeLouvor([{ ...base, estado: 'recusada' }])).toBeNull()
    expect(escalaDeLouvor([{ ...base, funcao: 'Recepção' }, base])).toBe(base)
  })
})
