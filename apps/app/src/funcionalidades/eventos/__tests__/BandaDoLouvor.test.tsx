import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import type { Atribuicao } from '@/servicos/contratoDosEventos'
import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, COMUNIDADE, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { DetalheDoEvento } from '../DetalheDoEvento'

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
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`

function pessoa(n: number, funcao: string, estado: Atribuicao['estado'], nome: string): Atribuicao {
  return {
    id: `atr-${n}`,
    etapaId: ETAPAS[1],
    vinculoId: PESSOAS[n % PESSOAS.length]!.vinculoId,
    funcao,
    estado,
    nome,
  }
}

function montar(
  papel: 'organizador' | 'membro',
  atribuicoes: Atribuicao[],
  rotas: object = {},
  evento = eventoDeTeste(),
) {
  return renderizarTela(<DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />, {
    papel,
    rotas: {
      [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: { ...evento, atribuicoes } }),
      [`GET ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { itens: [] } }),
      [`GET ${BASE}/meu-repertorio`]: () => ({ status: 200, corpo: { encontros: [] } }),
      ...rotas,
    },
  })
}

describe('banda do encontro nos Convocados (D61)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('o louvor agrupa por função e diz o que falta: "Falta: bateria"', async () => {
    await montar('organizador', [
      pessoa(1, 'Vocal', 'confirmada', 'Bruno Lima'),
      pessoa(2, 'violao', 'confirmada', 'Carla Dias'),
      pessoa(3, 'Bateria', 'recusada', 'Ana Souza'),
    ])
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Convocados' }))
    // O texto original ("violao") continua na linha da pessoa, mas o bloco é o de Violão.
    expect(await screen.findByText('2 de 3 aceitaram. Falta: bateria')).toBeOnTheScreen()
    expect(screen.getByText('Vocal · 1')).toBeOnTheScreen()
    expect(screen.getByText('Violão · 1')).toBeOnTheScreen()
    expect(screen.getByText('Bateria · 1')).toBeOnTheScreen()
    expect(screen.getByText('Carla Dias')).toBeOnTheScreen()
    expect(
      screen.getByText('Ninguém convocado: guitarra, teclado, baixo, projeção, som.'),
    ).toBeOnTheScreen()
  })

  test('banda completa não mostra "Falta"', async () => {
    await montar('organizador', [
      pessoa(1, 'Vocal', 'confirmada', 'Bruno Lima'),
      pessoa(2, 'Bateria', 'confirmada', 'Carla Dias'),
    ])
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Convocados' }))
    expect(await screen.findByText('2 de 2 aceitaram')).toBeOnTheScreen()
    expect(screen.queryByText(/Falta:/)).toBeNull()
  })

  test('o resumo geral e os outros grupos seguem como antes', async () => {
    await montar('organizador', [pessoa(1, 'Vocal', 'pendente', 'Bruno Lima')])
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Convocados' }))
    expect(await screen.findByText('1 convocado: 1 aguardando')).toBeOnTheScreen()
    // Ninguém aceitou ainda: a função que foi convocada aparece como a que falta.
    expect(screen.getByText('0 de 1 aceitaram. Falta: vocal')).toBeOnTheScreen()
  })

  test('"Avisar a banda" nos Convocados confirma e avisa', async () => {
    const { servidor } = await montar(
      'organizador',
      [pessoa(1, 'Vocal', 'confirmada', 'Bruno Lima')],
      {
        [`POST ${CAMINHO}/repertorio/avisar`]: () => ({
          status: 200,
          corpo: { convocadas: 1, avisadas: 1 },
        }),
      },
    )
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Convocados' }))
    await usuario.press(await screen.findByRole('button', { name: 'Avisar a banda' }))
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Avisar a banda?' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/avisar`)).toHaveLength(1),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Aviso enviado a 1 pessoa da banda.' }),
    )
  })

  test('folha de convocar no Louvor: a função vem da lista da banda e é preciso escolher uma', async () => {
    await montar('organizador', [])
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Convocados' }))
    await usuario.press(screen.getByRole('button', { name: /^Convocar pessoa: .*Louvor$/ }))
    for (const funcao of [
      'Vocal',
      'Violão',
      'Guitarra',
      'Teclado',
      'Baixo',
      'Bateria',
      'Projeção',
      'Som',
      'Outro',
    ]) {
      expect(await screen.findByRole('radio', { name: funcao })).toBeOnTheScreen()
    }
    await usuario.press(screen.getByRole('radio', { name: 'Outro' }))
    expect(screen.getByLabelText(/^Nome da função/)).toBeOnTheScreen()
  })
})

describe('repertório no Roteiro do encontro (D61)', () => {
  beforeEach(() => jest.clearAllMocks())

  const ITENS = [
    {
      id: 'i1',
      ordem: 0,
      musicaId: 'm1',
      etapaId: ETAPAS[1],
      tomDoDia: 'A',
      nota: null,
      versao: 1,
      titulo: 'Grande é o Senhor',
      artista: null,
      tomOriginal: 'G',
      andamentoBpm: null,
      duracaoSeg: 240,
      arquivada: false,
      temCifra: true,
    },
    {
      id: 'i2',
      ordem: 1,
      musicaId: 'm2',
      etapaId: ETAPAS[1],
      tomDoDia: null,
      nota: null,
      versao: 1,
      titulo: 'Aleluia',
      artista: null,
      tomOriginal: 'D',
      andamentoBpm: null,
      duracaoSeg: 300,
      arquivada: false,
      temCifra: false,
    },
  ]

  test('organizador: resumo do tempo e o caminho para o repertório', async () => {
    await montar('organizador', [], {
      [`GET ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { itens: ITENS } }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    expect(await screen.findByText('Repertório do louvor')).toBeOnTheScreen()
    expect(screen.getByText('2 músicas, cerca de 9 min de 15 previstos')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Ver repertório' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/repertorio',
      params: { eventoId: EVENTO_ID },
    })
  })

  test('organizador sem músicas ainda: "Montar repertório"', async () => {
    await montar('organizador', [])
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Roteiro' }))
    expect(await screen.findByRole('button', { name: 'Montar repertório' })).toBeOnTheScreen()
  })

  test('membro não convocado e sem músicas: nada de cartão de repertório', async () => {
    await montar('membro', [])
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Roteiro' }))
    await screen.findByText(/Total .* previstos/)
    expect(screen.queryByText('Repertório do louvor')).toBeNull()
  })

  test('membro convocado ao louvor ganha o atalho "Meu repertório" no encontro', async () => {
    await montar('membro', [], {
      [`GET ${BASE}/meu-repertorio`]: () => ({
        status: 200,
        corpo: {
          encontros: [
            {
              evento: {
                id: EVENTO_ID,
                titulo: 'Sábado',
                inicio: '2026-11-28T19:00:00.000Z',
                fuso: 'America/Sao_Paulo',
              },
              convocacoes: [{ atribuicaoId: 'a1', funcao: 'Violão', estado: 'confirmada' }],
              itens: [],
            },
          ],
        },
      }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    await usuario.press(await screen.findByRole('button', { name: /^Abrir o meu repertório/ }))
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
  })
})
