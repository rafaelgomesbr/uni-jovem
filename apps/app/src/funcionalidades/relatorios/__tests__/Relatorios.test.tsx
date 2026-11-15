import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { TelaMais } from '../../navegacao/TelaMais'
import { TelaExportacoes } from '../TelaExportacoes'
import { rotuloDoPeriodo, TelaRelatorios } from '../TelaRelatorios'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
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
  beforeEach(() => jest.clearAllMocks())

  test('membro não vê relatórios: nem no "Mais", nem a tela busca dados', async () => {
    const { servidor } = await renderizarTela(<TelaRelatorios />, { papel: 'membro' })
    expect(await screen.findByText('Relatórios são da organização')).toBeOnTheScreen()
    expect(servidor.pedidos.filter((p) => p.url.includes('/relatorios/'))).toHaveLength(0)
  })

  test('o "Mais" lista Relatórios só para organizador para cima', async () => {
    await renderizarTela(<TelaMais />, { papel: 'membro' })
    expect(await screen.findByRole('button', { name: /^Oração\./ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Relatórios\./ })).toBeNull()
  })

  test('organizador vê o "Mais" com Relatórios e abre a tela', async () => {
    await renderizarTela(<TelaMais />, { papel: 'organizador' })
    await fireEvent.press(await screen.findByRole('button', { name: /^Relatórios\./ }))
    expect(router.push).toHaveBeenCalledWith('/relatorios')
  })

  test('presença: números e gráfico com o valor escrito ao lado', async () => {
    const { servidor } = await renderizarTela(<TelaRelatorios />, {
      papel: 'organizador',
      rotas: { [`GET ${BASE}/relatorios/presenca`]: () => ({ status: 200, corpo: PRESENCA }) },
    })
    expect(await screen.findByLabelText('presenças: 30')).toBeOnTheScreen()
    expect(screen.getByLabelText('out/2026 (1 evento): 14')).toBeOnTheScreen()
    const pedido = pedidosPara(servidor, 'GET', `${BASE}/relatorios/presenca`)[0]!
    expect(pedido.url).toContain('agrupar=mes')
    expect(pedido.url).toMatch(/de=\d{4}-\d{2}-\d{2}&ate=\d{4}-\d{2}-\d{2}/)
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
