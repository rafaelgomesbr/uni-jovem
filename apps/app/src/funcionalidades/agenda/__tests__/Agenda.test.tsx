import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Dimensions } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { DIA_DO_INICIO, EVENTO_ID, eventoDeTeste, INICIO, retratoDeTeste } from '@/testes/fixturas'
import { BASE, FUSO, renderizarTela } from '@/testes/telas'
import { formatarDataPorExtenso, hojeNoFuso } from '@/utilidades/datas'

import {
  agruparPorDia,
  dataDaRota,
  descreverPeriodo,
  intervaloDoModo,
  passo,
  periodoTemHoje,
} from '../calendario'
import { TelaAgenda } from '../TelaAgenda'
import { TelaTimelineDoDia } from '../TelaTimelineDoDia'

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
  test('data da rota: real e de 1900 a 2100; o resto é inválido, e sem data vale hoje', () => {
    expect(dataDaRota('2026-11-21')).toBe('2026-11-21')
    expect(dataDaRota('9999-12-31')).toBe('invalida')
    expect(dataDaRota('1899-12-31')).toBe('invalida')
    expect(dataDaRota('2026-02-30')).toBe('invalida')
    expect(dataDaRota('ontem')).toBe('invalida')
    expect(dataDaRota(null)).toBeNull()
  })

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
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
  })
  afterEach(() => usarFonte(2))

  test('com fonte grande, a agenda abre em Lista', async () => {
    usarFonte(2)
    await renderizarTela(<TelaAgenda />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [] } }) },
    })
    expect(await screen.findByRole('radio', { name: 'Lista' })).toBeChecked()
    // Vazio: quem cria tem a ação de criar.
    expect(await screen.findByText('Nenhum encontro marcado')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Novo Sábado padrão' })).toBeOnTheScreen()
  })

  test('D57: o seletor alterna Calendário e Lista na mesma aba', async () => {
    usarFonte(1)
    await renderizarTela(<TelaAgenda />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [EVENTOS[0]] } }) },
    })
    const usuario = userEvent.setup()
    // Com a fonte padrão, abre no calendário (Mês e Semana dentro dele).
    expect(await screen.findByRole('radio', { name: 'Calendário' })).toBeChecked()
    expect(await screen.findByRole('button', { name: 'Mês anterior' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Mês' })).toBeChecked()

    // Lista: a antiga aba Programas, com busca e filtros.
    await usuario.press(screen.getByRole('radio', { name: 'Lista' }))
    expect(await screen.findByText('1 encontro')).toBeOnTheScreen()
    expect(screen.getByLabelText('Buscar por título ou categoria')).toBeOnTheScreen()
    expect(screen.getByRole('checkbox', { name: 'Rascunhos' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Mês anterior' })).toBeNull()
    await usuario.press(screen.getByRole('button', { name: /^Sábado com a juventude, Publicado/ }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: EVENTO_ID },
    })

    // E de volta ao calendário.
    await usuario.press(screen.getByRole('radio', { name: 'Calendário' }))
    expect(await screen.findByRole('button', { name: 'Mês anterior' })).toBeOnTheScreen()
  })

  test('o link antigo (`?vista=lista`) abre direto na Lista', async () => {
    usarFonte(1)
    jest.mocked(useLocalSearchParams).mockReturnValue({ vista: 'lista' })
    await renderizarTela(<TelaAgenda />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [EVENTOS[0]] } }) },
    })
    expect(await screen.findByRole('radio', { name: 'Lista' })).toBeChecked()
    expect(await screen.findByText('1 encontro')).toBeOnTheScreen()
  })

  test('no mês, escolher o dia mostra os encontros e leva à linha do tempo', async () => {
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
        name: `${formatarDataPorExtenso(DIA_DO_INICIO)}, 2 encontros`,
      }),
    )
    expect(
      await screen.findByRole('header', {
        name: `${formatarDataPorExtenso(DIA_DO_INICIO)}, 2 encontros`,
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

  test('"Novo encontro neste dia" abre a folha de modelos com a data do dia', async () => {
    usarFonte(1)
    await renderizarTela(<TelaAgenda />, {
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [] } }) },
    })
    const usuario = userEvent.setup()
    const hoje = hojeNoFuso(FUSO)
    await usuario.press(
      await screen.findByRole('button', {
        name: `Novo encontro em ${formatarDataPorExtenso(hoje)}`,
      }),
    )
    // A mesma folha do "Novo encontro": o sábado nunca nasce sem as etapas.
    expect(await screen.findByText('Em branco')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: /^Sábado padrão/ }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/novo',
        params: { modelo: 'sabado_padrao', data: hoje },
      }),
    )
  })

  test('"Novo encontro" no topo, para quem cria; o membro não vê', async () => {
    usarFonte(1)
    await renderizarTela(<TelaAgenda />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [] } }) },
    })
    expect(await screen.findByRole('radio', { name: 'Calendário' })).toBeChecked()
    expect(screen.queryByRole('button', { name: 'Novo encontro' })).toBeNull()
    // As escalas viraram aba (D57): o atalho antigo saiu da Agenda.
    expect(screen.queryByRole('button', { name: 'Minhas escalas' })).toBeNull()
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

  test('data impossível no link (9999-12-31): "Data inválida" e "Ir para hoje", sem cair', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ data: '9999-12-31' })
    const { servidor } = await renderizarTela(<TelaTimelineDoDia />, { papel: 'membro' })
    expect(await screen.findByText('Data inválida')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ir para hoje' }))
    expect(router.setParams).toHaveBeenCalledWith({ data: hojeNoFuso(FUSO) })
    // Nada vai à rede com uma data que não existe.
    expect(servidor.pedidos.some((p) => p.url.includes('/eventos'))).toBe(false)
  })

  test('dia sem eventos explica e oferece voltar para a agenda', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ data: DIA_DO_INICIO })
    await renderizarTela(<TelaTimelineDoDia />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [] } }) },
    })
    expect(await screen.findByText('Nenhum encontro neste dia')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar para a agenda' })).toBeOnTheScreen()
  })
})
