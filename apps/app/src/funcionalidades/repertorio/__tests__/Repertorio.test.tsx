import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import type { EncontroDoMeuRepertorio, ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { TelaCifraDoRepertorio } from '../TelaCifraDoRepertorio'
import { TelaMeuRepertorio } from '../TelaMeuRepertorio'
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
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`
const CIFRA = '{key: G}\n[G]Sobre a rocha eu [D]firmo\n[Em]Quando o vento [C]vem'

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

function montarRepertorio(
  papel: 'organizador' | 'membro',
  itens: ItemDoRepertorio[],
  rotas: Record<string, never> | object = {},
  evento = eventoDeTeste({ duracaoMin: 30 }),
) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
  return renderizarTela(<TelaRepertorioDoEncontro />, {
    papel,
    rotas: {
      [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: evento }),
      [`GET ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { itens } }),
      [`GET ${BASE}/meu-repertorio`]: () => ({ status: 200, corpo: { encontros: [] } }),
      ...rotas,
    },
  })
}

describe('repertório do encontro (D61)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('lista na ordem de execução, com o tom do dia e a soma do tempo', async () => {
    // A API pode mandar fora de ordem: a tela segue o campo `ordem`.
    await montarRepertorio('organizador', [ITEM_2, ITEM_1])
    expect(
      await screen.findByLabelText(
        /^Música 1 de 2: Grande é o Senhor\. Tom do dia A \(original G\) · 72 bpm · 4:00/,
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText(/^Música 2 de 2: Aleluia\. Tom D · 5:00.* Sem cifra\.$/),
    ).toBeOnTheScreen()
    expect(screen.getByText('Entra só o coro')).toBeOnTheScreen()
    // Soma 9 min contra os 15 da etapa Louvor: só informa, nada bloqueia.
    expect(screen.getByText('2 músicas, cerca de 9 min de 15 previstos')).toBeOnTheScreen()
    expect(screen.getByText('Sem cifra')).toBeOnTheScreen()
    expect(screen.queryByText('Passa do tempo da etapa')).toBeNull()
  })

  test('passar do tempo da etapa é só um aviso', async () => {
    const longa = { ...ITEM_2, duracaoSeg: 900 }
    await montarRepertorio('organizador', [ITEM_1, longa])
    expect(await screen.findByText('Passa do tempo da etapa')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Adicionar música' })).toBeEnabled()
  })

  test('organizador sobe e desce por botões e a ordem nova vai ao servidor', async () => {
    const { servidor } = await montarRepertorio('organizador', [ITEM_1, ITEM_2], {
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

  test('membro só lê: sem botões de edição, com "Abrir cifra"', async () => {
    await montarRepertorio('membro', [ITEM_1, ITEM_2])
    expect(await screen.findByLabelText(/^Música 1 de 2: Grande é o Senhor/)).toBeOnTheScreen()
    for (const nome of [
      'Adicionar música',
      'Avisar a banda',
      'Subir Aleluia',
      'Descer Grande é o Senhor',
      'Mudar o tom do dia de Aleluia',
      'Tirar Aleluia do repertório',
    ]) {
      expect(screen.queryByRole('button', { name: nome })).toBeNull()
    }
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Abrir a cifra de Grande é o Senhor' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/conteudos/[tipo]/[itemId]',
      params: { tipo: 'musicas', itemId: ITEM_1.musicaId },
    })
  })

  test('tom do dia: meio tom para cima a partir do original e salva com a versão vista', async () => {
    const { servidor } = await montarRepertorio('organizador', [ITEM_1, ITEM_2], {
      [`PATCH ${CAMINHO}/repertorio/${ITEM_2.id}`]: () => ({
        status: 200,
        corpo: { id: ITEM_2.id, versao: 2 },
      }),
    })
    const usuario = userEvent.setup()
    await usuario.press(
      await screen.findByRole('button', { name: 'Mudar o tom do dia de Aleluia' }),
    )
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

  test('tom do dia inválido é recusado com mensagem humana, sem pedido ao servidor', async () => {
    const { servidor } = await montarRepertorio('organizador', [ITEM_1])
    const usuario = userEvent.setup()
    await usuario.press(
      await screen.findByRole('button', { name: 'Mudar o tom do dia de Grande é o Senhor' }),
    )
    const campo = await screen.findByDisplayValue('A')
    await usuario.clear(campo)
    await usuario.type(campo, 'XYZ')
    await usuario.press(screen.getByRole('button', { name: 'Salvar tom do dia' }))
    expect(await screen.findByText('Use um tom como G, Am, F#m ou Bb.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'PATCH', `${CAMINHO}/repertorio/${ITEM_1.id}`)).toHaveLength(0)
  })

  test('adicionar música da biblioteca (as que já estão no repertório não aparecem)', async () => {
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
        id: 'm-velha',
        titulo: 'Música arquivada',
        artista: null,
        tom: 'C',
        temCifra: true,
        arquivada: true,
      },
    ]
    const { servidor } = await montarRepertorio('organizador', [ITEM_1], {
      [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens: biblioteca } }),
      [`POST ${CAMINHO}/repertorio`]: () => ({ status: 200, corpo: { id: 'novo', ordem: 1 } }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Adicionar música' }))
    const nova = await screen.findByRole('button', { name: 'Adicionar Nova música ao repertório' })
    expect(screen.queryByRole('button', { name: /Adicionar Grande é o Senhor ao/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Música arquivada/ })).toBeNull()
    await usuario.press(nova)
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio`)[0]?.corpo).toEqual({
        musicaId: 'm-nova',
      }),
    )
  })

  test('tirar do repertório pede confirmação', async () => {
    const { servidor } = await montarRepertorio('organizador', [ITEM_1, ITEM_2], {
      [`DELETE ${CAMINHO}/repertorio/${ITEM_2.id}`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Tirar Aleluia do repertório' }))
    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'Tirar Aleluia do repertório?', destrutivo: true }),
    )
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/repertorio/${ITEM_2.id}`)).toHaveLength(1),
    )
  })

  test('vazio: organizador é convidado a adicionar; membro, a esperar', async () => {
    await montarRepertorio('organizador', [])
    expect(await screen.findByText('Nenhuma música no repertório')).toBeOnTheScreen()
    expect(screen.getAllByRole('button', { name: 'Adicionar música' }).length).toBeGreaterThan(0)
  })

  test('vazio para quem não edita', async () => {
    await montarRepertorio('membro', [])
    expect(await screen.findByText('Nenhuma música no repertório')).toBeOnTheScreen()
    expect(
      screen.getByText('A organização ainda não montou o repertório deste encontro.'),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Adicionar música' })).toBeNull()
  })

  test('erro ao carregar: mensagem humana e "Tentar de novo"', async () => {
    await montarRepertorio('organizador', [], {
      [`GET ${CAMINHO}/repertorio`]: () => ({
        status: 500,
        corpo: { erro: 'interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
      }),
    })
    expect(await screen.findByText('O repertório não abriu')).toBeOnTheScreen()
    expect(screen.getByText('Algo deu errado do nosso lado. Tente de novo.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('avisar a banda: confirma, avisa e diz a quantas pessoas', async () => {
    const { servidor } = await montarRepertorio('organizador', [ITEM_1], {
      [`POST ${CAMINHO}/repertorio/avisar`]: () => ({
        status: 200,
        corpo: { convocadas: 3, avisadas: 2 },
      }),
    })
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Avisar a banda' }))
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Avisar a banda?' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/avisar`)).toHaveLength(1),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Aviso enviado a 2 pessoas da banda.' }),
    )
  })

  test('avisar a banda num rascunho fica desligado, com o motivo', async () => {
    await montarRepertorio('organizador', [ITEM_1], {}, eventoDeTeste({ status: 'rascunho' }))
    expect(await screen.findByRole('button', { name: 'Avisar a banda' })).toBeDisabled()
    expect(screen.getByText('Publique o encontro para avisar a banda.')).toBeOnTheScreen()
  })

  test('quem está convocado ao louvor ganha o atalho para o Meu repertório', async () => {
    await montarRepertorio('membro', [ITEM_1], {
      [`GET ${BASE}/meu-repertorio`]: () => ({
        status: 200,
        corpo: { encontros: [encontro([ITEM_1_COMPLETO])] },
      }),
    })
    const atalho = await screen.findByRole('button', { name: 'Abrir o meu repertório' })
    await userEvent.setup().press(atalho)
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
  })
})

// ------------------------------------------------------------ Meu repertório

const ITEM_1_COMPLETO = {
  id: ITEM_1.id,
  ordem: 0,
  musicaId: ITEM_1.musicaId,
  tomDoDia: 'A',
  nota: null,
  titulo: 'Grande é o Senhor',
  artista: null,
  tomOriginal: 'G',
  andamentoBpm: 72,
  duracaoSeg: 240,
  link: null,
  cifra: CIFRA,
}
const ITEM_2_COMPLETO = {
  ...ITEM_1_COMPLETO,
  id: ITEM_2.id,
  ordem: 1,
  musicaId: ITEM_2.musicaId,
  titulo: 'Aleluia',
  tomDoDia: null,
  tomOriginal: 'D',
  andamentoBpm: null,
  duracaoSeg: null,
  cifra: '[D]Aleluia [A]aleluia',
}

function encontro(
  itens: EncontroDoMeuRepertorio['itens'],
  estado: 'pendente' | 'confirmada' = 'confirmada',
): EncontroDoMeuRepertorio {
  return {
    evento: {
      id: EVENTO_ID,
      titulo: 'Sábado com a juventude',
      inicio: '2026-11-28T19:00:00.000Z',
      fuso: 'America/Sao_Paulo',
    },
    convocacoes: [{ atribuicaoId: 'atr-1', funcao: 'Violão', estado }],
    itens,
  }
}

describe('Meu repertório (D61)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('convocado ao louvor: as músicas na ordem, no tom do dia', async () => {
    await renderizarTela(<TelaMeuRepertorio />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/meu-repertorio`]: () => ({
          status: 200,
          corpo: { encontros: [encontro([ITEM_1_COMPLETO, ITEM_2_COMPLETO])] },
        }),
      },
    })
    expect(await screen.findByText('Próximo encontro')).toBeOnTheScreen()
    expect(screen.getByText(/Minha função: Violão/)).toBeOnTheScreen()
    expect(
      screen.getByLabelText(
        /^Música 1 de 2: Grande é o Senhor\. Tom do dia A \(original G\) · 72 bpm · 4:00\. Abrir a cifra\.$/,
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText(/^Música 2 de 2: Aleluia\. Tom D\. Abrir a cifra\.$/),
    ).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByLabelText(/^Música 1 de 2: Grande é o Senhor/))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/meu-repertorio/[eventoId]/[itemId]',
      params: { eventoId: EVENTO_ID, itemId: ITEM_1.id },
    })
  })

  test('quem não foi convocado ao louvor não vê repertório de ninguém', async () => {
    await renderizarTela(<TelaMeuRepertorio />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/meu-repertorio`]: () => ({ status: 200, corpo: { encontros: [] } }) },
    })
    expect(await screen.findByText('Você não está convocado para o louvor')).toBeOnTheScreen()
    expect(screen.queryByText('Próximo encontro')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver minhas escalas' })).toBeOnTheScreen()
  })

  test('convocação pendente: Aceitar e Não posso ir no topo do encontro', async () => {
    const { servidor } = await renderizarTela(<TelaMeuRepertorio />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/meu-repertorio`]: () => ({
          status: 200,
          corpo: { encontros: [encontro([ITEM_1_COMPLETO], 'pendente')] },
        }),
        [`POST ${BASE}/atribuicoes/atr-1/confirmar`]: () => ({
          status: 200,
          corpo: { estado: 'confirmada' },
        }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Aceitar a convocação em/ }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/atr-1/confirmar`)).toHaveLength(1),
    )
    expect(screen.getByRole('button', { name: /^Não posso ir/ })).toBeOnTheScreen()
  })

  test('encontro sem repertório montado explica e não quebra', async () => {
    await renderizarTela(<TelaMeuRepertorio />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/meu-repertorio`]: () => ({
          status: 200,
          corpo: { encontros: [encontro([])] },
        }),
      },
    })
    expect(
      await screen.findByText(/O repertório deste encontro ainda não foi montado/),
    ).toBeOnTheScreen()
  })

  test('erro com "Tentar de novo"', async () => {
    await renderizarTela(<TelaMeuRepertorio />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/meu-repertorio`]: () => ({
          status: 500,
          corpo: { erro: 'interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
        }),
      },
    })
    expect(await screen.findByText('O seu repertório não abriu')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('cifra do repertório: no tom do dia, com anterior e próxima por botão', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID, itemId: ITEM_1.id })
    await renderizarTela(<TelaCifraDoRepertorio />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/meu-repertorio`]: () => ({
          status: 200,
          corpo: { encontros: [encontro([ITEM_1_COMPLETO, ITEM_2_COMPLETO])] },
        }),
      },
    })
    // Tom do dia A sobre uma cifra em G.
    expect(await screen.findByLabelText('Sobre a rocha eu firmo. Acordes: A, E')).toBeOnTheScreen()
    expect(screen.getByText('Tom A')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Música anterior' })).toBeDisabled()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Próxima música' }))
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/meu-repertorio/[eventoId]/[itemId]',
      params: { eventoId: EVENTO_ID, itemId: ITEM_2.id },
    })
    // Transpor na leitura não mexe no que foi salvo: só o próprio aparelho vê.
    await usuario.press(screen.getByRole('button', { name: 'Subir meio tom' }))
    expect(screen.getByLabelText('Sobre a rocha eu firmo. Acordes: B♭, F')).toBeOnTheScreen()
  })

  test('música que saiu do repertório: mensagem e caminho de volta', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID, itemId: 'sumiu' })
    await renderizarTela(<TelaCifraDoRepertorio />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/meu-repertorio`]: () => ({
          status: 200,
          corpo: { encontros: [encontro([ITEM_1_COMPLETO])] },
        }),
      },
    })
    expect(await screen.findByText('Esta música saiu do seu repertório')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver meu repertório' })).toBeOnTheScreen()
  })
})
