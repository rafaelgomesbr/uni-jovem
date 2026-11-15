import { screen, userEvent } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Dimensions } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { DIA_DO_INICIO, EVENTO_ID, eventoDeTeste, INICIO, retratoDeTeste } from '@/testes/fixturas'
import { BASE, FUSO, renderizarTela } from '@/testes/telas'
import { formatarDataPorExtenso, hojeNoFuso } from '@/utilidades/datas'

import {
  agruparPorDia,
  descreverPeriodo,
  intervaloDoModo,
  passo,
  periodoTemHoje,
} from '../calendario'
import { TelaAgenda } from '../TelaAgenda'
import { TelaTimelineDoDia } from '../TelaTimelineDoDia'

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

  test('título do período: mês com o ano; semana e lista por intervalo', () => {
    expect(descreverPeriodo('mes', '2026-11-18')).toBe('Novembro de 2026')
    expect(descreverPeriodo('semana', '2026-11-12')).toBe('8 a 14 de novembro')
    expect(descreverPeriodo('semana', '2026-12-01')).toBe('29 de novembro a 5 de dezembro')
    expect(descreverPeriodo('semana', '2026-12-31')).toBe(
      '27 de dezembro de 2026 a 2 de janeiro de 2027',
    )
    // "Hoje" só aparece fora do período que contém hoje.
    expect(periodoTemHoje('mes', '2026-11-01', '2026-11-18')).toBe(true)
    expect(periodoTemHoje('semana', '2026-11-08', '2026-11-18')).toBe(false)
  })

  test('agrupa pela data local do evento, não pela data UTC', () => {
    // 01:00 UTC do dia 22 ainda é 21/11 às 22:00 em São Paulo.
    const mapa = agruparPorDia([resumo({ inicio: '2026-11-22T01:00:00.000Z' })])
    expect([...mapa.keys()]).toEqual(['2026-11-21'])
  })
})

/** O preset do Jest simula fonte grande (2x); a grade do mês só aparece com fonte normal. */
function usarFonte(fontScale: number) {
  const janela = { width: 390, height: 844, scale: 3, fontScale }
  Dimensions.set({ window: janela, screen: janela })
}

describe('agenda', () => {
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => usarFonte(2))

  test('com fonte grande, a agenda abre em Lista', async () => {
    usarFonte(2)
    await renderizarTela(<TelaAgenda />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [] } }) },
    })
    expect(await screen.findByRole('radio', { name: 'Lista' })).toBeChecked()
    // Vazio: quem cria tem a ação de criar.
    expect(await screen.findByText('Nada marcado neste período')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Nova programação' })).toBeOnTheScreen()
  })

  test('na lista, os eventos aparecem agrupados pelo dia, com rótulo completo', async () => {
    await renderizarTela(<TelaAgenda />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [EVENTOS[0]] } }) },
    })
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Lista' }))
    // O dia é uma sobrancelha anunciada como cabeçalho, com a quantidade no rótulo.
    expect(
      await screen.findByRole('header', {
        name: `${formatarDataPorExtenso(DIA_DO_INICIO)}, 1 evento`,
      }),
    ).toBeOnTheScreen()
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: /^Sábado com a juventude, Publicado/ }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: EVENTO_ID },
    })
  })

  test('no mês, escolher o dia mostra os eventos e leva à linha do tempo', async () => {
    usarFonte(1)
    await renderizarTela(<TelaAgenda />, {
      rotas: {
        [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: EVENTOS.slice(0, 2) } }),
      },
    })
    const usuario = userEvent.setup()
    // Os botões de período começam pelo texto que se vê (revisão M5).
    const proximo = await screen.findByRole('button', { name: 'Próximo mês' })
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeOnTheScreen()
    if (DIA_DO_INICIO.slice(0, 7) !== hojeNoFuso(FUSO).slice(0, 7)) {
      await usuario.press(proximo)
      // Fora do mês de hoje, o terciário "Hoje" aparece.
      expect(await screen.findByRole('button', { name: 'Hoje' })).toBeOnTheScreen()
    }

    // A quantidade vai em texto no rótulo do dia, não só nos pontos.
    await usuario.press(
      await screen.findByRole('button', {
        name: `${formatarDataPorExtenso(DIA_DO_INICIO)}, 2 eventos`,
      }),
    )
    expect(
      await screen.findByRole('header', {
        name: `${formatarDataPorExtenso(DIA_DO_INICIO)}, 2 eventos`,
      }),
    ).toBeOnTheScreen()
    // O rascunho ganha chip; o publicado, não.
    expect(screen.getByText('Rascunho')).toBeOnTheScreen()
    expect(screen.queryByText('Publicado')).toBeNull()

    await usuario.press(
      screen.getByRole('button', {
        name: `Ver a linha do tempo de ${formatarDataPorExtenso(DIA_DO_INICIO)}`,
      }),
    )
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/agenda/[data]',
      params: { data: DIA_DO_INICIO },
    })
  })
})

describe('linha do tempo do dia', () => {
  beforeEach(() => jest.clearAllMocks())

  test('etapas com hora, quem está e a situação do ao vivo, e o progresso em texto', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ data: DIA_DO_INICIO })
    await renderizarTela(<TelaTimelineDoDia />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [EVENTOS[0]] } }),
        [`GET ${BASE}/eventos/${EVENTO_ID}`]: () => ({ status: 200, corpo: eventoDeTeste() }),
        [`GET ${BASE}/eventos/${EVENTO_ID}/ao-vivo`]: () => ({
          status: 200,
          // Boas-vindas concluída, Louvor em andamento, Encerramento a seguir.
          corpo: retratoDeTeste(),
        }),
      },
    })

    expect(await screen.findByText('1 de 3 etapas')).toBeOnTheScreen()
    expect(
      screen.getByLabelText(
        /^Etapa 2 de 3, .*, Louvor, 15 min, com Bruno Lima \(responsável\), Agora$/,
      ),
    ).toBeOnTheScreen()
    expect(screen.getByRole('progressbar', { name: '1 de 3 etapas concluídas' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Dia anterior' })).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Dia seguinte' }))
    expect(router.setParams).toHaveBeenCalled()
  })

  test('dia sem eventos explica e oferece voltar para a agenda', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ data: DIA_DO_INICIO })
    await renderizarTela(<TelaTimelineDoDia />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [] } }) },
    })
    expect(await screen.findByText('Nenhum evento neste dia')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar para a agenda' })).toBeOnTheScreen()
  })
})
