import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { EVENTO_ID, INICIO } from '@/testes/fixturas'
import { BASE, FUSO, renderizarTela } from '@/testes/telas'

import { TelaProgramacoes } from '../TelaProgramacoes'

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

function resumo(parcial: Partial<ResumoDoEvento>): ResumoDoEvento {
  return {
    id: EVENTO_ID,
    titulo: 'Sábado com a juventude',
    categoria: 'Programação de sábado',
    inicio: INICIO,
    duracaoMin: 60,
    fuso: FUSO,
    status: 'publicado',
    visibilidade: 'interna',
    serieId: null,
    versao: 1,
    localNome: null,
    localTipo: null,
    quantidadeDeEtapas: 7,
    ...parcial,
  }
}

const EVENTOS = [
  resumo({}),
  resumo({ id: 'e2', titulo: 'Luau musical', categoria: 'Luau musical', status: 'rascunho' }),
  resumo({ id: 'e3', titulo: 'Ação social', categoria: 'Ação social', status: 'cancelado' }),
]

describe('programas', () => {
  beforeEach(() => jest.clearAllMocks())

  test('filtro por situação (tocar de novo desmarca) e busca por título', async () => {
    await renderizarTela(<TelaProgramacoes />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: EVENTOS } }) },
    })
    const usuario = userEvent.setup()

    expect(await screen.findByText('3 programações')).toBeOnTheScreen()
    const rascunhos = screen.getByRole('checkbox', { name: 'Rascunhos' })
    await usuario.press(rascunhos)
    expect(await screen.findByText('1 programação')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Luau musical, Rascunho/ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Ação social/ })).toBeNull()

    await usuario.press(screen.getByRole('checkbox', { name: 'Rascunhos', checked: true }))
    expect(await screen.findByText('3 programações')).toBeOnTheScreen()

    await fireEvent.changeText(screen.getByLabelText('Buscar por título ou categoria'), 'açao soc')
    expect(await screen.findByText('1 programação')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Ação social, Cancelado/ })).toBeOnTheScreen()
  })

  test('filtro sem resultado: estado vazio com "Limpar filtros"', async () => {
    await renderizarTela(<TelaProgramacoes />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [EVENTOS[0]] } }) },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('checkbox', { name: 'Cancelados' }))
    expect(await screen.findByText('Nada com esses filtros')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(await screen.findByText('1 programação')).toBeOnTheScreen()
  })

  test('organizador cria por "Nova" (escrito): a folha oferece Sábado padrão, Em branco e modelo', async () => {
    await renderizarTela(<TelaProgramacoes />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: EVENTOS } }) },
    })
    const usuario = userEvent.setup()
    const nova = await screen.findByRole('button', { name: 'Nova programação' })
    // O texto à vista, não só um "+".
    expect(nova).toHaveTextContent('Nova')
    await usuario.press(nova)
    expect(await screen.findByRole('button', { name: /^Sábado padrão/ })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^A partir de um modelo/ })).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: /^Em branco/ }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/evento/novo'))
  })

  test('membro não vê criar nem o filtro de rascunhos', async () => {
    await renderizarTela(<TelaProgramacoes />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [EVENTOS[0]] } }) },
    })
    expect(await screen.findByText('1 programação')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Nova programação' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Rascunhos' })).toBeNull()
  })

  test('lista vazia explica e oferece ação', async () => {
    await renderizarTela(<TelaProgramacoes />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [] } }) },
    })
    expect(await screen.findByText('Nenhuma programação marcada')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver a agenda' })).toBeOnTheScreen()
  })
})
