import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'

import {
  INTERVALO_DO_CONTADOR,
  agruparPorLeitura,
  destinoDaNotificacao,
  resumoPorTipo,
  rotaDoDestino,
  tempoRelativo,
  type NotificacaoDaCaixa,
} from '../caixa'
import { SinoDeNotificacoes } from '../SinoDeNotificacoes'
import { TelaCaixaDeNotificacoes } from '../TelaCaixaDeNotificacoes'

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

/** Uma convocação, com o título real do encontro (`assunto`, D66) e o id dele. */
function notificacao(i: number, parcial: Partial<NotificacaoDaCaixa> = {}): NotificacaoDaCaixa {
  return {
    id: `n-${String(i).padStart(3, '0')}`,
    tipo: 'escalas',
    titulo: `Nova convocação ${i}`,
    texto: 'Você foi convocado para servir. Abra o app para responder.',
    comunidade: { id: COMUNIDADE, nome: 'Jovens Centro' },
    destino: { tela: 'escalas' },
    assunto: 'Sábado Jovem',
    eventoId: 'e1',
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

  test('o sino traz a palavra "Notificações" ao lado do ícone, menos no cabeçalho compacto (D75)', async () => {
    await renderizarTela(
      <>
        <SinoDeNotificacoes />
        <SinoDeNotificacoes comTexto={false} />
      </>,
      { rotas: { [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 0 } }) } },
    )
    await screen.findAllByRole('button', { name: 'Notificações' })
    // Um só texto visível: o do sino com palavra (o compacto fica só com o ícone).
    expect(screen.getAllByText('Notificações', { includeHiddenElements: true })).toHaveLength(1)
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

describe('caixa de notificações (o sino, D68)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('o título real (assunto) aparece na linha, em "Novas", com "Nova" escrito, e a contagem por tipo', async () => {
    const aviso = notificacao(2, {
      tipo: 'avisos',
      titulo: 'Novo aviso em Jovens Centro',
      texto: 'Toque para ler.',
      assunto: 'Ensaio do louvor às 15h',
      eventoId: null,
      destino: { tela: 'aviso', avisoId: 'aviso-1' },
    })
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({
          status: 200,
          corpo: { naoLidas: 2, avisos: 1, convocacoes: 1, pedidosDeEntrada: 0 },
        }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: { notificacoes: [notificacao(1), aviso], proximoCursor: null },
        }),
      },
    })

    expect(await screen.findByText(/há .+ · Ensaio do louvor às 15h$/)).toBeOnTheScreen()
    // O título real no lugar do texto genérico da notificação do sistema.
    expect(screen.getByText(/há .+ · Sábado Jovem$/)).toBeOnTheScreen()
    expect(screen.queryByText('Toque para ler.')).toBeNull()
    expect(screen.getByText('Novas')).toBeOnTheScreen()
    expect(screen.queryByText('Antes')).toBeNull()
    expect(screen.getAllByText('Nova')).toHaveLength(2)
    // A contagem por tipo, em palavras.
    expect(await screen.findByText('1 aviso novo')).toBeOnTheScreen()
    expect(screen.getByText('1 convocação nova')).toBeOnTheScreen()
    expect(screen.getByText('Você tem 2 não lidas.')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', {
        name: /^Nova\. Novo aviso em Jovens Centro\. Ensaio do louvor às 15h\. Jovens Centro, há 2 min\.$/,
      }),
    ).toBeOnTheScreen()
  })

  test('"Novas" em cima e "Antes" embaixo; lidas não têm a marca "Nova"', async () => {
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 1 } }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: {
            notificacoes: [notificacao(1, { lida: true }), notificacao(2)],
            proximoCursor: null,
          },
        }),
      },
    })
    await screen.findByText('Novas')
    // A ordem da tela: "Novas" primeiro, "Antes" depois.
    expect(screen.getAllByText(/^(Novas|Antes)$/).map((t) => t.props.children)).toEqual([
      'Novas',
      'Antes',
    ])
    expect(screen.getAllByText('Nova')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: /^Nova convocação 1\. Sábado Jovem\./ }),
    ).toBeOnTheScreen()
  })

  test('sem assunto (pedido de entrada, aviso fora do ar): vale o texto genérico', async () => {
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 1 } }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: {
            notificacoes: [
              notificacao(1, {
                tipo: 'pedido_de_entrada',
                titulo: 'Pedido de entrada',
                texto: 'Uma pessoa quer entrar em Jovens Centro.',
                assunto: null,
                eventoId: null,
                destino: null,
              }),
            ],
            proximoCursor: null,
          },
        }),
      },
    })
    expect(
      await screen.findByText(/há .+ · Uma pessoa quer entrar em Jovens Centro.$/),
    ).toBeOnTheScreen()
  })

  test('uma convocação abre o encontro (a linha "Sua parte"), marca como lida e baixa o contador', async () => {
    let naoLidas = 1
    const { servidor, consultas } = await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({
          status: 200,
          corpo: { naoLidas, avisos: 0, convocacoes: naoLidas, pedidosDeEntrada: 0 },
        }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: { notificacoes: [notificacao(1)], proximoCursor: null },
        }),
        [`POST ${CAIXA}/n-001/lida`]: () => {
          naoLidas = 0
          return { status: 200, corpo: { ok: true } }
        },
      },
    })
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Nova\. Nova convocação 1\./ }),
    )
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]',
        params: { eventoId: 'e1' },
      }),
    )
    expect(pedidosPara(servidor, 'POST', `${CAIXA}/n-001/lida`)).toHaveLength(1)
    await waitFor(() => expect(screen.queryByText('Nova')).toBeNull())
    await waitFor(() =>
      expect(consultas.getQueryData(['eu', 'caixa', 'nao-lidas'])).toMatchObject({ naoLidas: 0 }),
    )
  })

  test('um aviso abre o aviso', async () => {
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 1 } }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: {
            notificacoes: [
              notificacao(1, {
                tipo: 'avisos',
                titulo: 'Novo aviso',
                assunto: 'Ensaio do louvor às 15h',
                eventoId: null,
                destino: { tela: 'aviso', avisoId: 'aviso-1' },
              }),
            ],
            proximoCursor: null,
          },
        }),
        [`POST ${CAIXA}/n-001/lida`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: /^Nova\. Novo aviso\./ }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/avisos/[avisoId]',
        params: { avisoId: 'aviso-1' },
      }),
    )
  })

  test('lista paginada: mais antigas pelo cursor, sem repetir', async () => {
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
    expect(await screen.findByText('Nova convocação 1')).toBeOnTheScreen()
    expect(screen.getAllByText('Nova')).toHaveLength(20)

    // Rolar até o fim pede a próxima página com o cursor da anterior.
    await fireEvent(screen.getByTestId('lista-de-notificacoes'), 'onEndReached')
    expect(await screen.findByText('Nova convocação 21')).toBeOnTheScreen()
    expect(screen.getByText('Antes')).toBeOnTheScreen()
    const pedidos = pedidosPara(servidor, 'GET', CAIXA)
    expect(pedidos.map((p) => p.url.split('?')[1] ?? '')).toEqual(['', 'cursor=c%2B1'])
    expect(screen.getAllByText('Nova')).toHaveLength(20)
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
    expect(await screen.findByText('Nova convocação 30')).toBeOnTheScreen()
  })

  test('alvo que não existe mais: marca como lida e não navega', async () => {
    const { servidor } = await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 1 } }),
        [`GET ${CAIXA}`]: () => ({
          status: 200,
          corpo: {
            notificacoes: [notificacao(1, { tipo: 'eventos', destino: null, eventoId: null })],
            proximoCursor: null,
          },
        }),
        [`POST ${CAIXA}/n-001/lida`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    await fireEvent.press(await screen.findByRole('button', { name: /^Nova\. Nova convocação 1/ }))
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
    expect(await screen.findAllByText('Nova')).toHaveLength(2)
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar todas como lidas' }))
    await waitFor(() => expect(screen.queryByText('Nova')).toBeNull())
    expect(pedidosPara(servidor, 'POST', `${CAIXA}/lidas`)).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Marcar todas como lidas' })).toBeNull()
  })

  test('vazia: "Nenhuma novidade." com o sol, sem botão', async () => {
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 0 } }),
        [`GET ${CAIXA}`]: () => ({ status: 200, corpo: { notificacoes: [], proximoCursor: null } }),
      },
    })
    expect(await screen.findByText('Nenhuma novidade.')).toBeOnTheScreen()
    expect(screen.getByText('Avisos, convocações e lembretes aparecem aqui.')).toBeOnTheScreen()
    // Os ajustes abrem pelo ícone do cabeçalho.
    await fireEvent.press(screen.getByRole('button', { name: 'Ajustes: quando o app me avisa' }))
    expect(router.push).toHaveBeenCalledWith('/notificacoes')
  })

  test('carregando: o esqueleto tem rótulo para o leitor de tela', async () => {
    await renderizarTela(<TelaCaixaDeNotificacoes />, {
      rotas: {
        [NAO_LIDAS]: () => ({ status: 200, corpo: { naoLidas: 0 } }),
        [`GET ${CAIXA}`]: () => new Promise(() => undefined),
      },
    })
    expect(await screen.findByLabelText('Carregando as notificações')).toBeOnTheScreen()
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
    expect(screen.getByText('Não deu para carregar as notificações.')).toBeOnTheScreen()
    falhar = false
    await fireEvent.press(tentar)
    expect(await screen.findByText('Nova convocação 1')).toBeOnTheScreen()
  })
})

describe('regras da caixa', () => {
  test('novas e antes: cada grupo na ordem que a API mandou', () => {
    const { novas, antes } = agruparPorLeitura([
      notificacao(1, { lida: true }),
      notificacao(2),
      notificacao(3, { lida: true }),
      notificacao(4),
    ])
    expect(novas.map((n) => n.id)).toEqual(['n-002', 'n-004'])
    expect(antes.map((n) => n.id)).toEqual(['n-001', 'n-003'])
  })

  test('o tempo em palavras: agora, minutos, horas, dias e, passada uma semana, a data', () => {
    const agora = new Date(2026, 10, 22, 12, 0)
    const antes = (ms: number) => new Date(agora.getTime() - ms).toISOString()
    expect(tempoRelativo(antes(20_000), agora)).toBe('agora')
    expect(tempoRelativo(antes(5 * 60_000), agora)).toBe('há 5 min')
    expect(tempoRelativo(antes(3 * 3_600_000), agora)).toBe('há 3 h')
    expect(tempoRelativo(antes(86_400_000 + 3_600_000), agora)).toBe('há 1 dia')
    expect(tempoRelativo(antes(3 * 86_400_000), agora)).toBe('há 3 dias')
    expect(tempoRelativo(antes(10 * 86_400_000), agora)).toBe('12/11/2026')
  })

  test('a contagem por tipo: singular, plural, o que sobra e nenhum zero', () => {
    expect(
      resumoPorTipo({ naoLidas: 9, avisos: 4, convocacoes: 1, pedidosDeEntrada: 2 }).map(
        (t) => t.texto,
      ),
    ).toEqual([
      '4 avisos novos',
      '1 convocação nova',
      '2 pedidos de entrada novos',
      '2 outras novas',
    ])
    expect(
      resumoPorTipo({ naoLidas: 1, avisos: 1, convocacoes: 0, pedidosDeEntrada: 0 }).map(
        (t) => t.texto,
      ),
    ).toEqual(['1 aviso novo'])
    expect(resumoPorTipo({ naoLidas: 3 }).map((t) => t.texto)).toEqual(['3 outras novas'])
    expect(resumoPorTipo(undefined)).toEqual([])
  })

  test('o destino: a convocação com encontro abre o encontro; sem ele, a Agenda "Só o que é meu"', () => {
    expect(destinoDaNotificacao(notificacao(1))).toEqual({ tela: 'evento', eventoId: 'e1' })
    const semEncontro = destinoDaNotificacao(notificacao(1, { eventoId: null }))
    expect(rotaDoDestino(semEncontro)).toEqual({
      pathname: '/agenda',
      params: { vista: 'lista', filtro: 'meu' },
    })
    expect(rotaDoDestino({ tela: 'aviso', avisoId: 'x' })).toEqual({
      pathname: '/avisos/[avisoId]',
      params: { avisoId: 'x' },
    })
  })
})
