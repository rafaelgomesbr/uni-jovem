/* eslint-disable no-script-url -- o caso inclui javascript: de propósito: nunca pode virar botão */
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Linking } from 'react-native'

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
        /^Música 1 de 2: Grande é o Senhor\. Tom A \(original G\) · 72 bpm · 4:00 · de Ministério Exemplo\./,
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByLabelText(/^Música 2 de 2: Aleluia\. Tom D · 5:00 · Sem cifra\./),
    ).toBeOnTheScreen()
    expect(screen.getByText('Entra só o coro')).toBeOnTheScreen()
    // Soma 9 min contra os 15 da etapa Louvor: só informa, nada bloqueia. Vai no subtítulo da tela.
    expect(screen.getByText(/2 músicas, cerca de 9 min de 15 previstos/)).toBeOnTheScreen()
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

  describe('a folha da música (tom do dia, links, cifra)', () => {
    const abrirFolhaDe = async (rotulo: RegExp) => {
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByLabelText(rotulo))
      return usuario
    }

    test('a linha é uma só: título, tom, e "Subir" e "Descer" com texto; sem "Mais" nem Tom −/+', async () => {
      await montar('organizador', [ITEM_1, ITEM_2])
      await screen.findByLabelText(/^Música 1 de 2: Grande é o Senhor/)
      expect(screen.getAllByText('Subir')).toHaveLength(2)
      expect(screen.getAllByText('Descer')).toHaveLength(2)
      expect(screen.queryByText('Mais')).toBeNull()
      expect(screen.queryByRole('button', { name: /^Mais ações/ })).toBeNull()
      expect(screen.queryByText('Tom −')).toBeNull()
      expect(screen.queryByText('Tom +')).toBeNull()
    })

    test('tocar na linha abre a folha; Tom + anda meio tom a partir do que vale hoje, com a versão vista', async () => {
      const { servidor } = await montar('organizador', [ITEM_1, ITEM_2], {
        [`PATCH ${CAMINHO}/repertorio/${ITEM_2.id}`]: () => ({
          status: 200,
          corpo: { id: ITEM_2.id, versao: 2 },
        }),
      })
      const usuario = await abrirFolhaDe(/^Música 2 de 2: Aleluia/)
      expect(await screen.findByText(/O tom original é D/)).toBeOnTheScreen()
      await usuario.press(screen.getByRole('button', { name: 'Subir meio tom' }))
      expect(screen.getByDisplayValue('Eb')).toBeOnTheScreen()
      await usuario.press(screen.getByRole('button', { name: 'Salvar tom do dia' }))
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
      const usuario = await abrirFolhaDe(/^Música 1 de 1: Grande é o Senhor/)
      await usuario.press(await screen.findByRole('button', { name: 'Descer meio tom' }))
      await usuario.press(screen.getByRole('button', { name: 'Salvar tom do dia' }))
      await waitFor(() =>
        expect(
          pedidosPara(servidor, 'PATCH', `${CAMINHO}/repertorio/${ITEM_1.id}`)[0]?.corpo,
        ).toEqual({ versao: 1, tomDoDia: null }),
      )
    })

    test('sem tom cadastrado: Tom − e + ficam desligados e a folha diz o que fazer', async () => {
      await montar('organizador', [{ ...ITEM_2, tomOriginal: null }])
      await abrirFolhaDe(/^Música 1 de 1: Aleluia/)
      expect(await screen.findByRole('button', { name: 'Subir meio tom' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Descer meio tom' })).toBeDisabled()
      expect(screen.getByText(/Esta música não tem tom original cadastrado/)).toBeOnTheScreen()
    })

    test('tom inválido é recusado com mensagem humana, sem pedido ao servidor', async () => {
      const { servidor } = await montar('organizador', [ITEM_1])
      const usuario = await abrirFolhaDe(/^Música 1 de 1: Grande é o Senhor/)
      const campo = await screen.findByDisplayValue('A')
      await usuario.clear(campo)
      await usuario.type(campo, 'XYZ')
      await usuario.press(screen.getByRole('button', { name: 'Salvar tom do dia' }))
      expect(await screen.findByText('Use um tom como G, Am, F#m ou Bb.')).toBeOnTheScreen()
      expect(pedidosPara(servidor, 'PATCH', `${CAMINHO}/repertorio/${ITEM_1.id}`)).toHaveLength(0)
    })

    test('"Abrir a cifra" leva à música na biblioteca', async () => {
      await montar('organizador', [ITEM_1])
      const usuario = await abrirFolhaDe(/^Música 1 de 1: Grande é o Senhor/)
      await usuario.press(await screen.findByRole('button', { name: 'Abrir a cifra' }))
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith({
          pathname: '/conteudos/[tipo]/[itemId]',
          params: { tipo: 'musicas', itemId: ITEM_1.musicaId },
        }),
      )
    })

    describe('links do Drive e do YouTube (D80)', () => {
      const comLinks: ItemDoRepertorio = {
        ...ITEM_1,
        links: [
          { url: 'https://www.youtube.com/watch?v=abc123', rotulo: 'Versão original' },
          { url: 'https://drive.google.com/file/d/1AbC/view' },
          { url: 'javascript:alert(1)' },
        ],
      }

      test('a linha diz em texto que há links; a folha tem um botão por link válido, com o aviso de que sai do app', async () => {
        const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
        await montar('organizador', [comLinks])
        expect(await screen.findByLabelText(/Links: YouTube e Drive/)).toBeOnTheScreen()
        const usuario = await abrirFolhaDe(/^Música 1 de 1: Grande é o Senhor/)
        expect(await screen.findByText('Versão original')).toBeOnTheScreen()
        // O endereço fora da regra nunca vira botão.
        expect(screen.getAllByRole('button', { name: /^Abrir no / })).toHaveLength(2)
        expect(screen.getByText(/você sai do Uni Jovem/)).toBeOnTheScreen()
        await usuario.press(
          screen.getByRole('button', { name: 'Abrir no YouTube: Versão original' }),
        )
        expect(abrir).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc123')
        await usuario.press(
          screen.getByRole('button', { name: 'Abrir no Drive: Grande é o Senhor' }),
        )
        expect(abrir).toHaveBeenLastCalledWith('https://drive.google.com/file/d/1AbC/view')
        expect(abrir).not.toHaveBeenCalledWith('javascript:alert(1)')
      })

      test('se o celular não abre o link, a pessoa lê o que fazer', async () => {
        jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sem app'))
        await montar('organizador', [comLinks])
        const usuario = await abrirFolhaDe(/^Música 1 de 1: Grande é o Senhor/)
        await usuario.press(
          await screen.findByRole('button', { name: 'Abrir no YouTube: Versão original' }),
        )
        await waitFor(() =>
          expect(mostrarToast).toHaveBeenCalledWith({
            texto: expect.stringMatching(/Não deu para abrir o link/),
          }),
        )
      })

      test('sem links, a folha não mostra a seção', async () => {
        await montar('organizador', [ITEM_1])
        await abrirFolhaDe(/^Música 1 de 1: Grande é o Senhor/)
        await screen.findByRole('button', { name: 'Salvar tom do dia' })
        expect(screen.queryByText('Links')).toBeNull()
        expect(screen.queryByRole('button', { name: /^Abrir no / })).toBeNull()
      })
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

    test('o botão que conclui fica fixo embaixo, fora da rolagem', async () => {
      await montar('organizador', [ITEM_1], {
        [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens: biblioteca } }),
      })
      await userEvent
        .setup()
        .press(await screen.findByRole('button', { name: 'Adicionar músicas' }))
      await screen.findByRole('checkbox', { name: /^Outra canção/ })
      const rodape = screen.getByTestId('rodape-da-folha')
      expect(within(rodape).getByRole('button', { name: 'Marque as músicas' })).toBeDisabled()
    })

    describe('cadastrar uma música nova na própria folha (D80)', () => {
      const abrirAFolha = async (itens: unknown[], rotas: object = {}) => {
        const r = await montar('organizador', [ITEM_1], {
          [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens } }),
          ...rotas,
        })
        const usuario = userEvent.setup()
        await usuario.press(await screen.findByRole('button', { name: 'Adicionar músicas' }))
        return { ...r, usuario }
      }
      const SALVAR = 'Salvar na biblioteca e adicionar ao repertório'

      test('"Cadastrar nova música" está sempre no alto, mesmo com músicas para marcar', async () => {
        await abrirAFolha(biblioteca)
        expect(
          await screen.findByRole('button', { name: 'Cadastrar nova música' }),
        ).toBeOnTheScreen()
        expect(screen.getByRole('checkbox', { name: /^Outra canção/ })).toBeOnTheScreen()
      })

      test('com a biblioteca toda usada: "Todas as músicas já estão aqui. Quer cadastrar uma nova?" com o botão', async () => {
        await abrirAFolha([biblioteca[0]])
        expect(
          await screen.findByText('Todas as músicas já estão aqui. Quer cadastrar uma nova?'),
        ).toBeOnTheScreen()
        expect(screen.getByRole('button', { name: 'Cadastrar nova música' })).toBeOnTheScreen()
        // Sem nada para marcar, não há botão de adicionar desabilitado atrapalhando.
        expect(screen.queryByRole('button', { name: 'Marque as músicas' })).toBeNull()
      })

      test('com a biblioteca vazia, o botão é o mesmo, sem sair da folha', async () => {
        const { usuario } = await abrirAFolha([])
        expect(await screen.findByText(/A biblioteca ainda não tem músicas/)).toBeOnTheScreen()
        await usuario.press(screen.getByRole('button', { name: 'Cadastrar nova música' }))
        expect(await screen.findByLabelText(/^Título/)).toBeOnTheScreen()
        expect(router.push).not.toHaveBeenCalled()
      })

      test('busca que não acha vira Cadastrar “texto”, com o título já preenchido', async () => {
        const { usuario } = await abrirAFolha(biblioteca)
        await usuario.type(await screen.findByLabelText('Buscar na biblioteca'), 'Oceanos')
        expect(
          await screen.findByText(
            'Nenhuma música com essa busca. As que já estão no repertório não aparecem.',
          ),
        ).toBeOnTheScreen()
        await usuario.press(screen.getByRole('button', { name: 'Cadastrar a música Oceanos' }))
        expect(await screen.findByDisplayValue('Oceanos')).toBeOnTheScreen()
      })

      test('título igual ao de uma música da biblioteca: o botão volta a ser o geral', async () => {
        const { usuario } = await abrirAFolha(biblioteca)
        await usuario.type(await screen.findByLabelText('Buscar na biblioteca'), 'Outra canção')
        expect(screen.getByRole('button', { name: 'Cadastrar nova música' })).toBeOnTheScreen()
      })

      test('salvar cria a música E a põe no repertório numa chamada só, e a folha fecha', async () => {
        const { servidor, usuario } = await abrirAFolha(biblioteca, {
          [`POST ${CAMINHO}/repertorio/nova-musica`]: () => ({
            status: 200,
            corpo: { musicaId: 'm-criada', id: 'item-novo', ordem: 1 },
          }),
        })
        await usuario.press(await screen.findByRole('button', { name: 'Cadastrar nova música' }))
        await usuario.type(await screen.findByLabelText(/^Título/), 'Oceanos')
        await usuario.type(screen.getByLabelText(/^Tom/), 'Em')
        await usuario.press(screen.getByRole('button', { name: /^Adicionar link/ }))
        await usuario.type(await screen.findByLabelText('Link 1'), 'https://youtu.be/abc123')
        await usuario.type(screen.getByLabelText(/Nome do link 1/), 'Ao vivo')
        await usuario.press(screen.getByRole('button', { name: SALVAR }))
        await waitFor(() =>
          expect(
            pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/nova-musica`)[0]?.corpo,
          ).toEqual({
            titulo: 'Oceanos',
            tom: 'Em',
            links: [{ url: 'https://youtu.be/abc123', rotulo: 'Ao vivo' }],
          }),
        )
        await waitFor(() =>
          expect(mostrarToast).toHaveBeenCalledWith({
            texto: '“Oceanos” entrou na biblioteca e neste repertório.',
          }),
        )
        // Uma chamada só: nada de criar a música e depois "adicionar" pela rota de sempre.
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio`)).toHaveLength(0)
        await waitFor(() => expect(screen.queryByText('Nova música')).toBeNull())
      })

      test('o título é obrigatório e o link fora do Drive e do YouTube é recusado em palavras, sem pedido', async () => {
        const { servidor, usuario } = await abrirAFolha(biblioteca)
        await usuario.press(await screen.findByRole('button', { name: 'Cadastrar nova música' }))
        await usuario.press(await screen.findByRole('button', { name: SALVAR }))
        expect(await screen.findByText(/Informe título/)).toBeOnTheScreen()
        await usuario.type(screen.getByLabelText(/^Título/), 'Oceanos')
        await usuario.press(screen.getByRole('button', { name: /^Adicionar link/ }))
        await usuario.type(await screen.findByLabelText('Link 1'), 'https://exemplo.test/x')
        await usuario.press(screen.getByRole('button', { name: SALVAR }))
        expect(await screen.findByText(/Google Drive ou do YouTube/)).toBeOnTheScreen()
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/nova-musica`)).toHaveLength(0)
      })

      test('cifra pede o aceite de direitos; sem ele nada é enviado', async () => {
        const { servidor, usuario } = await abrirAFolha(biblioteca)
        await usuario.press(await screen.findByRole('button', { name: 'Cadastrar nova música' }))
        await usuario.type(await screen.findByLabelText(/^Título/), 'Oceanos')
        await usuario.type(screen.getByLabelText(/^Cifra ou letra/), '[G]Sobre a rocha')
        await usuario.press(screen.getByRole('button', { name: SALVAR }))
        expect(
          await screen.findByText('Confirme os direitos de uso para salvar a letra e a cifra.'),
        ).toBeOnTheScreen()
        expect(pedidosPara(servidor, 'POST', `${CAMINHO}/repertorio/nova-musica`)).toHaveLength(0)
      })

      test('a explicação diz que a música fica na biblioteca, e "Voltar à lista" volta sem fechar a folha', async () => {
        const { usuario } = await abrirAFolha(biblioteca)
        await usuario.press(await screen.findByRole('button', { name: 'Cadastrar nova música' }))
        expect(
          await screen.findByText(/Toda música cadastrada fica na biblioteca/),
        ).toBeOnTheScreen()
        await usuario.press(screen.getByRole('button', { name: 'Voltar à lista' }))
        expect(await screen.findByRole('checkbox', { name: /^Outra canção/ })).toBeOnTheScreen()
      })

      test('erro do servidor aparece em palavras e o formulário continua preenchido', async () => {
        const { usuario } = await abrirAFolha(biblioteca, {
          [`POST ${CAMINHO}/repertorio/nova-musica`]: () => ({
            status: 400,
            corpo: {
              erro: 'link_invalido',
              mensagem: 'Só dá para usar links do Google Drive ou do YouTube.',
            },
          }),
        })
        await usuario.press(await screen.findByRole('button', { name: 'Cadastrar nova música' }))
        await usuario.type(await screen.findByLabelText(/^Título/), 'Oceanos')
        await usuario.press(screen.getByRole('button', { name: SALVAR }))
        expect(await screen.findByText('A música não foi salva')).toBeOnTheScreen()
        expect(screen.getByDisplayValue('Oceanos')).toBeOnTheScreen()
      })
    })
  })

  describe('tirar com Desfazer', () => {
    test('some da lista na hora e só é removida no servidor depois dos 10 s', async () => {
      const { servidor } = await montar('organizador', [ITEM_1, ITEM_2], {
        [`DELETE ${CAMINHO}/repertorio/${ITEM_2.id}`]: () => ({ status: 200, corpo: { ok: true } }),
      })
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByLabelText(/^Música 2 de 2: Aleluia/))
      await usuario.press(await screen.findByRole('button', { name: 'Tirar do repertório' }))

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
      await usuario.press(await screen.findByLabelText(/^Música 2 de 2: Aleluia/))
      await usuario.press(await screen.findByRole('button', { name: 'Tirar do repertório' }))
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
