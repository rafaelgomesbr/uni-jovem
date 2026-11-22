import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { TelaConteudo } from '../TelaConteudo'
import { TelaConteudos } from '../TelaConteudos'

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

const MUSICA = {
  id: '99999999-9999-4999-8999-000000000001',
  titulo: 'Grande é o Senhor',
  artista: 'Ministério Exemplo',
  tom: 'G',
  link: 'https://exemplo.com/cifra',
  cifra: 'G D Em C',
  observacoes: null,
  arquivada: false,
  musicos: [{ id: 'm1', nome: 'Bruno Lima' }],
  versao: 3,
  criadoEm: '2026-11-01T12:00:00.000Z',
  atualizadoEm: '2026-11-01T12:00:00.000Z',
}

const OUTRA = { ...MUSICA, id: '99999999-9999-4999-8999-000000000002', titulo: 'Aleluia' }

describe('conteúdos (3.7.3)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('lista com busca sem acento; quem gerencia vê o "+"', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudos />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/conteudos/musicas`]: () => ({
          status: 200,
          corpo: { itens: [MUSICA, OUTRA] },
        }),
      },
    })
    expect(await screen.findByText('Grande é o Senhor')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Adicionar música' })).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Buscar em músicas'), 'grande e')
    await waitFor(() => expect(screen.queryByText('Aleluia')).toBeNull())
    expect(screen.getByText('Grande é o Senhor')).toBeOnTheScreen()
  })

  test('membro lê os detalhes, sem "Editar"', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: MUSICA.id })
    await renderizarTela(<TelaConteudo />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({ status: 200, corpo: MUSICA }),
      },
    })
    expect(await screen.findByText('G D Em C')).toBeOnTheScreen()
    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen()
    expect(
      screen.getByRole('link', { name: 'Abrir o link: https://exemplo.com/cifra' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar a música' })).toBeNull()
  })

  test('quem gerencia edita pela barra de ação e salva com a versão vista', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas', itemId: MUSICA.id })
    const { servidor } = await renderizarTela(<TelaConteudo />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({ status: 200, corpo: MUSICA }),
        [`GET ${BASE}/conteudos/musicos`]: () => ({ status: 200, corpo: { itens: [] } }),
        [`PATCH ${BASE}/conteudos/musicas/${MUSICA.id}`]: () => ({
          status: 200,
          corpo: { id: MUSICA.id, versao: 4 },
        }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar a música' }))
    await fireEvent.changeText(await screen.findByLabelText(/^Tom/), 'A')
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', `${BASE}/conteudos/musicas/${MUSICA.id}`)).toHaveLength(
        1,
      ),
    )
    expect(
      pedidosPara(servidor, 'PATCH', `${BASE}/conteudos/musicas/${MUSICA.id}`)[0]!.corpo,
    ).toMatchObject({ tom: 'A', versao: 3 })
  })
})

describe('Biblioteca no visual A (D71)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('o título é Biblioteca e quem gerencia vê "Nova" escrito, não só um símbolo', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudos />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens: [MUSICA] } }),
      },
    })
    expect(await screen.findByRole('header', { name: 'Biblioteca' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Adicionar música' })).toHaveTextContent('Nova')
    // Música sem cifra no texto (a lista só diz que há, nunca traz a cifra).
    expect(screen.queryByText('G D Em C')).toBeNull()
  })

  test('vazio: o sol, o porquê e a ação para quem organiza', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudos />, {
      papel: 'organizador',
      rotas: { [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens: [] } }) },
    })
    expect(await screen.findByText('Nenhuma música cadastrada')).toBeOnTheScreen()
    expect(screen.getAllByRole('button', { name: 'Adicionar música' })).toHaveLength(2)
  })

  test('vazio para membro: espera a organização, sem botão', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudos />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/conteudos/musicas`]: () => ({ status: 200, corpo: { itens: [] } }) },
    })
    expect(
      await screen.findByText('Quando a organização cadastrar, aparece aqui.'),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Adicionar música' })).toBeNull()
  })

  test('erro: texto humano e "Tentar de novo"', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudos />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/conteudos/musicas`]: () => ({
          status: 500,
          corpo: { erro: 'interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
        }),
      },
    })
    expect(await screen.findByText('Não deu para carregar as músicas')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('carregando: esqueleto com a forma das linhas', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ tipo: 'musicas' })
    await renderizarTela(<TelaConteudos />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/conteudos/musicas`]: () => new Promise<never>(() => {}) },
    })
    expect(await screen.findByLabelText('Carregando músicas')).toBeOnTheScreen()
  })
})
