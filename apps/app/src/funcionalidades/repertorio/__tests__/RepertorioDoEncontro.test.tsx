import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { encontroDoMeuRepertorioDeTeste } from '@/testes/repertorio'
import { BASE, pedidosPara, PESSOAS, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast, mostrarToast } from '@/ui/Toast'
import { confirmarAgora, desfazerAgora } from '@/ui/ToastComDesfazer'

import { TelaRepertorioDoEncontro } from '../TelaRepertorioDoEncontro'

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
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`

const ITEM_1: ItemDoRepertorio = {
  id: '77777777-7777-4777-8777-000000000001',
  ordem: 0,
  musicaId: '99999999-9999-4999-8999-000000000001',
  etapaId: ETAPAS[1],
  tomDoDia: 'A',
  nota: 'Entra só o coro',
  versao: 1,
  titulo: 'Grande é o Senhor',
  artista: 'Ministério Exemplo',
  tomOriginal: 'G',
  andamentoBpm: 72,
  duracaoSeg: 240,
  arquivada: false,
  temCifra: true,
}
const ITEM_2: ItemDoRepertorio = {
  ...ITEM_1,
  id: '77777777-7777-4777-8777-000000000002',
  ordem: 1,
  musicaId: '99999999-9999-4999-8999-000000000002',
  tomDoDia: null,
  nota: null,
  titulo: 'Aleluia',
  artista: null,
  tomOriginal: 'D',
  andamentoBpm: null,
  duracaoSeg: 300,
  temCifra: false,
}

function montar(
  papel: 'organizador' | 'membro',
  itens: ItemDoRepertorio[],
  rotas: Record<string, never> | object = {},
  evento = eventoDeTeste({ duracaoMin: 30 }),
) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
  return renderizarTela(
    <>
      <TelaRepertorioDoEncontro />
      <HospedeiroDeToast />
    </>,
    {
      papel,
      rotas: {
        [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: evento }),
        [`GET ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { itens } }),
        [`GET ${BASE}/meu-repertorio`]: () => ({ status: 200, corpo: { encontros: [] } }),
        ...rotas,
      },
    },
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  desfazerAgora()
})
afterEach(() => desfazerAgora())

describe('repertório do encontro no visual A (D71)', () => {
  test('lista na ordem de execução, com o tom do dia em texto e a soma do tempo', async () => {
    // A API pode mandar fora de ordem: a tela segue o campo `ordem`.
    await montar('organizador', [ITEM_2, ITEM_1])
    expect(
      await screen.findByLabelText(
        /^Música 1 de 2: Grande é o Senhor\. Tom A \(original G\) · 72 bpm · 4:00 · Ministério Exemplo\./,
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText(/^Música 2 de 2: Aleluia\. Tom D · 5:00 · Sem cifra\.$/),
    ).toBeOnTheScreen()
    expect(screen.getByText('Entra só o coro')).toBeOnTheScreen()
    // Soma 9 min contra os 15 da etapa Louvor: só informa, nada bloqueia.
    expect(screen.getByText('2 músicas, cerca de 9 min de 15 previstos')).toBeOnTheScreen()
    expect(screen.getByText('Sem cifra')).toBeOnTheScreen()
    expect(screen.queryByText('Passa do tempo da etapa')).toBeNull()
  })

  test('passar do tempo da etapa é só um aviso', async () => {
    const longa = { ...ITEM_2, duracaoSeg: 900 }
    await montar('organizador', [ITEM_1, longa])
    expect(await screen.findByText('Passa do tempo da etapa')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Adicionar músicas' })).toBeEnabled()
  })

  test('sobe e desce por botões e a ordem nova vai ao servidor', async () => {
    const { servidor } = await montar('organizador', [ITEM_1, ITEM_2], {
      [`PUT ${CAMINHO}/repertorio/ordem`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    const usuario = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Subir Grande é o Senhor' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descer Aleluia' })).toBeDisabled()
    await usuario.press(screen.getByRole('button', { name: 'Descer Grande é o Senhor' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PUT', `${CAMINHO}/repertorio/ordem`)[0]?.corpo).toEqual({
        ids: [ITEM_2.id, ITEM_1.id],
      }),
    )
  })

  test('membro só lê: sem botões de edição, e tocar numa música abre a cifra', async () => {
    await montar('membro', [ITEM_1, ITEM_2])
    expect(await screen.findByLabelText(/^Música 1 de 2: Grande é o Senhor/)).toBeOnTheScreen()
    for (const nome of [
      'Adicionar músicas',
      'Avisar a banda',
      'Subir Aleluia',
      'Descer Grande é o Senhor',
      'Subir meio tom do dia de Aleluia',
      'Mais ações de Aleluia',
    ]) {
      expect(screen.queryByRole('button', { name: nome })).toBeNull()
    }
    await userEvent.setup().press(screen.getByLabelText(/^Música 1 de 2: Grande é o Senhor/))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/conteudos/[tipo]/[itemId]',
      params: { tipo: 'musicas', itemId: ITEM_1.musicaId },
    })
  })

  describe('tom do dia', () => {
    test('Tom + e Tom −: meio tom a partir do que vale hoje, com a versão vista', async () => {
      const { servidor } = await montar('organizador', [ITEM_1, ITEM_2], {
        [`PATCH ${CAMINHO}/repertorio/${ITEM_2.id}`]: () => ({
          status: 200,
          corpo: { id: ITEM_2.id, versao: 2 },
        }),
      })
      // Aleluia está no tom original D: meio tom para cima é Eb (vira o tom do dia).
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Subir meio tom do dia de Aleluia' }))
      await waitFor(() =>
        expect(
          pedidosPara(servidor, 'PATCH', `${CAMINHO}/repertorio/${ITEM_2.id}`)[0]?.corpo,
        ).toEqual({ versao: 1, tomDoDia: 'Eb' }),
      )
    })

    test('voltar ao tom original limpa o tom do dia', async () => {
      // Original G, tom do dia Ab: meio tom para baixo é G, o original.
      const emAb = { ...ITEM_1, tomDoDia: 'Ab' }
      const { servidor } = await montar('organizador', [emAb], {
        [`PATCH ${CAMINHO}/repertorio/${ITEM_1.id}`]: () => ({
          status: 200,
          corpo: { id: ITEM_1.id, versao: 2 },
        }),
      })
      await userEvent.setup().press(
        await screen.findByRole('button', {
          name: 'Descer meio tom do dia de Grande é o Senhor',
        }),
      )
      await waitFor(() =>
        expect(
          pedidosPara(servidor, 'PATCH', `${CAMINHO}/repertorio/${ITEM_1.id}`)[0]?.corpo,
        ).toEqual({ versao: 1, tomDoDia: null }),
      )
    })

    test('sem tom cadastrado: Tom − e + ficam desligados e a tela diz onde escolher', async () => {
      await montar('organizador', [{ ...ITEM_2, tomOriginal: null }])
      expect(
        await screen.findByRole('button', { name: 'Subir meio tom do dia de Aleluia' }),
      ).toBeDisabled()
      expect(
        screen.getByText('Esta música não tem tom cadastrado. Escolha o tom do dia em Mais.'),
      ).toBeOnTheScreen()
    })

    test('escolher o tom por escrito (Mais): a folha anda e salva', async () => {
      const { servidor } = await montar('organizador', [ITEM_1, ITEM_2], {
        [`PATCH ${CAMINHO}/repertorio/${ITEM_2.id}`]: () => ({
          status: 200,
          corpo: { id: ITEM_2.id, versao: 2 },
        }),
      })
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByRole('button', { name: 'Mais ações de Aleluia' }))
      await usuario.press(await screen.findByRole('button', { name: /^Escolher o tom do dia/ }))
      expect(await screen.findByText(/o tom original é D/)).toBeOnTheScreen()
      await usuario.press(screen.getByRole('button', { name: 'Subir meio tom' }))
      expect(screen.getByDisplayValue('Eb')).toBeOnTheScreen()
      await usuario.press(screen.getByRole('button', { name: 'Salvar tom do dia' }))
      await waitFor(() =>
        expect(
          pedidosPara(servidor, 'PATCH', `${CAMINHO}/repertorio/${ITEM_2.id}`)[0]?.corpo,
        ).toEqual({ versao: 1, tomDoDia: 'Eb' }),
      )
    })

    test('tom inválido é recusado com mensagem humana, sem pedido ao servidor', async () => {
      const { servidor } = await montar('organizador', [ITEM_1])
      const usuario = userEvent.setup()
      await usuario.press(
        await screen.findByRole('button', { name: 'Mais ações de Grande é o Senhor' }),
      )
      await usuario.press(await screen.findByRole('button', { name: /^Escolher o tom do dia/ }))
      const campo = await screen.findByDisplayValue('A')
      await usuario.clear(campo)
      await usuario.type(campo, 'XYZ')
      await usuario.press(screen.getByRole('button', { name: 'Salvar tom do dia' }))
      expect(await screen.findByText('Use um tom como G, Am, F#m ou Bb.')).toBeOnTheScreen()
      expect(pedidosPara(servidor, 'PATCH', `${CAMINHO}/repertorio/${ITEM_1.id}`)).toHaveLength(0)
    })
  })

  describe('adicionar da biblioteca', () => {
    const biblioteca = [
      {
        id: ITEM_1.musicaId,
        titulo: ITEM_1.titulo,
        artista: null,
        tom: 'G',
        temCifra: true,
        arquivada: false,
      },
      {
        id: 'm-nova',
        titulo: 'Nova música',
        artista: 'Ministério',
        tom: 'E',
        temCifra: false,
        arquivada: false,
      },
      {
        id: 'm-outra',
        titulo: 'Outra canção',
        artista: null,
        tom: 'C',
        temCifra: true,
        arquivada: false,
      },
      {
        id: 'm-velha',
        titulo: 'Música arquivada',
        artista: null,
        tom: 'C',
        temCifra: true,
        arquivada: true,
      },
    ]

    test('marca várias e adiciona de uma vez, na ordem marcada; as que já estão não aparecem', async () => {
      const { servidor } = await montar('organizador', [ITEM_1], {
        [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens: biblioteca } }),
        [`POST ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { id: 'novo', ordem: 1 } }),
      })
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByRole('button', { name: 'Adicionar músicas' }))

      const outra = await screen.findByRole('checkbox', { name: /^Outra canção/ })
      expect(screen.queryByRole('checkbox', { name: /^Grande é o Senhor/ })).toBeNull()
      expect(screen.queryByRole('checkbox', { name: /Música arquivada/ })).toBeNull()
      // Sem marcar nada, o botão pede para marcar.
      expect(screen.getByRole('button', { name: 'Marque as músicas' })).toBeDisabled()

      await usuario.press(outra)
      await usuario.press(screen.getByRole('checkbox', { name: /^Nova música/ }))
      await usuario.press(screen.getByRole('button', { name: 'Adicionar 2 músicas' }))

      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio`).map((p) => p.corpo)).toEqual([
          { musicaId: 'm-outra' },
          { musicaId: 'm-nova' },
        ]),
      )
      await waitFor(() =>
        expect(mostrarToast).toHaveBeenCalledWith({
          texto: '2 músicas adicionadas ao repertório.',
        }),
      )
    })

    test('biblioteca vazia leva a cadastrar a primeira música', async () => {
      await montar('organizador', [], {
        [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens: [] } }),
      })
      const usuario = userEvent.setup()
      await usuario.press((await screen.findAllByRole('button', { name: 'Adicionar músicas' }))[0]!)
      await usuario.press(await screen.findByRole('button', { name: 'Cadastrar música' }))
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/conteudos/[tipo]/novo',
        params: { tipo: 'musicas' },
      })
    })
  })

  describe('tirar com Desfazer', () => {
    test('some da lista na hora e só é removida no servidor depois dos 10 s', async () => {
      const { servidor } = await montar('organizador', [ITEM_1, ITEM_2], {
        [`DELETE ${CAMINHO}/repertorio/${ITEM_2.id}`]: () => ({ status: 200, corpo: { ok: true } }),
      })
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByRole('button', { name: 'Mais ações de Aleluia' }))
      await usuario.press(await screen.findByRole('button', { name: /^Tirar do repertório/ }))

      await waitFor(() => expect(screen.queryByLabelText(/^Música 2 de 2: Aleluia/)).toBeNull())
      expect(screen.getByText('Aleluia saiu do repertório.')).toBeOnTheScreen()
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/repertorio/${ITEM_2.id}`)).toHaveLength(0)

      await act(async () => confirmarAgora())
      await waitFor(() =>
        expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/repertorio/${ITEM_2.id}`)).toHaveLength(
          1,
        ),
      )
    })

    test('Desfazer traz a música de volta e nada é enviado', async () => {
      const { servidor } = await montar('organizador', [ITEM_1, ITEM_2])
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByRole('button', { name: 'Mais ações de Aleluia' }))
      await usuario.press(await screen.findByRole('button', { name: /^Tirar do repertório/ }))
      await waitFor(() => expect(screen.queryByLabelText(/^Música 2 de 2: Aleluia/)).toBeNull())

      await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
      expect(await screen.findByLabelText(/^Música 2 de 2: Aleluia/)).toBeOnTheScreen()
      expect(servidor.pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(0)
    })
  })

  describe('avisar a banda', () => {
    test('com Desfazer de 10 s: nada sai antes, e depois diz a quantas pessoas', async () => {
      const { servidor } = await montar('organizador', [ITEM_1], {
        [`POST ${CAMINHO}/repertorio/avisar`]: () => ({
          status: 200,
          corpo: { convocadas: 3, avisadas: 2 },
        }),
      })
      await userEvent.setup().press(await screen.findByRole('button', { name: 'Avisar a banda' }))
      expect(screen.getByText('Avisando a banda de que o repertório mudou.')).toBeOnTheScreen()
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/avisar`)).toHaveLength(0)

      await act(async () => confirmarAgora())
      await waitFor(() =>
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/avisar`)).toHaveLength(1),
      )
      await waitFor(() =>
        expect(mostrarToast).toHaveBeenCalledWith({
          texto: 'Pronto. Aviso enviado a 2 pessoas da banda.',
        }),
      )
    })

    test('Desfazer cancela: a banda não é avisada', async () => {
      const { servidor } = await montar('organizador', [ITEM_1])
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByRole('button', { name: 'Avisar a banda' }))
      await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/avisar`)).toHaveLength(0)
    })

    test('num rascunho fica desligado, com o motivo escrito', async () => {
      await montar('organizador', [ITEM_1], {}, eventoDeTeste({ status: 'rascunho' }))
      expect(await screen.findByRole('button', { name: 'Avisar a banda' })).toBeDisabled()
      expect(screen.getByText('Publique o encontro para avisar a banda.')).toBeOnTheScreen()
    })
  })

  describe('a banda do encontro', () => {
    const atribuicao = (
      i: number,
      funcao: string,
      estado: 'pendente' | 'confirmada' | 'recusada',
      nome: string,
    ) => ({
      id: `atr-${i}`,
      etapaId: ETAPAS[1],
      vinculoId: PESSOAS[i % PESSOAS.length]!.vinculoId,
      funcao,
      estado,
      nome,
    })

    test('um bloco por instrumento e "Falta: bateria" em texto, com ícone', async () => {
      await montar(
        'organizador',
        [ITEM_1],
        {},
        eventoDeTeste({
          duracaoMin: 30,
          atribuicoes: [
            atribuicao(0, 'Violão', 'confirmada', 'Bruno Lima'),
            atribuicao(1, 'Vocal', 'confirmada', 'Carla Dias'),
            atribuicao(2, 'Bateria', 'pendente', 'Marcos Lima'),
          ],
        }),
      )
      expect(await screen.findByText('2 de 3 aceitaram. Falta: bateria')).toBeOnTheScreen()
      expect(screen.getByText('Bruno (aceitou)')).toBeOnTheScreen()
      expect(screen.getByText('Marcos (aguardando)')).toBeOnTheScreen()
      // O que falta leva a palavra, não só a cor.
      expect(screen.getByText('Falta')).toBeOnTheScreen()
      expect(screen.queryByText('Banda completa')).toBeNull()
    })

    test('todos aceitaram: "Banda completa" em texto', async () => {
      await montar(
        'organizador',
        [ITEM_1],
        {},
        eventoDeTeste({
          duracaoMin: 30,
          atribuicoes: [
            atribuicao(0, 'Violão', 'confirmada', 'Bruno Lima'),
            atribuicao(1, 'Bateria', 'confirmada', 'Carla Dias'),
          ],
        }),
      )
      expect(await screen.findByText('Banda completa')).toBeOnTheScreen()
      expect(screen.getByText('2 de 2 aceitaram')).toBeOnTheScreen()
    })

    test('ninguém convocado ao louvor: quem organiza é levado a convocar', async () => {
      await montar('organizador', [ITEM_1], {}, eventoDeTeste({ duracaoMin: 30, atribuicoes: [] }))
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByRole('button', { name: 'Convocar a banda' }))
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]',
        params: { eventoId: EVENTO_ID },
      })
    })

    test('quem não organiza lê "Quem toca", sem "Falta" nem a situação de cada resposta (D73)', async () => {
      await montar(
        'membro',
        [ITEM_1],
        {},
        eventoDeTeste({
          duracaoMin: 30,
          atribuicoes: [
            atribuicao(0, 'Violão', 'confirmada', 'Bruno Lima'),
            atribuicao(1, 'Vocal', 'pendente', 'Carla Dias'),
            atribuicao(2, 'Bateria', 'recusada', 'Marcos Lima'),
            // A mesma pessoa em duas funções aparece uma vez, com as duas.
            { ...atribuicao(0, 'Vocal', 'confirmada', 'Bruno Lima'), id: 'atr-dupla' },
          ],
        }),
      )
      expect(
        await screen.findByText('Quem toca: Bruno (violão, vocal), Carla (vocal).'),
      ).toBeOnTheScreen()
      expect(screen.queryByText(/Falta/)).toBeNull()
      expect(screen.queryByText(/aguardando|aceitou|aceitaram/)).toBeNull()
      expect(screen.queryByText('Banda completa')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Ver os convocados' })).toBeNull()
    })

    test('quem não organiza não vê a banda vazia', async () => {
      await montar('membro', [ITEM_1], {}, eventoDeTeste({ duracaoMin: 30, atribuicoes: [] }))
      await screen.findByLabelText(/^Música 1 de 1/)
      expect(screen.queryByText('Banda')).toBeNull()
    })
  })

  describe('os três estados', () => {
    test('vazio: organizador é convidado a adicionar; membro, a esperar', async () => {
      await montar('organizador', [])
      expect(await screen.findByText('Nenhuma música no repertório')).toBeOnTheScreen()
      expect(screen.getAllByRole('button', { name: 'Adicionar músicas' }).length).toBeGreaterThan(0)
    })

    test('vazio para quem não edita', async () => {
      await montar('membro', [])
      expect(await screen.findByText('Nenhuma música no repertório')).toBeOnTheScreen()
      expect(
        screen.getByText('A organização ainda não montou o repertório deste encontro.'),
      ).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: 'Adicionar músicas' })).toBeNull()
    })

    test('erro ao carregar: mensagem humana e "Tentar de novo"', async () => {
      await montar('organizador', [], {
        [`GET ${CAMINHO}/repertorio`]: () => ({
          status: 500,
          corpo: { erro: 'interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
        }),
      })
      expect(await screen.findByText('Não deu para carregar o repertório.')).toBeOnTheScreen()
      expect(screen.getByText('Algo deu errado do nosso lado. Tente de novo.')).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
    })

    test('carregando: esqueleto com a forma da lista', async () => {
      await montar('organizador', [], {
        [`GET ${CAMINHO}/repertorio`]: () => new Promise<never>(() => {}),
      })
      expect(await screen.findByLabelText('Carregando o repertório')).toBeOnTheScreen()
    })
  })

  test('quem toca no louvor ganha o atalho para o Meu repertório e o cartão de uso sem internet', async () => {
    await montar('membro', [ITEM_1], {
      [`GET ${BASE}/meu-repertorio`]: () => ({
        status: 200,
        corpo: { encontros: [encontroDoMeuRepertorioDeTeste()] },
      }),
    })
    const atalho = await screen.findByRole('button', { name: 'Abrir o meu repertório' })
    await userEvent.setup().press(atalho)
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
    expect(screen.getByText('Usar sem internet')).toBeOnTheScreen()
  })
})
