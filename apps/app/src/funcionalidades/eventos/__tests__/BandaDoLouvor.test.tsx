import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import type { Atribuicao } from '@/servicos/contratoDosEventos'
import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, COMUNIDADE, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmarAgora, desfazerAgora } from '@/ui/ToastComDesfazer'

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

describe('banda do encontro no Quem vai (D61, D74)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    desfazerAgora()
  })

  test('o louvor agrupa por função e diz o que falta: "Falta: bateria"', async () => {
    await montar('organizador', [
      pessoa(1, 'Vocal', 'confirmada', 'Bruno Lima'),
      pessoa(2, 'violao', 'confirmada', 'Carla Dias'),
      pessoa(3, 'Bateria', 'recusada', 'Ana Souza'),
    ])
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Quem vai' }))
    // A banda é uma seção da lista: cada pessoa com o que faz na mesma linha. O texto original
    // ("violao") vira a função da lista padrão ("Violão").
    expect(await screen.findByText('Banda')).toBeOnTheScreen()
    expect(screen.getByText('Carla Dias')).toBeOnTheScreen()
    // (os nomes das funções também são opções da folha de convocar, fechada: por isso "getAll")
    expect(screen.getAllByText('Violão').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Vocal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bateria').length).toBeGreaterThan(0)
    // As funções sem ninguém ficam à vista, cada uma com o seu "Convocar".
    expect(screen.getByText('Sem ninguém ainda')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Convocar para Guitarra' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Convocar para Som' })).toBeOnTheScreen()
    // O resumo de cima conta quem respondeu (quem recusou também respondeu).
    // Com todos respondidos o título é "Todos responderam", uma vez só (D73).
    expect(screen.getByText('Todos responderam')).toBeOnTheScreen()
    expect(screen.queryByText('3 de 3 responderam')).toBeNull()
    expect(screen.getByText('Falta: bateria')).toBeOnTheScreen()
  })

  test('banda completa não mostra "Falta"', async () => {
    await montar('organizador', [
      pessoa(1, 'Vocal', 'confirmada', 'Bruno Lima'),
      pessoa(2, 'Bateria', 'confirmada', 'Carla Dias'),
    ])
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Quem vai' }))
    expect(await screen.findByText('Todos responderam')).toBeOnTheScreen()
    expect(screen.queryByText(/Falta:/)).toBeNull()
  })

  test('o resumo diz "0 de 1 responderam" e quem falta; o chip da pessoa tem a palavra', async () => {
    await montar('organizador', [pessoa(1, 'Vocal', 'pendente', 'Bruno Lima')])
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Quem vai' }))
    expect(await screen.findByText('0 de 1 responderam')).toBeOnTheScreen()
    expect(screen.getByText('Faltam: Bruno Lima')).toBeOnTheScreen()
    expect(screen.getAllByText('Aguardando').length).toBeGreaterThan(0)
    // Ninguém aceitou ainda: a função que foi convocada aparece como a que falta.
    expect(screen.getByText('Falta: vocal')).toBeOnTheScreen()
  })

  test('"Avisar a banda" no Quem vai avisa depois do Desfazer', async () => {
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
    await usuario.press(await screen.findByRole('radio', { name: 'Quem vai' }))
    await usuario.press(await screen.findByRole('button', { name: 'Avisar a banda' }))
    // D71: avisar gente não pede "tem certeza?": o Desfazer de 5 s segura o envio e só então sai.
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/avisar`)).toHaveLength(0)
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/avisar`)).toHaveLength(1),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Pronto. Aviso enviado a 1 pessoa da banda.',
      }),
    )
  })

  test('folha de convocar no Louvor: a função vem da lista da banda e é preciso escolher uma', async () => {
    await montar('organizador', [])
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Quem vai' }))
    // Sem ninguém convocado, o vazio convida; a folha mostra as funções da banda à vista, sem "Onde".
    await usuario.press(screen.getByRole('button', { name: 'Convocar pessoas' }))
    expect(screen.queryByRole('radio', { name: 'Louvor' })).toBeNull()
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
})
