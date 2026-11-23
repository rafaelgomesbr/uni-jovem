import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import { confirmar } from '@/utilidades/confirmar'
import { bytesDe, mesmosBytes } from '@/testes/repertorio'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { MENSAGEM_NAO_E_PDF, trocarSeletorDePdf } from '../../pdf/seletorDePdf'
import { trocarVisualizadorDePdf } from '../../pdf/visualizadorDePdf'
import { TelaConteudo } from '../TelaConteudo'
import { TelaConteudos } from '../TelaConteudos'
import { TEXTO_DA_CONFIRMACAO_DE_DIREITOS } from '../tipos'

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
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))

const ID = '99999999-9999-4999-8999-000000000001'
const CAMINHO_DO_PDF = `${BASE}/conteudos/musicas/${ID}/pdf`
const VERSAO = 'a'.repeat(64)
const PDF = bytesDe('%PDF-1.4\n% letra inventada de teste\n%%EOF\n')

const MUSICA = {
  id: ID,
  titulo: 'Grande é o Senhor',
  artista: null,
  tom: 'G',
  link: null,
  cifra: null,
  andamentoBpm: null,
  duracaoSeg: null,
  temCifra: false,
  temPdf: false,
  pdf: null,
  observacoes: null,
  arquivada: false,
  musicos: [],
  versao: 3,
  criadoEm: '2026-11-01T12:00:00.000Z',
  atualizadoEm: '2026-11-01T12:00:00.000Z',
}
const COM_PDF = {
  ...MUSICA,
  temPdf: true,
  pdf: { nome: 'cifra-do-culto.pdf', tamanho: 1_258_291, versao: VERSAO },
}

/** Um arquivo que o seletor "escolhe": o teste diz o nome, o tipo, o tamanho e os bytes. */
function escolher(
  arquivo: {
    nome: string
    tipo?: string | null
    tamanho?: number | null
    bytes?: Uint8Array
  } | null,
) {
  const escolher = jest.fn(async () =>
    arquivo === null
      ? null
      : {
          nome: arquivo.nome,
          tamanho: arquivo.tamanho === undefined ? (arquivo.bytes ?? PDF).length : arquivo.tamanho,
          tipo: arquivo.tipo === undefined ? 'application/pdf' : arquivo.tipo,
          ler: jest.fn(async () => arquivo.bytes ?? PDF),
        },
  )
  trocarSeletorDePdf({ escolher })
  return escolher
}

async function abrirEdicao(musica: object = MUSICA, extras = {}) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: ID })
  const r = await renderizarTela(<TelaConteudo />, {
    papel: 'organizador',
    rotas: {
      [`GET ${BASE}/conteudos/musicas/${ID}`]: () => ({ status: 200, corpo: musica }),
      [`GET ${BASE}/conteudos/musicos`]: () => ({ status: 200, corpo: { itens: [] } }),
      ...extras,
    },
  })
  await userEvent.setup().press(await screen.findByRole('button', { name: 'Editar a música' }))
  return r
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(confirmar).mockResolvedValue(true)
})
afterEach(() => {
  trocarSeletorDePdf()
  trocarVisualizadorDePdf()
})

describe('anexar o PDF na edição da música (D76)', () => {
  test('sem o aceite de direitos, mostra o aviso e a caixa e diz o que falta; com ele, anexa', async () => {
    const seletor = escolher({ nome: 'cifra-do-culto.pdf' })
    const { servidor } = await abrirEdicao(MUSICA, {
      [`PUT ${CAMINHO_DO_PDF}`]: () => ({
        status: 200,
        corpo: { temPdf: true, pdf: COM_PDF.pdf },
      }),
    })
    const usuario = userEvent.setup()
    expect(await screen.findByText('PDF da música')).toBeOnTheScreen()
    expect(screen.getByText(/Anexe a cifra ou a partitura/)).toBeOnTheScreen()
    // A cifra em texto não existe: nem aviso nem caixa até a pessoa tocar em "Anexar PDF".
    expect(screen.queryByText(TEXTO_DA_CONFIRMACAO_DE_DIREITOS)).toBeNull()

    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    expect(
      await screen.findByText('Confirme os direitos de uso para anexar o PDF.'),
    ).toBeOnTheScreen()
    expect(screen.getByText(/Cadastre só o que a sua comunidade pode usar/)).toBeOnTheScreen()
    expect(seletor).not.toHaveBeenCalled()
    expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)).toHaveLength(0)

    await usuario.press(screen.getByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }))
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await waitFor(() => expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)).toHaveLength(1))
    const envio = pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)[0]!
    // Os bytes vão como corpo bruto (não em JSON), com o aceite e o nome na consulta.
    expect(mesmosBytes(envio.bytes!, PDF)).toBe(true)
    expect(envio.cabecalhos['content-type']).toBe('application/pdf')
    expect(envio.url).toContain('direitosConfirmados=true')
    expect(envio.url).toContain('nome=cifra-do-culto.pdf')
    expect(envio.corpo).toBeUndefined()
  })

  test('arquivo acima de 10 MB: mensagem humana com o tamanho e o limite, e nada é enviado', async () => {
    escolher({ nome: 'partitura.pdf', tamanho: 14 * 1024 * 1024 })
    const { servidor } = await abrirEdicao()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await usuario.press(
      await screen.findByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    )
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    expect(
      await screen.findByText(
        'Este PDF tem 14 MB e o limite é de 10 MB. Escolha um arquivo menor ou reduza o PDF antes de anexar.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByText('Não deu para anexar o PDF')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)).toHaveLength(0)
  })

  test.each([
    ['pelo nome e pelo tipo', { nome: 'foto.png', tipo: 'image/png' }],
    ['pelo conteúdo', { nome: 'falso.pdf', bytes: bytesDe('<html>oi</html>') }],
  ])('arquivo que não é PDF (%s): recusa com a mensagem humana', async (_como, arquivo) => {
    escolher(arquivo)
    const { servidor } = await abrirEdicao()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await usuario.press(
      await screen.findByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    )
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    expect(await screen.findByText(MENSAGEM_NAO_E_PDF)).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)).toHaveLength(0)
  })

  test('cancelar a escolha não faz nada; a API recusar mostra a mensagem dela', async () => {
    const seletor = escolher(null)
    const { servidor } = await abrirEdicao(MUSICA, {
      [`PUT ${CAMINHO_DO_PDF}`]: () => ({
        status: 413,
        corpo: {
          erro: 'grande_demais',
          mensagem: 'O envio passou do tamanho permitido. Use um arquivo menor e tente de novo.',
        },
      }),
    })
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await usuario.press(
      await screen.findByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    )
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await waitFor(() => expect(seletor).toHaveBeenCalledTimes(1))
    expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)).toHaveLength(0)

    escolher({ nome: 'cifra.pdf' })
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    expect(
      await screen.findByText(
        'O envio passou do tamanho permitido. Use um arquivo menor e tente de novo.',
      ),
    ).toBeOnTheScreen()
  })

  test('com PDF anexado: mostra nome e tamanho, "Trocar" pede o aceite de novo e "Remover" pede confirmação clara', async () => {
    const { servidor } = await abrirEdicao(COM_PDF, {
      [`DELETE ${CAMINHO_DO_PDF}`]: () => ({ status: 200, corpo: { temPdf: false, pdf: null } }),
    })
    const usuario = userEvent.setup()
    expect(await screen.findByText('cifra-do-culto.pdf · 1,2 MB')).toBeOnTheScreen()
    expect(screen.getByText('PDF')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Trocar o PDF' })).toBeOnTheScreen()

    await usuario.press(screen.getByRole('button', { name: 'Remover o PDF' }))
    await waitFor(() => expect(pedidosPara(servidor, 'DELETE', CAMINHO_DO_PDF)).toHaveLength(1))
    expect(jest.mocked(confirmar).mock.calls[0]?.[0]).toMatchObject({
      titulo: 'Remover o PDF?',
      confirmar: 'Remover o PDF',
      destrutivo: true,
    })
  })

  test('recusar a confirmação de remover não chama a API', async () => {
    jest.mocked(confirmar).mockResolvedValueOnce(false)
    const { servidor } = await abrirEdicao(COM_PDF)
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Remover o PDF' }))
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1))
    expect(pedidosPara(servidor, 'DELETE', CAMINHO_DO_PDF)).toHaveLength(0)
  })

  test('com cifra nova, o aviso e a caixa do aceite são os da cifra: não se repetem para o PDF', async () => {
    escolher({ nome: 'cifra.pdf' })
    await abrirEdicao({ ...MUSICA, cifra: '[G]Sobre a rocha', temCifra: true })
    const usuario = userEvent.setup()
    // Cifra salva e sem mudança: o aviso aparece uma vez só (o da cifra), sem caixa.
    expect(await screen.findAllByText(/Cadastre só o que a sua comunidade pode usar/)).toHaveLength(
      1,
    )
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    // Sem o aceite, a caixa aparece uma vez, e o aviso continua sendo um só.
    expect(
      await screen.findAllByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    ).toHaveLength(1)
    expect(screen.getAllByText(/Cadastre só o que a sua comunidade pode usar/)).toHaveLength(1)
  })
})

describe('música nova com PDF', () => {
  test('o PDF escolhido espera o Salvar: cria a música e só então anexa, com o aceite', async () => {
    escolher({ nome: 'partitura.pdf' })
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    const { servidor } = await renderizarTela(<TelaConteudo novo />, {
      papel: 'organizador',
      rotas: {
        [`POST ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { id: ID, versao: 1 } }),
        [`PUT ${CAMINHO_DO_PDF}`]: () => ({
          status: 200,
          corpo: { temPdf: true, pdf: COM_PDF.pdf },
        }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText(/^Título/), 'Só a partitura')
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await usuario.press(
      await screen.findByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    )
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    expect(await screen.findByText('PDF escolhido')).toBeOnTheScreen()
    expect(screen.getByText(/partitura\.pdf · /)).toBeOnTheScreen()
    // Nada foi enviado ainda: a música nem existe.
    expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)).toHaveLength(0)

    await usuario.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)).toHaveLength(1))
    // A música sem cifra em texto não carrega `direitosConfirmados` no corpo; o PDF leva o dele.
    expect(pedidosPara(servidor, 'POST', `${BASE}/conteudos/musicas`)[0]!.corpo).toEqual({
      titulo: 'Só a partitura',
    })
    expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)[0]!.url).toContain(
      'direitosConfirmados=true',
    )
  })

  test('se o PDF falhar depois de criar a música, a música fica e a pessoa é avisada', async () => {
    escolher({ nome: 'partitura.pdf' })
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    const { servidor } = await renderizarTela(<TelaConteudo novo />, {
      papel: 'organizador',
      rotas: {
        [`POST ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { id: ID, versao: 1 } }),
        [`PUT ${CAMINHO_DO_PDF}`]: () => ({
          status: 503,
          corpo: { erro: 'indisponivel', mensagem: 'Fora do ar.' },
        }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText(/^Título/), 'Música')
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await usuario.press(
      await screen.findByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    )
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await screen.findByText('PDF escolhido')
    await usuario.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(pedidosPara(servidor, 'PUT', CAMINHO_DO_PDF)).toHaveLength(1))
    const { router } = jest.requireMock('expo-router') as { router: { replace: jest.Mock } }
    await waitFor(() => expect(router.replace).toHaveBeenCalled())
  })

  test('remover o PDF escolhido antes de salvar não chama a API', async () => {
    escolher({ nome: 'partitura.pdf' })
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    const { servidor } = await renderizarTela(<TelaConteudo novo />, { papel: 'organizador' })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Anexar PDF' }))
    await usuario.press(
      await screen.findByRole('checkbox', { name: TEXTO_DA_CONFIRMACAO_DE_DIREITOS }),
    )
    await usuario.press(screen.getByRole('button', { name: 'Anexar PDF' }))
    await screen.findByText('PDF escolhido')
    await usuario.press(screen.getByRole('button', { name: 'Remover o PDF' }))
    expect(await screen.findByText(/Anexe a cifra ou a partitura/)).toBeOnTheScreen()
    expect(servidor.pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(0)
  })
})

describe('ler e abrir o PDF na Biblioteca', () => {
  test('membro vê o cartão do PDF, abre com o visualizador e o arquivo vem da API com o ETag', async () => {
    const abrir = jest.fn(async (_bytes: Uint8Array, _nome: string) => 'aberto' as const)
    trocarVisualizadorDePdf({ abrir })
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: ID })
    const { servidor } = await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${ID}`]: () => ({ status: 200, corpo: COM_PDF }),
        [`GET ${CAMINHO_DO_PDF}`]: () => ({
          status: 200,
          bytes: PDF,
          cabecalhos: { etag: `"${VERSAO}"` },
        }),
      },
    })
    const usuario = userEvent.setup()
    expect(await screen.findByText('PDF da música')).toBeOnTheScreen()
    expect(screen.getByText('cifra-do-culto.pdf')).toBeOnTheScreen()
    expect(screen.getByText('PDF', { exact: true })).toBeOnTheScreen()
    expect(screen.getByText(/não muda de tom nem de tamanho de letra/)).toBeOnTheScreen()
    // Membro não anexa nem remove.
    expect(screen.queryByRole('button', { name: 'Anexar PDF' })).toBeNull()

    await usuario.press(screen.getByRole('button', { name: 'Abrir o PDF de Grande é o Senhor' }))
    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1))
    expect(mesmosBytes(abrir.mock.calls[0]![0], PDF)).toBe(true)
    expect(abrir.mock.calls[0]![1]).toBe('cifra-do-culto.pdf')
    expect(pedidosPara(servidor, 'GET', CAMINHO_DO_PDF)).toHaveLength(1)
  })

  test('música com cifra em texto E PDF: as duas opções aparecem', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: ID })
    await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${ID}`]: () => ({
          status: 200,
          corpo: {
            ...COM_PDF,
            cifra: '[G]Sobre a [D]rocha\n[Em]Quando o [C]vento',
            temCifra: true,
          },
        }),
      },
    })
    expect(
      await screen.findByRole('button', { name: 'Abrir o PDF de Grande é o Senhor' }),
    ).toBeOnTheScreen()
    expect(await screen.findByLabelText('Sobre a rocha. Acordes: G, D')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Subir tom' })).toBeOnTheScreen()
  })

  test('sem internet e sem cópia no aparelho: diz com todas as letras e oferece "Tentar de novo"', async () => {
    const abrir = jest.fn(async () => 'aberto' as const)
    trocarVisualizadorDePdf({ abrir })
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: ID })
    await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/conteudos/musicas/${ID}`]: () => ({ status: 200, corpo: COM_PDF }) },
    })
    const usuario = userEvent.setup()
    await screen.findByText('PDF da música')
    // Daqui para a frente a rede não responde.
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    await usuario.press(screen.getByRole('button', { name: 'Abrir o PDF de Grande é o Senhor' }))
    expect(await screen.findByText('Sem internet')).toBeOnTheScreen()
    expect(screen.getByText(/este PDF não está guardado neste aparelho/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
    expect(abrir).not.toHaveBeenCalled()
  })

  test('PDF removido enquanto a lista estava aberta: mensagem humana (404)', async () => {
    trocarVisualizadorDePdf({ abrir: jest.fn(async () => 'aberto' as const) })
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: ID })
    await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${ID}`]: () => ({ status: 200, corpo: COM_PDF }),
        [`GET ${CAMINHO_DO_PDF}`]: () => ({
          status: 404,
          corpo: { erro: 'nao_encontrado', mensagem: 'Não encontramos o que você procurou.' },
        }),
      },
    })
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Abrir o PDF de Grande é o Senhor' }))
    expect(await screen.findByText(/Este PDF foi removido da música/)).toBeOnTheScreen()
  })
})

describe('selo "PDF" na lista da Biblioteca', () => {
  test('a linha diz "PDF" em texto, e música com PDF não é "Sem cifra"', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudos />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas`]: () => ({
          status: 200,
          corpo: {
            itens: [
              COM_PDF,
              { ...MUSICA, id: 'outra', titulo: 'Sem nada', temCifra: false, temPdf: false },
            ],
          },
        }),
      },
    })
    expect(await screen.findByText(/^PDF · /)).toBeOnTheScreen()
    expect(screen.getAllByText(/^Sem cifra · /)).toHaveLength(1)
  })
})
