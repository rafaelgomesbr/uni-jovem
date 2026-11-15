import { screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { DIA_DO_INICIO, EVENTO_ID, INICIO } from '@/testes/fixturas'
import { BASE, FUSO, renderizarTela } from '@/testes/telas'
import { formatarDataPorExtenso } from '@/utilidades/datas'

import { TelaProgramacoes } from '../../eventos/TelaProgramacoes'
import { agruparPorDia, intervaloDoModo, passo } from '../calendario'
import { TelaAgenda } from '../TelaAgenda'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
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

describe('calendário (regras puras)', () => {
  test('intervalos de mês, semana e lista; passos para frente e para trás', () => {
    expect(intervaloDoModo('mes', '2026-11-15')).toEqual({
      inicio: '2026-11-01',
      fim: '2026-12-13',
    })
    expect(intervaloDoModo('semana', '2026-11-18')).toEqual({
      inicio: '2026-11-15',
      fim: '2026-11-22',
    })
    expect(passo('mes', '2026-11-15', -1)).toBe('2026-10-01')
  })

  test('agrupa pela data local do evento, não pela data UTC', () => {
    // 01:00 UTC do dia 22 ainda é 21/11 às 22:00 em São Paulo.
    const mapa = agruparPorDia([resumo({ inicio: '2026-11-22T01:00:00.000Z' })])
    expect([...mapa.keys()]).toEqual(['2026-11-21'])
  })
})

describe('programações', () => {
  beforeEach(() => jest.clearAllMocks())

  test('filtro por situação e busca; organizador vê "Nova programação"', async () => {
    await renderizarTela(<TelaProgramacoes />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: EVENTOS } }) },
    })
    const usuario = userEvent.setup()

    expect(await screen.findByText('3 programações')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('radio', { name: 'Rascunhos' }))
    expect(await screen.findByText('1 programação')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Luau musical, Rascunho/ })).toBeOnTheScreen()

    await usuario.press(screen.getByRole('button', { name: 'Nova programação' }))
    expect(router.push).toHaveBeenCalledWith('/evento/novo')
  })

  test('membro não vê criar nem o filtro de rascunhos', async () => {
    await renderizarTela(<TelaProgramacoes />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [EVENTOS[0]] } }) },
    })
    expect(await screen.findByText('1 programação')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Nova programação' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Rascunhos' })).toBeNull()
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

describe('agenda', () => {
  test('na lista, os eventos aparecem agrupados pelo dia, com rótulo completo', async () => {
    await renderizarTela(<TelaAgenda />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [EVENTOS[0]] } }) },
    })
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Lista' }))
    expect(
      await screen.findByText(`${formatarDataPorExtenso(DIA_DO_INICIO)} · 1 evento`),
    ).toBeOnTheScreen()
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: /^Sábado com a juventude, Publicado/ }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: EVENTO_ID },
    })
  })
})
