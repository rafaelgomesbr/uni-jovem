import { screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'

import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { eventoDoMomento, inicioComMomento, momentoDeTeste } from '@/testes/momento'
import { BASE, PESSOAS, renderizarTela } from '@/testes/telas'

import { TelaLouvor } from '../TelaLouvor'

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

/** O Início aponta o próximo encontro; o encontro traz a banda (Bruno no violão, Carla no vocal, Marcos recusou). */
function rotasDoProximoEncontro() {
  const convocacao = (
    i: number,
    funcao: string,
    estado: 'confirmada' | 'pendente' | 'recusada',
    nome: string,
  ) => ({
    id: `atr-${i}`,
    etapaId: ETAPAS[1],
    vinculoId: PESSOAS[i % PESSOAS.length]!.vinculoId,
    funcao,
    estado,
    nome,
  })
  return {
    [`GET ${BASE}/inicio`]: () => ({
      status: 200,
      corpo: inicioComMomento(momentoDeTeste({ evento: eventoDoMomento({ id: EVENTO_ID }) })),
    }),
    [`GET ${BASE}/eventos/${EVENTO_ID}`]: () => ({
      status: 200,
      corpo: eventoDeTeste({
        atribuicoes: [
          convocacao(1, 'Violão', 'confirmada', 'Bruno Lima'),
          convocacao(2, 'Vocal', 'pendente', 'Carla Dias'),
          convocacao(0, 'Bateria', 'recusada', 'Marcos Lima'),
        ],
      }),
    }),
  }
}

describe('atalho Louvor (D61, D73): de toda a comunidade', () => {
  beforeEach(() => jest.clearAllMocks())

  test('leva ao repertório do próximo encontro, à Biblioteca, aos músicos e aos encontros', async () => {
    await renderizarTela(<TelaLouvor />, { papel: 'membro' })
    const usuario = userEvent.setup()
    await usuario.press(
      await screen.findByRole('button', { name: /^Repertório do próximo encontro\./ }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/meu-repertorio')
    await usuario.press(screen.getByRole('button', { name: /^Biblioteca de músicas\./ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/conteudos',
      params: { tipo: 'musicas' },
    })
    await usuario.press(screen.getByRole('button', { name: /^Músicos\./ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/conteudos',
      params: { tipo: 'musicos' },
    })
    await usuario.press(screen.getByRole('button', { name: /^Encontros\./ }))
    expect(router.push).toHaveBeenLastCalledWith('/agenda')
  })

  test('lembra que letra e cifra ficam só dentro da comunidade', async () => {
    await renderizarTela(<TelaLouvor />, { papel: 'membro' })
    expect(await screen.findByText('Só dentro da comunidade')).toBeOnTheScreen()
  })

  test('o membro que não toca vê quem toca no próximo encontro, sem "falta" nem situação (D73)', async () => {
    await renderizarTela(<TelaLouvor />, { papel: 'membro', rotas: rotasDoProximoEncontro() })
    // Quem recusou não aparece; ninguém diz o que falta (isso é da organização).
    expect(await screen.findByText('Quem toca: Bruno (violão), Carla (vocal).')).toBeOnTheScreen()
    expect(screen.queryByText(/Falta/)).toBeNull()
    expect(screen.queryByText(/aguardando|aceitou/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Convocar a banda' })).toBeNull()
  })

  test('quem organiza vê a banda com o que falta', async () => {
    await renderizarTela(<TelaLouvor />, { papel: 'organizador', rotas: rotasDoProximoEncontro() })
    expect(await screen.findByText(/Falta: /)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver os convocados' })).toBeOnTheScreen()
  })
})
