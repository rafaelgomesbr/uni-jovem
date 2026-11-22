/**
 * D79: a Agenda agrupada por DIA (cabeçalho do dia, encontros por horário), o aviso discreto de
 * encontros ao mesmo tempo e o filtro de rascunhos que é filtro de verdade.
 */
import { onlineManager } from '@tanstack/react-query'
import { act, screen, userEvent, within } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import { Dimensions } from 'react-native'

import type { ResumoDoEvento } from '@/servicos/contratoDosEventos'
import { BASE, FUSO, renderizarTela } from '@/testes/telas'
import { desfazerAgora } from '@/ui/ToastComDesfazer'
import { hojeNoFuso, instanteDeDataEHora, somarDias } from '@/utilidades/datas'

import { reiniciarRespostas } from '../../escalas/respostasOtimistas'
import { agruparEncontrosPorDia, avisoDeHorario, cabecalhoDoDia } from '../dias'
import { TelaAgenda } from '../TelaAgenda'

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

const HOJE = hojeNoFuso(FUSO)
const DIA = somarDias(HOJE, 6)
const OUTRO_DIA = somarDias(HOJE, 9)
const em = (dia: string, hora: string) => instanteDeDataEHora(dia, hora, FUSO)

function encontro(parcial: Partial<ResumoDoEvento> & { id: string }): ResumoDoEvento {
  return {
    titulo: 'Culto',
    categoria: 'Programação',
    inicio: em(DIA, '16:00'),
    duracaoMin: 60,
    fuso: FUSO,
    status: 'publicado',
    visibilidade: 'interna',
    serieId: null,
    versao: 1,
    localNome: null,
    localTipo: null,
    quantidadeDeEtapas: 0,
    ...parcial,
  }
}

function rotas(eventos: ResumoDoEvento[]) {
  return {
    [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos } }),
    [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [] } }),
    [`GET ${BASE}/inscricoes/eu`]: () => ({ status: 200, corpo: { inscricoes: [] } }),
    [`GET ${BASE}/substituicoes`]: () => ({ status: 200, corpo: { substituicoes: [] } }),
    [`GET ${BASE}/disponibilidade`]: () => ({ status: 200, corpo: { disponibilidade: [] } }),
    [`GET ${BASE}/eventos/anteriores-para-copiar`]: () => ({ status: 200, corpo: { opcoes: [] } }),
  }
}

describe('as contas do dia (puras)', () => {
  const manha = encontro({ id: 'a', titulo: 'Café', inicio: em(DIA, '09:00') })
  const tarde = encontro({ id: 'b', titulo: 'Culto', inicio: em(DIA, '16:00') })
  const outroDia = encontro({ id: 'c', titulo: 'Retiro', inicio: em(OUTRO_DIA, '08:00') })

  test('agrupa por dia e ordena por horário dentro do dia; dia vazio não existe', () => {
    const grupos = agruparEncontrosPorDia([outroDia, tarde, manha])
    expect(grupos.map((g) => g.dia)).toEqual([DIA, OUTRO_DIA])
    expect(grupos[0]!.itens.map((e) => e.id)).toEqual(['a', 'b'])
  })

  test('encontros passados vêm do mais recente para o mais antigo', () => {
    const grupos = agruparEncontrosPorDia([manha, outroDia, tarde], true)
    expect(grupos.map((g) => g.dia)).toEqual([OUTRO_DIA, DIA])
    expect(grupos[1]!.itens.map((e) => e.id)).toEqual(['b', 'a'])
  })

  test('o cabeçalho diz a data, "Hoje" ou "Amanhã" e, havendo vários, quantos', () => {
    expect(cabecalhoDoDia('2026-11-29', '2026-11-22', 1)).toBe('Dom., 29 de nov.')
    expect(cabecalhoDoDia('2026-11-29', '2026-11-22', 3)).toBe('Dom., 29 de nov. · 3 encontros')
    expect(cabecalhoDoDia('2026-11-22', '2026-11-22', 2)).toBe(
      'Dom., 22 de nov. · Hoje · 2 encontros',
    )
    expect(cabecalhoDoDia('2026-11-23', '2026-11-22', 1)).toBe('Seg., 23 de nov. · Amanhã')
  })

  test('"Ao mesmo tempo que": horários que se sobrepõem, com a hora do outro', () => {
    const a = encontro({ id: 'a', titulo: 'Culto', inicio: em(DIA, '16:00'), duracaoMin: 90 })
    const b = encontro({ id: 'b', titulo: 'Oficina', inicio: em(DIA, '17:00') })
    expect(avisoDeHorario(a, [a, b])).toBe('Ao mesmo tempo que Oficina (17:00)')
    expect(avisoDeHorario(b, [a, b])).toBe('Ao mesmo tempo que Culto (16:00)')
  })

  test('título repetido no mesmo dia se distingue pela hora', () => {
    const a = encontro({ id: 'a', titulo: 'Culto', inicio: em(DIA, '16:00'), duracaoMin: 120 })
    const b = encontro({ id: 'b', titulo: 'Culto', inicio: em(DIA, '17:00') })
    expect(avisoDeHorario(b, [a, b])).toBe('Ao mesmo tempo que Culto (16:00)')
  })

  test('"Logo depois de": começa até 30 min depois do fim de outro; mais longe, nada', () => {
    const a = encontro({ id: 'a', titulo: 'Café', inicio: em(DIA, '09:00') })
    const perto = encontro({ id: 'b', titulo: 'Culto', inicio: em(DIA, '10:15') })
    const longe = encontro({ id: 'c', titulo: 'Noite', inicio: em(DIA, '19:00') })
    expect(avisoDeHorario(perto, [a, perto, longe])).toBe('Logo depois de Café (09:00)')
    expect(avisoDeHorario(a, [a, perto, longe])).toBeNull()
    expect(avisoDeHorario(longe, [a, perto, longe])).toBeNull()
  })
})

/** O preset do Jest simula fonte grande (2x); aqui vale a normal. */
function usarFonte(fontScale: number) {
  const janela = { width: 390, height: 844, scale: 3, fontScale }
  Dimensions.set({ window: janela, screen: janela })
}

describe('a Agenda por dia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useLocalSearchParams).mockReturnValue({})
    reiniciarRespostas()
    onlineManager.setOnline(true)
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
    await act(async () => usarFonte(2))
  })

  test('três encontros no mesmo dia: um cabeçalho "3 encontros" e as linhas por horário, cada uma com a sua hora', async () => {
    const eventos = [
      encontro({ id: 'c', titulo: 'Noite', inicio: em(DIA, '19:00') }),
      encontro({ id: 'a', titulo: 'Café', inicio: em(DIA, '09:00') }),
      encontro({ id: 'b', titulo: 'Culto', inicio: em(DIA, '16:00') }),
    ]
    await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas(eventos) })
    const dia = await screen.findByTestId(`dia-${DIA}`)
    expect(within(dia).getByRole('header', { name: /3 encontros$/ })).toBeOnTheScreen()
    const titulos = within(dia)
      .getAllByText(/^(Café|Culto|Noite)$/)
      .map((t) => t.props.children)
    expect(titulos).toEqual(['Café', 'Culto', 'Noite'])
    expect(within(dia).getByText('09:00')).toBeOnTheScreen()
    expect(within(dia).getByText('19:00')).toBeOnTheScreen()
  })

  test('dois encontros que se sobrepõem mostram o aviso nas duas linhas; um cancelado não conta', async () => {
    const eventos = [
      encontro({ id: 'a', titulo: 'Culto', inicio: em(DIA, '16:00'), duracaoMin: 90 }),
      encontro({ id: 'b', titulo: 'Oficina', inicio: em(DIA, '17:00') }),
      encontro({ id: 'c', titulo: 'Cancelado', inicio: em(OUTRO_DIA, '10:00') }),
      encontro({ id: 'd', titulo: 'Outro', inicio: em(OUTRO_DIA, '10:30'), status: 'cancelado' }),
    ]
    await renderizarTela(<TelaAgenda />, { papel: 'membro', rotas: rotas(eventos) })
    expect(await screen.findByText('Ao mesmo tempo que Oficina (17:00)')).toBeOnTheScreen()
    expect(screen.getByText('Ao mesmo tempo que Culto (16:00)')).toBeOnTheScreen()
    // O cancelado não vira "ao mesmo tempo" de ninguém.
    expect(screen.getAllByTestId('aviso-de-horario')).toHaveLength(2)
  })

  test('"Rascunhos" é um filtro de verdade: marca, filtra e desmarca', async () => {
    const eventos = [
      encontro({ id: 'a', titulo: 'Publicado', inicio: em(DIA, '16:00') }),
      encontro({ id: 'b', titulo: 'Esboço', inicio: em(DIA, '18:00'), status: 'rascunho' }),
    ]
    await renderizarTela(<TelaAgenda />, { papel: 'organizador', rotas: rotas(eventos) })
    const filtro = await screen.findByRole('checkbox', { name: /Rascunhos/ })
    expect(filtro).not.toBeChecked()
    const usuario = userEvent.setup()
    await usuario.press(filtro)
    expect(screen.getByRole('checkbox', { name: /Rascunhos/ })).toBeChecked()
    expect(screen.getByText('Esboço')).toBeOnTheScreen()
    expect(screen.queryByText('Publicado')).toBeNull()
    await usuario.press(screen.getByRole('checkbox', { name: /Rascunhos/ }))
    expect(await screen.findByText('Publicado')).toBeOnTheScreen()
  })
})
