import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { ProvedorOffline } from '@/funcionalidades/offline/ProvedorOffline'
import { baixarRepertorio } from '@/funcionalidades/offline/repertorioOffline'
import type { Rota } from '@/testes/dubles'
import { EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { eventoDoMomento, inicioComMomento, momentoDeTeste } from '@/testes/momento'
import { limparAparelho } from '@/testes/offline'
import {
  encontroDoMeuRepertorioDeTeste,
  LETRA_DA_PRIMEIRA,
  pacoteDoRepertorioDeTeste,
} from '@/testes/repertorio'
import { BASE, COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'
import { confirmarAgora } from '@/ui/ToastComDesfazer'
import { reiniciarRespostas } from '@/funcionalidades/escalas/respostasOtimistas'

import { TelaMeuRepertorio } from '../TelaMeuRepertorio'

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

const CONTA = 'conta-eu'
const MEU = `${BASE}/meu-repertorio`
const PACOTE = `${BASE}/eventos/${EVENTO_ID}/repertorio/pacote`

function rotas(encontros = [encontroDoMeuRepertorioDeTeste()]): Record<string, Rota> {
  return { [`GET ${MEU}`]: () => ({ status: 200, corpo: { encontros } }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  limparAparelho()
  reiniciarRespostas()
  onlineManager.setOnline(true)
})
afterAll(() => onlineManager.setOnline(true))

describe('Meu repertório (D61, D71)', () => {
  test('o músico vê o próximo encontro, a parte dele e as músicas no tom do dia', async () => {
    await renderizarTela(<TelaMeuRepertorio />, { papel: 'membro', rotas: rotas() })

    expect(await screen.findByText('Próximo encontro')).toBeOnTheScreen()
    expect(screen.getByText('Sábado com a juventude')).toBeOnTheScreen()
    expect(screen.getByText('Sua parte: Violão')).toBeOnTheScreen()
    expect(screen.getByText('Aceitou')).toBeOnTheScreen()
    // Tom do dia diferente do original aparece escrito, com o tempo e o andamento.
    expect(screen.getByText('Tom A (original G) · 72 bpm · 4:05')).toBeOnTheScreen()
    expect(screen.getByText('Tom D')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', {
        name: 'Música 1 de 2: Firmes na rocha. Tom A (original G) · 72 bpm · 4:05. Abrir a cifra.',
      }),
    ).toBeOnTheScreen()
  })

  test('tocar numa música abre a cifra; Modo palco abre a primeira direto no palco', async () => {
    await renderizarTela(<TelaMeuRepertorio />, { papel: 'membro', rotas: rotas() })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('button', { name: /^Música 2 de 2/ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/meu-repertorio/[eventoId]/[itemId]',
      params: { eventoId: EVENTO_ID, itemId: 'item-2' },
    })

    await usuario.press(screen.getByRole('button', { name: /^Abrir o Modo palco/ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/meu-repertorio/[eventoId]/[itemId]',
      params: { eventoId: EVENTO_ID, itemId: 'item-1', palco: '1' },
    })
  })

  test('convocação pendente: Aceitar com Desfazer e só então a resposta sai', async () => {
    const pendente = encontroDoMeuRepertorioDeTeste({
      convocacoes: [{ atribuicaoId: 'atr-violao', funcao: 'Violão', estado: 'pendente' }],
    })
    const { servidor } = await renderizarTela(<TelaMeuRepertorio />, {
      papel: 'membro',
      rotas: {
        ...rotas([pendente]),
        [`POST ${BASE}/atribuicoes/atr-violao/confirmar`]: () => ({ status: 200, corpo: {} }),
      },
    })

    expect(await screen.findByText('Aguardando sua resposta')).toBeOnTheScreen()
    // Pendente: a resposta vem antes do Modo palco.
    expect(screen.queryByRole('button', { name: /^Abrir o Modo palco/ })).toBeNull()
    await userEvent.setup().press(screen.getByRole('button', { name: /^Aceitar a convocação em/ }))

    // O ato aparece feito na hora, mas nada saiu: os 10 s de Desfazer ainda correm.
    expect(await screen.findByText('Aceitou')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/atr-violao/confirmar`)).toHaveLength(
      0,
    )

    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(
        pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/atr-violao/confirmar`),
      ).toHaveLength(1),
    )
  })

  describe('os três estados', () => {
    test('quem não toca (D73) não esbarra em "você não está no louvor": vê o repertório do próximo encontro, em leitura', async () => {
      await renderizarTela(<TelaMeuRepertorio />, {
        papel: 'membro',
        rotas: {
          ...rotas([]),
          [`GET ${BASE}/inicio`]: () => ({
            status: 200,
            corpo: inicioComMomento(
              momentoDeTeste({ evento: eventoDoMomento({ id: EVENTO_ID, musicas: 2 }) }),
            ),
          }),
          [`GET ${BASE}/eventos/${EVENTO_ID}`]: () => ({
            status: 200,
            corpo: eventoDeTeste({ atribuicoes: [] }),
          }),
          [`GET ${BASE}/eventos/${EVENTO_ID}/repertorio`]: () => ({
            status: 200,
            corpo: {
              itens: [
                {
                  id: 'item-1',
                  ordem: 0,
                  musicaId: 'm1',
                  etapaId: null,
                  tomDoDia: 'A',
                  nota: null,
                  versao: 1,
                  titulo: 'Firmes na rocha',
                  artista: null,
                  tomOriginal: 'G',
                  andamentoBpm: null,
                  duracaoSeg: 240,
                  arquivada: false,
                  temCifra: true,
                },
              ],
            },
          }),
        },
      })
      // A lista, o tom do dia e a cifra a um toque: nada de "Você não está no louvor".
      expect(await screen.findByLabelText(/^Música 1 de 1: Firmes na rocha\./)).toBeOnTheScreen()
      expect(screen.queryByText(/Você não está no louvor/)).toBeNull()
      // Só leitura: sem Adicionar nem Avisar a banda, sem Modo palco.
      expect(screen.queryByRole('button', { name: 'Adicionar músicas' })).toBeNull()
      expect(screen.queryByRole('button', { name: /^Abrir o Modo palco/ })).toBeNull()
    })

    test('quem não toca e ainda não há encontro marcado: diz isso, sem culpar o louvor', async () => {
      await renderizarTela(<TelaMeuRepertorio />, {
        papel: 'membro',
        rotas: {
          ...rotas([]),
          [`GET ${BASE}/inicio`]: () => ({
            status: 200,
            corpo: inicioComMomento(
              momentoDeTeste({ evento: null, estado: null, minutosParaInicio: null }),
            ),
          }),
        },
      })
      expect(await screen.findByText('Ainda não há encontro marcado.')).toBeOnTheScreen()
      expect(screen.queryByText(/Você não está no louvor/)).toBeNull()
    })

    test('vazio de quem toca: o repertório ainda não foi montado', async () => {
      await renderizarTela(<TelaMeuRepertorio />, {
        papel: 'membro',
        rotas: rotas([encontroDoMeuRepertorioDeTeste({ itens: [] })]),
      })
      expect(
        await screen.findByText(
          /O repertório ainda não foi montado\. Assim que a liderança montar/,
        ),
      ).toBeOnTheScreen()
      expect(screen.queryByRole('button', { name: /Modo palco/ })).toBeNull()
    })

    test('erro: texto humano e Tentar de novo que recarrega', async () => {
      let tentativas = 0
      await renderizarTela(<TelaMeuRepertorio />, {
        papel: 'membro',
        rotas: {
          [`GET ${MEU}`]: () =>
            ++tentativas === 1
              ? { status: 500, corpo: { erro: 'x', mensagem: 'Falhou.' } }
              : { status: 200, corpo: { encontros: [encontroDoMeuRepertorioDeTeste()] } },
        },
      })
      expect(await screen.findByText('Não deu para carregar o repertório.')).toBeOnTheScreen()
      await userEvent.setup().press(screen.getByRole('button', { name: 'Tentar de novo' }))
      expect(await screen.findByText('Firmes na rocha')).toBeOnTheScreen()
    })

    test('carregando: esqueleto com a forma da lista', async () => {
      await renderizarTela(<TelaMeuRepertorio />, {
        papel: 'membro',
        rotas: { [`GET ${MEU}`]: () => new Promise<never>(() => {}) },
      })
      expect(await screen.findByLabelText('Carregando o seu repertório')).toBeOnTheScreen()
    })
  })
})

describe('uso sem internet (fatia 2, D71)', () => {
  async function comProvedor(deposito = criarDeposito(), extra: Record<string, Rota> = {}) {
    return renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaMeuRepertorio />
      </ProvedorOffline>,
      {
        papel: 'membro',
        rotas: {
          ...rotas(),
          [`GET ${BASE}/sync/mudancas`]: () => ({
            status: 200,
            corpo: { recomecar: false, mudancas: [], cursor: '1000:0', temMais: false },
          }),
          ...extra,
        },
      },
    )
  }

  test('"Deixar pronto sem internet" baixa o pacote e a tela diz que está pronto', async () => {
    const deposito = criarDeposito()
    const { servidor } = await comProvedor(deposito, {
      [`GET ${PACOTE}`]: () => ({ status: 200, corpo: pacoteDoRepertorioDeTeste() }),
    })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('button', { name: 'Deixar pronto sem internet' }))

    expect(await screen.findByText('Pronto para tocar sem internet')).toBeOnTheScreen()
    expect(screen.getAllByText('Baixado para usar sem internet').length).toBeGreaterThan(0)
    const p = await deposito.abrir(CONTA, COMUNIDADE)
    expect((await p!.lerRepertorio(EVENTO_ID))?.pacote.versao).toBe('versao-1')
    expect(pedidosPara(servidor, 'GET', PACOTE)).toHaveLength(1)
  })

  test('"Atualizar agora" manda a versão que o aparelho tem: só baixa se mudou', async () => {
    const deposito = criarDeposito()
    const { servidor } = await comProvedor(deposito, {
      [`GET ${PACOTE}`]: (p) =>
        p.url.includes('versao=versao-1')
          ? { status: 200, corpo: { versao: 'versao-1', inalterado: true } }
          : { status: 200, corpo: pacoteDoRepertorioDeTeste() },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Deixar pronto sem internet' }))
    await usuario.press(await screen.findByRole('button', { name: 'Atualizar agora' }))

    await waitFor(() => expect(pedidosPara(servidor, 'GET', PACOTE)).toHaveLength(2))
    expect(servidor.pedidos.filter((p) => p.url.includes('repertorio/pacote'))[1]?.url).toContain(
      '?versao=versao-1',
    )
  })

  test('sem internet e com a cópia guardada: lista, cifra e palco abrem do aparelho', async () => {
    const deposito = criarDeposito()
    const p = await deposito.criar({
      contaId: CONTA,
      comunidadeId: COMUNIDADE,
      vinculoId: null,
      validadeDias: 7,
    })
    await baixarRepertorio(p, { get: async () => pacoteDoRepertorioDeTeste() } as never, EVENTO_ID)
    onlineManager.setOnline(false)
    const { servidor } = await comProvedor(deposito)

    expect(await screen.findByText('Sem internet')).toBeOnTheScreen()
    expect(screen.getByText('Firmes na rocha')).toBeOnTheScreen()
    expect(screen.getByText('Sua parte: Violão')).toBeOnTheScreen()
    expect(screen.getAllByText('Baixado para usar sem internet').length).toBeGreaterThan(0)
    // Sem internet, aceitar e recusar não aparecem (exigem rede) e nada vai à rede.
    expect(screen.queryByRole('button', { name: /^Aceitar/ })).toBeNull()
    expect(pedidosPara(servidor, 'GET', MEU)).toHaveLength(0)

    await userEvent.setup().press(screen.getByRole('button', { name: /^Abrir o Modo palco/ }))
    expect(router.push).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ itemId: 'item-1', palco: '1' }),
      }),
    )
  })

  test('sem internet e sem cópia: diz que o repertório ainda não está no aparelho', async () => {
    onlineManager.setOnline(false)
    await comProvedor()
    expect(
      await screen.findByText('Este repertório ainda não está no seu aparelho.'),
    ).toBeOnTheScreen()
    expect(
      screen.getByText('Conecte-se à internet para ver as músicas e baixar as cifras.'),
    ).toBeOnTheScreen()
  })

  test('com o encontro perto e Wi-Fi, o app baixa sozinho, sem ninguém pedir', async () => {
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { isConnectionExpensive: false },
    } as never)
    try {
      const deposito = criarDeposito()
      // O encontro é amanhã: só o que está perto (até 3 dias) baixa sozinho.
      const amanha = encontroDoMeuRepertorioDeTeste()
      amanha.evento = {
        ...amanha.evento,
        inicio: new Date(Date.now() + 24 * 3600_000).toISOString(),
      }
      const { servidor } = await comProvedor(deposito, {
        ...rotas([amanha]),
        [`GET ${PACOTE}`]: () => ({ status: 200, corpo: pacoteDoRepertorioDeTeste() }),
      })
      await waitFor(() => expect(pedidosPara(servidor, 'GET', PACOTE)).toHaveLength(1))
      expect(await screen.findByText('Pronto para tocar sem internet')).toBeOnTheScreen()
    } finally {
      jest.mocked(NetInfo.fetch).mockResolvedValue({
        type: 'cellular',
        isConnected: true,
        isInternetReachable: true,
        details: { isConnectionExpensive: true, cellularGeneration: '3g' },
      } as never)
    }
  })

  test('em dados móveis não baixa sozinho (o botão manual continua lá)', async () => {
    const { servidor } = await comProvedor(criarDeposito(), {
      [`GET ${PACOTE}`]: () => ({ status: 200, corpo: pacoteDoRepertorioDeTeste() }),
    })
    expect(
      await screen.findByRole('button', { name: 'Deixar pronto sem internet' }),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', PACOTE)).toHaveLength(0)
  })

  test('sem o provedor (web): o cartão diz que nada fica guardado, sem botão que não funciona', async () => {
    await renderizarTela(<TelaMeuRepertorio />, { papel: 'membro', rotas: rotas() })
    expect(
      await screen.findByText(
        /No navegador, nada fica guardado\. Para tocar sem internet, use o app/,
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Deixar pronto sem internet' })).toBeNull()
  })

  test('a letra da música não aparece na lista (só título e tom)', async () => {
    await renderizarTela(<TelaMeuRepertorio />, { papel: 'membro', rotas: rotas() })
    await screen.findByText('Firmes na rocha')
    expect(screen.queryByText(new RegExp(LETRA_DA_PRIMEIRA))).toBeNull()
  })
})
