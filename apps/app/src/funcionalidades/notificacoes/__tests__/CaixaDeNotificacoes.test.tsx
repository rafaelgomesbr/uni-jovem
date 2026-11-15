import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'

import { INTERVALO_DO_CONTADOR, type NotificacaoDaCaixa } from '../caixa'
import { SinoDeNotificacoes } from '../SinoDeNotificacoes'
import { agruparPorDia, TelaCaixaDeNotificacoes } from '../TelaCaixaDeNotificacoes'

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

const CAIXA = '/api/v1/eu/notificacoes/caixa'
const NAO_LIDAS = `GET ${CAIXA}/nao-lidas`

function notificacao(i: number, parcial: Partial<NotificacaoDaCaixa> = {}): NotificacaoDaCaixa {
  return {
    id: `n-${String(i).padStart(3, '0')}`,
    tipo: 'escalas',
    titulo: `Nova escala ${i}`,
    texto: 'Você foi escalado para um evento. Abra o app para confirmar.',
    comunidade: { id: COMUNIDADE, nome: 'Jovens Centro' },
    destino: { tela: 'escalas' },
    lida: false,
    lidaEm: null,
    criadoEm: new Date(Date.now() - i * 60_000).toISOString(),
    ...parcial,
  }
}

const vinte = Array.from({ length: 20 }, (_, i) => notificacao(i + 1))

describe('sino de notificações', () => {
  beforeEach(() => jest.clearAllMocks())

  test('mostra o número de não lidas como texto e no rótulo, e abre a caixa', async () => {
    await renderizarTela(<SinoDeNotificacoes />, {
      rotas: { [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 3 } }) },
    })
    const sino = await screen.findByRole('button', { name: 'Notificações, 3 não lidas' })
    expect(screen.getByText('3', { includeHiddenElements: true })).toBeOnTheScreen()
    await fireEvent.press(sino)
    expect(router.push).toHaveBeenCalledWith('/caixa-de-notificacoes')
  })

  test('sem não lidas, nenhum selo; acima de 99, "99+" e o número inteiro no rótulo', async () => {
    let n = 0
    const { consultas } = await renderizarTela(<SinoDeNotificacoes />, {
      rotas: { [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: n } }) },
    })
    expect(await screen.findByRole('button', { name: 'Notificações' })).toBeOnTheScreen()
    expect(screen.queryByText('0', { includeHiddenElements: true })).toBeNull()

    n = 150
    await act(() => consultas.invalidateQueries())
    expect(
      await screen.findByRole('button', { name: 'Notificações, 150 não lidas' }),
    ).toBeOnTheScreen()
    expect(screen.getByText('99+', { includeHiddenElements: true })).toBeOnTheScreen()
  })

  test('uma não lida fica no singular', async () => {
    await renderizarTela(<SinoDeNotificacoes />, {
      rotas: { [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 1 } }) },
    })
    expect(
      await screen.findByRole('button', { name: 'Notificações, 1 não lida' }),
    ).toBeOnTheScreen()
  })

  test('o contador se atualiza sozinho a cada 60 s', async () => {
    let n = 2
    expect(INTERVALO_DO_CONTADOR).toBe(60_000)
    // O intervalo nasce com a consulta: o relógio falso precisa valer desde o começo.
    jest.useFakeTimers()
    try {
      const { servidor } = await renderizarTela(<SinoDeNotificacoes />, {
        rotas: { [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: n } }) },
      })
      expect(
        await screen.findByRole('button', { name: 'Notificações, 2 não lidas' }),
      ).toBeOnTheScreen()
      const antes = pedidosPara(servidor, 'GET', `${CAIXA}/nao-lidas`).length
      n = 5
      await act(async () => {
        await jest.advanceTimersByTimeAsync(INTERVALO_DO_CONTADOR + 10)
      })
      expect(
        await screen.findByRole('button', { name: 'Notificações, 5 não lidas' }),
      ).toBeOnTheScreen()
      expect(pedidosPara(servidor, 'GET', `${CAIXA}/nao-lidas`).length).toBeGreaterThan(antes)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('caixa de notificações', () => {
  beforeEach(() => jest.clearAllMocks())

  test('lista paginada: não lidas com "Nova", mais antigas pelo cursor, sem repetir', async () => {
    const segunda = [notificacao(21, { lida: true, lidaEm: new Date().toISOString() })]
    const { servidor } = await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 20 } }),
        [`GET ${CAIXA}`]: (p) =>
          p.url.includes('cursor=c%2B1')
            ? { status: 200, corpo: { notificacoes: segunda, proximoCursor: null } }
            : { status: 200, corpo: { notificacoes: vinte, proximoCursor: 'c+1' } },
      },
    })

    expect(await screen.findByText('Nova escala 1')).toBeOnTheScreen()
    expect(screen.getByText('Hoje')).toBeOnTheScreen()
    expect(screen.getAllByTestId('ponto-de-nova', { includeHiddenElements: true })).toHaveLength(20)
    expect(
      screen.getByRole('button', { name: /^Nova\. Nova escala 1\. Você foi escalado/ }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Você tem 20 não lidas.')).toBeOnTheScreen()

    // Rolar até o fim pede a próxima página com o cursor da anterior.
    await fireEvent(screen.getByTestId('lista-de-notificacoes'), 'onEndReached')
    expect(await screen.findByText('Nova escala 21')).toBeOnTheScreen()
    const pedidos = pedidosPara(servidor, 'GET', CAIXA)
    expect(pedidos.map((p) => p.url.split('?')[1] ?? '')).toEqual(['', 'cursor=c%2B1'])
    // A lida não tem "Nova" e não tem ponto.
    expect(
      screen.getByRole('button', { name: /^Nova escala 21\. Você foi escalado/ }),
    ).toBeOnTheScreen()
    expect(screen.getAllByTestId('ponto-de-nova', { includeHiddenElements: true })).toHaveLength(20)
    expect(screen.getByText('As notificações ficam aqui por 30 dias.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Mostrar mais antigas' })).toBeNull()
  })

  test('"Mostrar mais antigas" carrega a próxima página sem precisar rolar', async () => {
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 0 } }),
        [`GET ${CAIXA}`]: (p) =>
          p.url.includes('cursor=')
            ? {
                status: 200,
                corpo: { notificacoes: [notificacao(30, { lida: true })], proximoCursor: null },
              }
            : {
                status: 200,
                corpo: {
                  notificacoes: [notificacao(1, { lida: true })],
                  proximoCursor: 'proximo',
                },
              },
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: 'Mostrar mais antigas' }))
    expect(await screen.findByText('Nova escala 30')).toBeOnTheScreen()
  })

  test('tocar marca como lida, baixa o contador e abre o destino', async () => {
    const aviso = notificacao(1, {
      tipo: 'avisos',
      titulo: 'Novo aviso',
      texto: 'Há um aviso novo na sua comunidade. Abra o app para ler.',
      destino: { tela: 'aviso', avisoId: 'aviso-1' },
    })
    let naoLidas = 1
    const { servidor, consultas } = await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas } }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: { notificacoes: [aviso], proximoCursor: null },
        }),
        [`POST ${CAIXA}/n-001/lida`]: () => {
          naoLidas = 0
          return { status: 200, corpo: { ok: true } }
        },
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: /^Nova\. Novo aviso\./ }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/avisos/[avisoId]',
        params: { avisoId: 'aviso-1' },
      }),
    )
    expect(pedidosPara(servidor, 'POST', `${CAIXA}/n-001/lida`)).toHaveLength(1)
    await waitFor(() =>
      expect(screen.queryByTestId('ponto-de-nova', { includeHiddenElements: true })).toBeNull(),
    )
    await waitFor(() =>
      expect(consultas.getQueryData(['eu', 'caixa', 'nao-lidas'])).toEqual({ naoLidas: 0 }),
    )
  })

  test('alvo que não existe mais: marca como lida e não navega', async () => {
    const { servidor } = await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 1 } }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: {
            notificacoes: [notificacao(1, { tipo: 'eventos', destino: null })],
            proximoCursor: null,
          },
        }),
        [`POST ${CAIXA}/n-001/lida`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: /^Nova\. Nova escala 1/ }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAIXA}/n-001/lida`)).toHaveLength(1),
    )
    expect(router.push).not.toHaveBeenCalled()
  })

  test('"Marcar todas como lidas" chama a API e tira as marcas', async () => {
    let naoLidas = 2
    const { servidor } = await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas } }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: { notificacoes: [notificacao(1), notificacao(2)], proximoCursor: null },
        }),
        [`POST ${CAIXA}/lidas`]: () => {
          naoLidas = 0
          return { status: 200, corpo: { marcadas: 2 } }
        },
      },
    })
    expect(
      await screen.findAllByTestId('ponto-de-nova', { includeHiddenElements: true }),
    ).toHaveLength(2)
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar todas como lidas' }))
    await waitFor(() =>
      expect(screen.queryByTestId('ponto-de-nova', { includeHiddenElements: true })).toBeNull(),
    )
    expect(pedidosPara(servidor, 'POST', `${CAIXA}/lidas`)).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Marcar todas como lidas' })).toBeNull()
  })

  test('vazia: mensagem humana e atalho para as preferências', async () => {
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 0 } }),
        [`GET ${CAIXA}`]: () => ({ status: 200, corpo: { notificacoes: [], proximoCursor: null } }),
      },
    })
    expect(await screen.findByText('Nada por aqui ainda')).toBeOnTheScreen()
    const atalhos = screen.getAllByRole('button', { name: 'Preferências de notificação' })
    // O ícone de ajustes no cabeçalho e a ação do estado vazio.
    expect(atalhos).toHaveLength(2)
    await fireEvent.press(atalhos[1]!)
    expect(router.push).toHaveBeenCalledWith('/notificacoes')
  })

  test('erro ao carregar: "Tentar de novo" busca outra vez', async () => {
    let falhar = true
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 0 } }),
        [`GET ${CAIXA}`]: () =>
          falhar
            ? { status: 500, corpo: { erro: 'interno', mensagem: 'Algo deu errado.' } }
            : {
                status: 200,
                corpo: { notificacoes: [notificacao(1)], proximoCursor: null },
              },
      },
    })
    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' })
    expect(screen.getByText('Não deu para carregar as notificações')).toBeOnTheScreen()
    falhar = false
    await fireEvent.press(tentar)
    expect(await screen.findByText('Nova escala 1')).toBeOnTheScreen()
  })
})

describe('agrupar por dia', () => {
  test('hoje, ontem e depois a data absoluta', () => {
    const agora = new Date(2026, 10, 15, 10, 0)
    const grupos = agruparPorDia(
      [
        notificacao(1, { criadoEm: new Date(2026, 10, 15, 9, 0).toISOString() }),
        notificacao(2, { criadoEm: new Date(2026, 10, 14, 23, 0).toISOString() }),
        notificacao(3, { criadoEm: new Date(2026, 10, 12, 8, 0).toISOString() }),
        notificacao(4, { criadoEm: new Date(2026, 10, 12, 7, 0).toISOString() }),
      ],
      agora,
    )
    expect(grupos.map((g) => [g.rotulo, g.itens.length])).toEqual([
      ['Hoje', 1],
      ['Ontem', 1],
      ['12/11/2026', 2],
    ])
  })
})
