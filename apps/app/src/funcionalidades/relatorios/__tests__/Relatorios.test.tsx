import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { StyleSheet } from 'react-native'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { TelaComunidade } from '../../comunidade/TelaComunidade'
import { Numero } from '../GraficoDeBarras'
import { TelaExportacoes } from '../TelaExportacoes'
import { rotuloDoPeriodo, TelaRelatorios } from '../TelaRelatorios'

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

const PRESENCA = {
  periodo: { de: '2026-08-17', ate: '2026-11-14', fuso: 'America/Sao_Paulo', hoje: '2026-11-14' },
  totais: { eventos: 2, presentes: 30, mediaPorEvento: 15, membrosDistintos: 12 },
  porPeriodo: [
    { inicio: '2026-10-01', eventos: 1, presentes: 14, membrosDistintos: 10, mediaPorEvento: 14 },
    { inicio: '2026-11-01', eventos: 1, presentes: 16, membrosDistintos: 11, mediaPorEvento: 16 },
  ],
  porEvento: [],
}

describe('relatórios', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({})
  })

  test('membro não vê relatórios: nem na aba Comunidade, nem a tela busca dados', async () => {
    const { servidor } = await renderizarTela(<TelaRelatorios />, { papel: 'membro' })
    expect(await screen.findByText('Relatórios são da organização')).toBeOnTheScreen()
    expect(servidor.pedidos.filter((p) => p.url.includes('/relatorios/'))).toHaveLength(0)
  })

  test('o mural lista Relatórios só dentro da Organização, dobrada, para organizador para cima (D70)', async () => {
    const mural = (organizacao: unknown) => () => ({
      status: 200,
      corpo: {
        avisos: { total: 0, destaque: null },
        oracao: { novos: 0 },
        pessoas: { total: 3 },
        organizacao,
      },
    })
    const membro = await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: mural(null) },
    })
    expect(await screen.findByRole('button', { name: /^Pedidos de oração/ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Organização/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Relatórios[.]/ })).toBeNull()
    await membro.unmount()

    await renderizarTela(<TelaComunidade />, {
      papel: 'organizador',
      rotas: { [`GET ${BASE}/mural`]: mural({ pedidosDeEntrada: 0 }) },
    })
    // Dobrada: o organizador abre a Organização e então chega aos Relatórios.
    expect(screen.queryByRole('button', { name: /^Relatórios[.]/ })).toBeNull()
    await fireEvent.press(await screen.findByRole('button', { name: /^Organização/ }))
    await fireEvent.press(await screen.findByRole('button', { name: /^Relatórios[.]/ }))
    expect(router.push).toHaveBeenCalledWith('/relatorios')
  })

  test('a palavra "escala" saiu: o relatório de convocações e o rótulo de exportar', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ tipo: 'escalas' })
    await renderizarTela(<TelaRelatorios />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/relatorios/escalas`]: () => ({
          status: 200,
          corpo: {
            periodo: PRESENCA.periodo,
            totais: {
              escalas: 8,
              cumpridas: 6,
              recusadas: 1,
              semResposta: 1,
              substituicoesPedidas: 2,
              substituicoesAssumidas: 1,
            },
            porPessoa: [{ vinculoId: 'v1', nome: 'Bruno Lima', escalas: 3, cumpridas: 2 }],
          },
        }),
      },
    })
    expect(await screen.findByLabelText('convocações: 8')).toBeOnTheScreen()
    expect(screen.getByText('Convocações por pessoa')).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Convocações' })).toBeChecked()
    expect(screen.queryByText(/escalas?\b/i)).toBeNull()
  })

  test('carregando mostra o esqueleto; erro tem texto humano e "Tentar de novo"', async () => {
    let chamadas = 0
    await renderizarTela(<TelaRelatorios />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/relatorios/presenca`]: () => {
          chamadas += 1
          return chamadas === 1
            ? { status: 500, corpo: { codigo: 'erro_interno', mensagem: 'falha' } }
            : { status: 200, corpo: PRESENCA }
        },
      },
    })
    expect(await screen.findByText('Não deu para calcular o relatório')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByLabelText('presenças: 30')).toBeOnTheScreen()
  })

  test('presença: números e gráfico com o valor escrito ao lado', async () => {
    const { servidor } = await renderizarTela(<TelaRelatorios />, {
      papel: 'organizador',
      rotas: { [`GET ${BASE}/relatorios/presenca`]: () => ({ status: 200, corpo: PRESENCA }) },
    })
    expect(await screen.findByLabelText('presenças: 30')).toBeOnTheScreen()
    // Exportar não é mais um ícone sozinho no canto: a palavra vem à vista (D62).
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeOnTheScreen()
    expect(screen.getByText('Exportar')).toBeOnTheScreen()
    expect(screen.getByLabelText('out/2026 (1 encontro): 14')).toBeOnTheScreen()
    const pedido = pedidosPara(servidor, 'GET', `${BASE}/relatorios/presenca`)[0]!
    expect(pedido.url).toContain('agrupar=mes')
    expect(pedido.url).toMatch(/de=\d{4}-\d{2}-\d{2}&ate=\d{4}-\d{2}-\d{2}/)
  })

  test('os números do relatório são grandes (40) e usam algarismos tabulares (D70)', async () => {
    await render(<Numero rotulo="presenças" valor={1234} />)
    const estilo = StyleSheet.flatten(screen.getByTestId('numero-do-relatorio').props.style)
    expect(estilo.fontVariant).toEqual(['tabular-nums'])
    expect(estilo.fontSize).toBeGreaterThanOrEqual(40)
  })

  test('rótulo do período agrupado', () => {
    expect(rotuloDoPeriodo('2026-11-01', 'mes')).toBe('nov/2026')
    expect(rotuloDoPeriodo('2026-11-09', 'semana')).toBe('semana de 09/11/2026')
  })
})

describe('exportações', () => {
  test('gerar guarda o token só em memória e baixar manda o token no corpo do POST', async () => {
    const { shareAsync } = jest.requireMock('expo-sharing') as { shareAsync: jest.Mock }
    let lista: unknown[] = []
    const { servidor } = await renderizarTela(<TelaExportacoes />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/exportacoes`]: () => ({ status: 200, corpo: { exportacoes: lista } }),
        [`POST ${BASE}/exportacoes`]: () => {
          lista = [
            {
              id: 'x1',
              tipo: 'presenca',
              comContatos: false,
              filtros: { de: '2026-08-17', ate: '2026-11-14' },
              nomeArquivo: 'presenca_2026-08-17_a_2026-11-14.csv',
              linhas: 3,
              criadoEm: '2026-11-14T12:00:00.000Z',
              expiraEm: '2026-11-15T12:00:00.000Z',
              baixadaEm: null,
              downloads: 0,
            },
          ]
          return {
            status: 200,
            corpo: {
              id: 'x1',
              token: 't'.repeat(43),
              nomeArquivo: 'presenca_2026-08-17_a_2026-11-14.csv',
              linhas: 3,
              expiraEm: '2026-11-15T12:00:00.000Z',
              baixar: { metodo: 'POST', caminho: `${BASE}/exportacoes/x1/arquivo` },
            },
          }
        },
        [`POST ${BASE}/exportacoes/x1/arquivo`]: () => ({
          status: 200,
          corpo: 'Evento;Nome',
        }),
      },
    })

    // Organizador não tem a opção de contatos.
    expect(await screen.findByText(/Exportar contatos é só para administradores/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Gerar arquivo' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/exportacoes`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/exportacoes`)[0]!.corpo).toMatchObject({
      tipo: 'presenca',
      comContatos: false,
    })

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Baixar presenca_2026-08-17_a_2026-11-14.csv' }),
    )
    await waitFor(() => expect(shareAsync).toHaveBeenCalled())
    const download = pedidosPara(servidor, 'POST', `${BASE}/exportacoes/x1/arquivo`)[0]!
    expect(download.corpo).toEqual({ token: 't'.repeat(43) })
    expect(download.url).not.toContain('t'.repeat(43))
  })
})
