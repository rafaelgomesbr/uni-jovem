import { onlineManager } from '@tanstack/react-query'
import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'

import { criarDeposito } from '@/funcionalidades/offline/deposito'
import { ProvedorOffline } from '@/funcionalidades/offline/ProvedorOffline'
import { baixarRepertorio } from '@/funcionalidades/offline/repertorioOffline'
import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'
import { ErroLocal } from '@/servicos/erros'
import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { limparAparelho } from '@/testes/offline'
import {
  BYTES_DO_PDF,
  encontroDoMeuRepertorioDeTeste,
  itensComPdfDeTeste,
  mesmosBytes,
  NOME_DO_PDF,
  pacoteDoRepertorioDeTeste,
  resumoDoPdfDeTeste,
  VERSAO_DO_PDF,
} from '@/testes/repertorio'
import { BASE, COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'

import { trocarVisualizadorDePdf } from '../../pdf/visualizadorDePdf'
import { TelaCifraDoRepertorio } from '../TelaCifraDoRepertorio'
import { TelaMeuRepertorio } from '../TelaMeuRepertorio'
import { TelaRepertorioDoEncontro } from '../TelaRepertorioDoEncontro'

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
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }))

const CONTA = 'conta-eu'
const MEU = `${BASE}/meu-repertorio`
const EVENTO = `${BASE}/eventos/${EVENTO_ID}`
const PACOTE = `${EVENTO}/repertorio/pacote`
const PDF_DA_PRIMEIRA = `${BASE}/conteudos/musicas/mus-1/pdf`
const TITULO = 'Firmes na rocha'

const PDF_REDE = () => ({
  status: 200,
  bytes: BYTES_DO_PDF,
  cabecalhos: { etag: `"${VERSAO_DO_PDF}"` },
})

function parametros(extra: Record<string, string> = {}) {
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ eventoId: EVENTO_ID, itemId: 'item-1', ...extra } as never)
}

const encontroComPdf = (soPdf: boolean) =>
  encontroDoMeuRepertorioDeTeste({ itens: itensComPdfDeTeste(soPdf) })
const rotasDoMeu = (soPdf: boolean) => ({
  [`GET ${MEU}`]: () => ({ status: 200, corpo: { encontros: [encontroComPdf(soPdf)] } }),
})

function visualizador() {
  const abrir = jest.fn(async (_bytes: Uint8Array, _nome: string) => 'aberto' as const)
  trocarVisualizadorDePdf({ abrir })
  return abrir
}

beforeEach(() => {
  jest.clearAllMocks()
  limparAparelho()
  onlineManager.setOnline(true)
})
afterEach(() => trocarVisualizadorDePdf())
afterAll(() => onlineManager.setOnline(true))

describe('Meu repertório: a música com PDF', () => {
  test('a linha diz "PDF" em texto e o nome acessível promete a cifra e o PDF', async () => {
    await renderizarTela(<TelaMeuRepertorio />, { papel: 'membro', rotas: rotasDoMeu(false) })
    expect(
      await screen.findByRole('button', {
        name: 'Música 1 de 2: Firmes na rocha. Tom A (original G) · 72 bpm · 4:05 · Cifra e PDF. Abrir a cifra e o PDF.',
      }),
    ).toBeOnTheScreen()
    // A segunda não tem PDF e continua como era.
    expect(
      screen.getByRole('button', { name: /^Música 2 de 2: Canto de manhã\./ }),
    ).toBeOnTheScreen()
  })

  test('só PDF, sem cifra em texto: a linha diz "PDF", nunca "Sem cifra"', async () => {
    await renderizarTela(<TelaMeuRepertorio />, { papel: 'membro', rotas: rotasDoMeu(true) })
    expect(await screen.findByText('Tom A (original G) · 72 bpm · 4:05 · PDF')).toBeOnTheScreen()
    expect(screen.queryByText(/Sem cifra/)).toBeNull()
  })
})

describe('leitura da música só com PDF', () => {
  test('mostra o cartão do PDF, o tom do dia em texto e Tom − e Tom + desabilitados COM o motivo escrito', async () => {
    parametros()
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotasDoMeu(true) })

    expect(await screen.findByText('PDF da música')).toBeOnTheScreen()
    expect(screen.getByText(NOME_DO_PDF)).toBeOnTheScreen()
    expect(screen.getByText('Tom A (original G)')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Descer tom' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Subir tom' })).toBeDisabled()
    // O motivo não fica só no leitor de tela: está escrito na tela.
    expect(
      screen.getByText(/O PDF não muda de tom: ele abre do jeito que foi anexado\./),
    ).toBeOnTheScreen()
    // Sem o aviso de "esta música ainda não tem cifra": ela tem PDF.
    expect(screen.queryByText('Esta música ainda não tem cifra')).toBeNull()
  })

  test('"Abrir PDF" baixa o arquivo (com o token da sessão) e entrega os bytes ao visualizador', async () => {
    parametros()
    const abrir = visualizador()
    const { servidor } = await renderizarTela(<TelaCifraDoRepertorio />, {
      papel: 'membro',
      rotas: { ...rotasDoMeu(true), [`GET ${PDF_DA_PRIMEIRA}`]: PDF_REDE },
    })

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: `Abrir o PDF de ${TITULO}` }))

    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1))
    expect(mesmosBytes(abrir.mock.calls[0]![0], BYTES_DO_PDF)).toBe(true)
    expect(abrir.mock.calls[0]![1]).toBe(NOME_DO_PDF)
    const pedido = pedidosPara(servidor, 'GET', PDF_DA_PRIMEIRA)[0]!
    expect(pedido.cabecalhos['authorization']).toBe('Bearer acesso-de-teste')
    // Sem cópia no aparelho, não há ETag para mandar.
    expect(pedido.cabecalhos['if-none-match']).toBeUndefined()
  })

  test('erro ao baixar: mensagem humana e "Tentar de novo" que tenta outra vez', async () => {
    parametros()
    const abrir = visualizador()
    let tentativas = 0
    await renderizarTela(<TelaCifraDoRepertorio />, {
      papel: 'membro',
      rotas: {
        ...rotasDoMeu(true),
        [`GET ${PDF_DA_PRIMEIRA}`]: () =>
          ++tentativas === 1
            ? { status: 500, corpo: { erro: 'x', mensagem: 'O servidor tropeçou.' } }
            : PDF_REDE(),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: `Abrir o PDF de ${TITULO}` }))
    expect(await screen.findByText('Não deu para abrir o PDF')).toBeOnTheScreen()
    expect(screen.getByText('O servidor tropeçou.')).toBeOnTheScreen()
    expect(abrir).not.toHaveBeenCalled()

    await usuario.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('Não deu para abrir o PDF')).toBeNull())
  })

  test('o aparelho sem leitor de PDF diz o que fazer', async () => {
    parametros()
    trocarVisualizadorDePdf({
      abrir: async () => {
        throw new ErroLocal(
          'Este aparelho não tem um aplicativo para abrir PDF. Instale um leitor de PDF e tente de novo.',
        )
      },
    })
    await renderizarTela(<TelaCifraDoRepertorio />, {
      papel: 'membro',
      rotas: { ...rotasDoMeu(true), [`GET ${PDF_DA_PRIMEIRA}`]: PDF_REDE },
    })
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: `Abrir o PDF de ${TITULO}` }))
    expect(await screen.findByText(/não tem um aplicativo para abrir PDF/)).toBeOnTheScreen()
  })
})

describe('leitura da música com cifra em texto E PDF', () => {
  test('as duas opções aparecem: o cartão do PDF e o leitor com o tom funcionando', async () => {
    parametros()
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotasDoMeu(false) })

    expect(
      await screen.findByRole('button', { name: `Abrir o PDF de ${TITULO}` }),
    ).toBeOnTheScreen()
    expect(screen.getByLabelText(/Acordes: A, E/)).toBeOnTheScreen()
    // O tom vale para a cifra em texto: os botões continuam habilitados.
    expect(screen.getByRole('button', { name: 'Subir tom' })).toBeEnabled()
  })
})

describe('Modo palco com PDF', () => {
  test('só PDF: botão grande "Abrir PDF", nota de tela cheia e tela acesa, tom desabilitado com o motivo escrito', async () => {
    parametros({ palco: '1' })
    const abrir = visualizador()
    await renderizarTela(<TelaCifraDoRepertorio />, {
      papel: 'membro',
      rotas: { ...rotasDoMeu(true), [`GET ${PDF_DA_PRIMEIRA}`]: PDF_REDE },
    })

    const botao = await screen.findByRole('button', { name: `Abrir o PDF de ${TITULO}` })
    expect(
      screen.getByText(/O PDF abre em tela cheia, sem barra, e a tela continua acesa\./),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(/O PDF não muda de tom: ele abre do jeito que foi anexado\./),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Descer tom' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Subir tom' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Letra menor' })).toBeDisabled()
    expect(screen.queryByText('Esta música ainda não tem cifra')).toBeNull()

    const { useKeepAwake } = jest.requireMock('expo-keep-awake') as { useKeepAwake: jest.Mock }
    expect(useKeepAwake).toHaveBeenCalledWith('uj-palco')

    await userEvent.setup().press(botao)
    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1))
  })

  test('cifra em texto e PDF: o palco mostra o botão do PDF e a cifra, e o tom segue funcionando', async () => {
    parametros({ palco: '1' })
    await renderizarTela(<TelaCifraDoRepertorio />, { papel: 'membro', rotas: rotasDoMeu(false) })
    expect(
      await screen.findByRole('button', { name: `Abrir o PDF de ${TITULO}` }),
    ).toBeOnTheScreen()
    expect(screen.getByLabelText(/Acordes: A, E/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Subir tom' })).toBeEnabled()
    expect(screen.queryByText(/O PDF não muda de tom: ele abre/)).toBeNull()
  })
})

describe('abrir o PDF sem internet', () => {
  async function comCopia() {
    const deposito = criarDeposito()
    const p = await deposito.criar({
      contaId: CONTA,
      comunidadeId: COMUNIDADE,
      vinculoId: null,
      validadeDias: 7,
    })
    const pacote = pacoteDoRepertorioDeTeste({ itens: itensComPdfDeTeste(true) })
    await baixarRepertorio(
      p,
      {
        get: async () => pacote,
        pedir: async () => ({ bytes: BYTES_DO_PDF, etag: VERSAO_DO_PDF }),
      } as never,
      EVENTO_ID,
    )
    return deposito
  }

  test('com a cópia no aparelho, abre sem rede: nenhum pedido sai e o cartão diz que está guardado', async () => {
    parametros()
    const deposito = await comCopia()
    const abrir = visualizador()
    onlineManager.setOnline(false)
    const { servidor } = await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaCifraDoRepertorio />
      </ProvedorOffline>,
      { papel: 'membro', rotas: rotasDoMeu(true) },
    )

    expect(await screen.findByText(/Guardado neste aparelho/)).toBeOnTheScreen()
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: `Abrir o PDF de ${TITULO}` }))

    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1))
    expect(mesmosBytes(abrir.mock.calls[0]![0], BYTES_DO_PDF)).toBe(true)
    expect(servidor.pedidos.some((p) => p.url.includes('/pdf'))).toBe(false)
  })

  test('com a cópia na versão certa e internet, também usa a do aparelho (não gasta dados)', async () => {
    parametros()
    const deposito = await comCopia()
    const abrir = visualizador()
    const { servidor } = await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaCifraDoRepertorio />
      </ProvedorOffline>,
      {
        papel: 'membro',
        rotas: {
          ...rotasDoMeu(true),
          [`GET ${BASE}/sync/mudancas`]: () => ({
            status: 200,
            corpo: { recomecar: false, mudancas: [], cursor: '1000:0', temMais: false },
          }),
          // A rodada de sincronização confere a versão do pacote: está em dia.
          [`GET ${PACOTE}`]: () => ({
            status: 200,
            corpo: { versao: 'versao-1', inalterado: true },
          }),
        },
      },
    )
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: `Abrir o PDF de ${TITULO}` }))
    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1))
    expect(pedidosPara(servidor, 'GET', PDF_DA_PRIMEIRA)).toHaveLength(0)
  })

  test('sem internet e sem cópia: texto claro, sem tela quebrada', async () => {
    parametros()
    const deposito = criarDeposito()
    const p = await deposito.criar({
      contaId: CONTA,
      comunidadeId: COMUNIDADE,
      vinculoId: null,
      validadeDias: 7,
    })
    // O repertório foi baixado quando a música ainda não tinha PDF: o PDF não está no aparelho.
    await baixarRepertorio(p, { get: async () => pacoteDoRepertorioDeTeste() } as never, EVENTO_ID)
    const abrir = visualizador()
    onlineManager.setOnline(false)
    await renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaCifraDoRepertorio />
      </ProvedorOffline>,
      { papel: 'membro', rotas: rotasDoMeu(true) },
    )
    // Sem rede, a tela vem da cópia guardada, que não tem PDF: não há o botão de PDF para tocar.
    expect(await screen.findByLabelText(/Acordes: A, E/)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: `Abrir o PDF de ${TITULO}` })).toBeNull()
    expect(abrir).not.toHaveBeenCalled()
  })
})

describe('"Pronto para tocar sem internet" só com o PDF baixado', () => {
  async function comProvedor(deposito = criarDeposito(), pdf: () => object) {
    return renderizarTela(
      <ProvedorOffline deposito={deposito}>
        <TelaMeuRepertorio />
      </ProvedorOffline>,
      {
        papel: 'membro',
        rotas: {
          ...rotasDoMeu(false),
          [`GET ${BASE}/sync/mudancas`]: () => ({
            status: 200,
            corpo: { recomecar: false, mudancas: [], cursor: '1000:0', temMais: false },
          }),
          [`GET ${PACOTE}`]: () => ({
            status: 200,
            corpo: pacoteDoRepertorioDeTeste({ itens: itensComPdfDeTeste(false) }),
          }),
          [`GET ${PDF_DA_PRIMEIRA}`]: pdf as never,
        },
      },
    )
  }

  test('o PDF falhou: "Quase pronto", o que falta escrito e o botão "Baixar o que falta"; depois, pronto', async () => {
    let tentativas = 0
    const deposito = criarDeposito()
    await comProvedor(deposito, () =>
      ++tentativas === 1
        ? { status: 503, corpo: { erro: 'indisponivel', mensagem: 'Fora do ar.' } }
        : PDF_REDE(),
    )
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('button', { name: 'Deixar pronto sem internet' }))

    expect(await screen.findByText('Quase pronto: falta 1 PDF')).toBeOnTheScreen()
    expect(screen.queryByText('Pronto para tocar sem internet')).toBeNull()
    expect(screen.getByText('Falta baixar')).toBeOnTheScreen()
    expect(screen.getByText(/o PDF ainda não está neste aparelho/)).toBeOnTheScreen()

    await usuario.press(screen.getByRole('button', { name: 'Baixar o que falta' }))

    expect(await screen.findByText('Pronto para tocar sem internet')).toBeOnTheScreen()
    expect(screen.getByText('Inclui 1 PDF, que também abre sem internet.')).toBeOnTheScreen()
    const p = await deposito.abrir(CONTA, COMUNIDADE)
    expect((await p!.lerPdf('mus-1', VERSAO_DO_PDF))?.nome).toBe(NOME_DO_PDF)
  })

  test('com tudo baixado de primeira, já diz que está pronto e que inclui o PDF', async () => {
    await comProvedor(criarDeposito(), PDF_REDE)
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Deixar pronto sem internet' }))
    expect(await screen.findByText('Pronto para tocar sem internet')).toBeOnTheScreen()
    expect(screen.getByText('Inclui 1 PDF, que também abre sem internet.')).toBeOnTheScreen()
  })
})

describe('repertório do encontro: o selo "PDF"', () => {
  const ITEM_COM_PDF: ItemDoRepertorio = {
    id: '77777777-7777-4777-8777-000000000001',
    ordem: 0,
    musicaId: 'mus-1',
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
    temCifra: false,
    temPdf: true,
    pdf: resumoDoPdfDeTeste(),
  }

  function montar(papel: 'organizador' | 'membro', itens: ItemDoRepertorio[]) {
    jest.mocked(useLocalSearchParams).mockReturnValue({ eventoId: EVENTO_ID })
    return renderizarTela(<TelaRepertorioDoEncontro />, {
      papel,
      rotas: {
        [`GET ${EVENTO}`]: () => ({ status: 200, corpo: eventoDeTeste({ duracaoMin: 30 }) }),
        [`GET ${EVENTO}/repertorio`]: () => ({ status: 200, corpo: { itens } }),
        [`GET ${BASE}/meu-repertorio`]: () => ({ status: 200, corpo: { encontros: [] } }),
      },
    })
  }

  test('quem organiza vê o selo "PDF" no cartão da música (e não "Sem cifra")', async () => {
    await montar('organizador', [ITEM_COM_PDF])
    expect(await screen.findByText('PDF', { exact: true })).toBeOnTheScreen()
    expect(screen.queryByText('Sem cifra')).toBeNull()
    expect(screen.getByLabelText(/^Música 1 de 1: Grande é o Senhor\. .*· PDF\./)).toBeOnTheScreen()
  })

  test('quem só lê vê "PDF" na linha e o toque abre a música, que tem o botão do PDF', async () => {
    await montar('membro', [ITEM_COM_PDF])
    const linha = await screen.findByRole('button', {
      name: /^Música 1 de 1: Grande é o Senhor\. .*· PDF\. Abrir a cifra e o PDF\.$/,
    })
    await userEvent.setup().press(linha)
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/conteudos/[tipo]/[itemId]',
      params: { tipo: 'musicas', itemId: 'mus-1' },
    })
  })
})
