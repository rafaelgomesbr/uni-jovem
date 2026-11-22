import { act, fireEvent, screen, userEvent } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'

import { BASE, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { reiniciarAcordeoesDaSessao } from '@/ui/Acordeao'

import { TelaComunidade } from '../TelaComunidade'

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

const DOIS_DIAS = 2 * 24 * 60 * 60 * 1000

function mural(sobre: Record<string, unknown> = {}) {
  return () => ({
    status: 200,
    corpo: {
      avisos: {
        total: 4,
        destaque: {
          id: 'av1',
          titulo: 'Ensaio do louvor às 15h',
          fixado: true,
          publicadoEm: new Date(Date.now() - DOIS_DIAS).toISOString(),
        },
      },
      oracao: { novos: 3 },
      pessoas: { total: 15 },
      organizacao: null,
      ...sobre,
    },
  })
}

const NO_LOUVOR = () => ({
  status: 200,
  corpo: {
    escalas: [
      {
        id: 'a1',
        funcao: 'Violão',
        estado: 'confirmada',
        eventoId: 'e1',
        eventoTitulo: 'Sábado',
        eventoInicio: '2026-11-28T19:00:00.000Z',
        eventoStatus: 'publicado',
        etapaTitulo: 'Louvor',
        substituicaoAberta: null,
      },
    ],
  },
})

const OUTRA_FUNCAO = () => ({
  status: 200,
  corpo: {
    escalas: [
      {
        id: 'a2',
        funcao: 'Recepção',
        estado: 'confirmada',
        eventoId: 'e1',
        eventoTitulo: 'Sábado',
        eventoInicio: '2026-11-28T19:00:00.000Z',
        eventoStatus: 'publicado',
        etapaTitulo: 'Boas-vindas',
        substituicaoAberta: null,
      },
    ],
  },
})

beforeEach(() => {
  jest.clearAllMocks()
  reiniciarAcordeoesDaSessao()
  jest.mocked(useLocalSearchParams).mockReturnValue({})
  onlineManager.setOnline(true)
})

describe('a aba Comunidade é um mural curto (D70)', () => {
  test('membro: duas ações rápidas, o aviso fixado com título, só o número de pedidos novos e as pessoas', async () => {
    const { servidor } = await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: mural() },
    })
    const usuario = userEvent.setup()

    // O aviso à vista tem o título (não só um atalho) e a data relativa em palavras.
    expect(await screen.findByText('Fixado: Ensaio do louvor às 15h')).toBeOnTheScreen()
    expect(screen.getByText('há 2 dias')).toBeOnTheScreen()
    expect(screen.getByText('15 pessoas')).toBeOnTheScreen()

    // As duas ações do membro; nada da organização.
    await usuario.press(screen.getByRole('button', { name: 'Pedir oração' }))
    expect(router.push).toHaveBeenLastCalledWith('/oracao/novo')
    await usuario.press(screen.getByRole('button', { name: 'Sugerir uma ideia' }))
    expect(router.push).toHaveBeenLastCalledWith('/sugestoes/nova')
    expect(screen.queryByRole('button', { name: 'Novo aviso' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Convidar' })).toBeNull()

    // Pedidos de oração: o número em texto, nunca o texto de um pedido; a lista nem é pedida aqui.
    expect(screen.getByText('3 novos')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Pedidos de oração. 3 novos' }))
    expect(router.push).toHaveBeenLastCalledWith('/oracao')
    expect(pedidosPara(servidor, 'GET', `${BASE}/oracao`)).toHaveLength(0)

    await usuario.press(screen.getByRole('button', { name: 'Pessoas. 15 pessoas' }))
    expect(router.push).toHaveBeenLastCalledWith('/pessoas')
    await usuario.press(screen.getByRole('button', { name: 'Ver todos os avisos, 4' }))
    expect(router.push).toHaveBeenLastCalledWith('/avisos')
    await usuario.press(screen.getByRole('button', { name: /^Aviso fixado: Ensaio do louvor/ }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/avisos/[avisoId]',
      params: { avisoId: 'av1' },
    })
  })

  test('"Mais" tem Biblioteca e Sugestões; "Conteúdos" não existe mais no texto', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: mural() },
    })
    const usuario = userEvent.setup()
    await screen.findByText('Fixado: Ensaio do louvor às 15h')
    expect(screen.queryByText('Conteúdos')).toBeNull()
    await usuario.press(screen.getByRole('button', { name: /^Biblioteca[.]/ }))
    expect(router.push).toHaveBeenLastCalledWith('/conteudos')
    await usuario.press(screen.getByRole('button', { name: /^Sugestões[.]/ }))
    expect(router.push).toHaveBeenLastCalledWith('/sugestoes')
  })

  test('sem duplicações: cada destino aparece uma vez só, para o membro e para a administração', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'admin',
      rotas: {
        [`GET ${BASE}/mural`]: mural({ organizacao: { pedidosDeEntrada: 2 } }),
        'GET /api/v1/eu': () => {
          const base = respostaEu('admin')
          return { status: 200, corpo: { ...base, conta: { ...base.conta, criador: true } } }
        },
      },
    })
    await userEvent.setup().press(await screen.findByRole('button', { name: /^Organização/ }))
    for (const nome of [
      /^Biblioteca[.]/,
      /^Sugestões[.]/,
      /^Relatórios[.]/,
      /^Configurações[.]/,
      /^Código da comunidade[.]/,
      /^Pedidos de oração/,
      /^Pessoas[.]/,
    ]) {
      expect(screen.getAllByRole('button', { name: nome })).toHaveLength(1)
    }
    // A Plataforma do Criador é do Perfil.
    expect(screen.queryByRole('button', { name: /^Plataforma/ })).toBeNull()
    // "Sair da comunidade" mora na folha "Comunidades" do Perfil.
    expect(screen.queryByRole('button', { name: /^Sair de/ })).toBeNull()
  })
})

describe('Louvor é de toda a comunidade (D73: o repertório e a banda são de todos)', () => {
  test('o membro que toca vê, com a descrição do repertório e da banda', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/mural`]: mural(),
        [`GET ${BASE}/minhas-escalas`]: NO_LOUVOR,
      },
    })
    const louvor = await screen.findByRole('button', { name: /^Louvor[.]/ })
    expect(screen.getByText('Repertório do encontro e quem toca.')).toBeOnTheScreen()
    await userEvent.setup().press(louvor)
    expect(router.push).toHaveBeenLastCalledWith('/louvor')
  })

  test('quem foi convocado a outra função também vê: não precisa tocar para ler o repertório', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/mural`]: mural(),
        [`GET ${BASE}/minhas-escalas`]: OUTRA_FUNCAO,
      },
    })
    expect(await screen.findByRole('button', { name: /^Louvor[.]/ })).toBeOnTheScreen()
  })

  test('membro sem nenhuma convocação vê, e a lista de convocações nem é pedida', async () => {
    const { servidor } = await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: mural() },
    })
    expect(await screen.findByRole('button', { name: /^Louvor[.]/ })).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', `${BASE}/minhas-escalas`)).toHaveLength(0)
  })

  test('quem organiza vê', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'organizador',
      rotas: { [`GET ${BASE}/mural`]: mural({ organizacao: { pedidosDeEntrada: 0 } }) },
    })
    expect(await screen.findByRole('button', { name: /^Louvor[.]/ })).toBeOnTheScreen()
  })
})

describe('Organização, dobrada, só para quem organiza', () => {
  test('o membro não vê Organização', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: mural() },
    })
    await screen.findByText('Fixado: Ensaio do louvor às 15h')
    expect(screen.queryByRole('button', { name: /^Organização/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Relatórios[.]/ })).toBeNull()
  })

  test('o organizador: fechada por padrão, abre com um toque e leva a Relatórios, Locais e Modelos', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'organizador',
      rotas: { [`GET ${BASE}/mural`]: mural({ organizacao: { pedidosDeEntrada: 2 } }) },
    })
    const usuario = userEvent.setup()
    const organizacao = await screen.findByRole('button', {
      name: 'Organização, 2 pedidos de entrada. Recolhido, toque para ver.',
    })
    // Fechada: o número de pedidos já está em texto, mas as linhas não.
    expect(screen.getByText('2 pedidos')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Relatórios[.]/ })).toBeNull()
    await usuario.press(organizacao)
    for (const [nome, rota] of [
      ['Relatórios', '/relatorios'],
      ['Locais', '/locais'],
      ['Modelos', '/modelos'],
    ] as const) {
      await usuario.press(await screen.findByRole('button', { name: new RegExp(`^${nome}[.]`) }))
      expect(router.push).toHaveBeenLastCalledWith(rota)
    }
    // Denúncias, Configurações e código são da administração.
    expect(screen.queryByRole('button', { name: /^Denúncias[.]/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Configurações[.]/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Código da comunidade[.]/ })).toBeNull()
  })

  test('o administrador: Configurações, código, denúncias e pedidos de entrada e convites', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'admin',
      rotas: { [`GET ${BASE}/mural`]: mural({ organizacao: { pedidosDeEntrada: 1 } }) },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: /^Organização/ }))
    await usuario.press(await screen.findByRole('button', { name: /^Configurações[.]/ }))
    expect(router.push).toHaveBeenLastCalledWith('/configurar-comunidade')
    await usuario.press(screen.getByRole('button', { name: /^Código da comunidade[.]/ }))
    expect(router.push).toHaveBeenLastCalledWith('/codigo-da-comunidade')
    await usuario.press(screen.getByRole('button', { name: /^Denúncias[.]/ }))
    expect(router.push).toHaveBeenLastCalledWith('/denuncias')
    await usuario.press(
      screen.getByRole('button', { name: 'Pedidos de entrada e convites. 1 pedido esperando' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/pedidos-de-entrada')
  })
})

describe('Limpar próximos encontros na Organização (D77)', () => {
  test.each(['organizador', 'admin'] as const)(
    '%s: o atalho leva à tela de limpeza, que é da Organização e vem dobrado',
    async (papel) => {
      await renderizarTela(<TelaComunidade />, {
        papel,
        rotas: { [`GET ${BASE}/mural`]: mural({ organizacao: { pedidosDeEntrada: 0 } }) },
      })
      const usuario = userEvent.setup()
      await usuario.press(await screen.findByRole('button', { name: /^Organização/ }))
      await usuario.press(
        await screen.findByRole('button', { name: /^Limpar próximos encontros[.]/ }),
      )
      expect(router.push).toHaveBeenLastCalledWith('/limpar-proximos-encontros')
    },
  )

  test('o membro não vê o atalho nem a Organização', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: mural() },
    })
    await screen.findByText('Pessoas')
    expect(screen.queryByRole('button', { name: /Limpar próximos encontros/ })).toBeNull()
  })
})

describe('ações rápidas por papel', () => {
  test('administração: "Novo aviso" e "Convidar"', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'admin',
      rotas: { [`GET ${BASE}/mural`]: mural({ organizacao: { pedidosDeEntrada: 0 } }) },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Novo aviso' }))
    expect(router.push).toHaveBeenLastCalledWith('/avisos/novo')
    await usuario.press(screen.getByRole('button', { name: 'Convidar' }))
    expect(router.push).toHaveBeenLastCalledWith('/convidar')
    expect(screen.queryByRole('button', { name: 'Pedir oração' })).toBeNull()
  })

  test('organizador não convida (só a administração cria convite): o par se completa com "Pedir oração"', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'organizador',
      rotas: { [`GET ${BASE}/mural`]: mural({ organizacao: { pedidosDeEntrada: 0 } }) },
    })
    expect(await screen.findByRole('button', { name: 'Novo aviso' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Pedir oração' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Convidar' })).toBeNull()
  })
})

describe('estados', () => {
  test('vazio de avisos: o membro lê o que vai acontecer; o organizador, "Escreva o primeiro aviso." sem botão repetido', async () => {
    const vazio = mural({ avisos: { total: 0, destaque: null } })
    const membro = await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: vazio },
    })
    expect(await screen.findByText('Nenhum aviso por enquanto.')).toBeOnTheScreen()
    expect(screen.getByText('Os avisos da liderança aparecem aqui.')).toBeOnTheScreen()
    await membro.unmount()

    await renderizarTela(<TelaComunidade />, {
      papel: 'organizador',
      rotas: {
        [`GET ${BASE}/mural`]: mural({
          avisos: { total: 0, destaque: null },
          organizacao: { pedidosDeEntrada: 0 },
        }),
      },
    })
    expect(await screen.findByText('Escreva o primeiro aviso.')).toBeOnTheScreen()
    // "Novo aviso" já é a ação rápida do topo: um botão só.
    expect(screen.getAllByRole('button', { name: 'Novo aviso' })).toHaveLength(1)
  })

  test('erro: texto humano e "Tentar de novo" busca de novo; as ações e "Mais" continuam à mão', async () => {
    let chamadas = 0
    const { servidor } = await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/mural`]: () => {
          chamadas += 1
          return chamadas === 1
            ? { status: 500, corpo: { codigo: 'erro_interno', mensagem: 'falha' } }
            : mural()()
        },
      },
    })
    expect(await screen.findByText('Não deu para carregar a comunidade')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Pedir oração' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Biblioteca[.]/ })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Fixado: Ensaio do louvor às 15h')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', `${BASE}/mural`).length).toBeGreaterThanOrEqual(2)
  })

  test('sem internet: mostra a última versão, avisa e desabilita as ações com o motivo escrito', async () => {
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: mural() },
    })
    await screen.findByText('Fixado: Ensaio do louvor às 15h')
    await act(async () => onlineManager.setOnline(false))

    expect(await screen.findByText('Sem internet')).toBeOnTheScreen()
    expect(screen.getByText('Fixado: Ensaio do louvor às 15h')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Pedir oração' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sugerir uma ideia' })).toBeDisabled()
    expect(
      screen.getByText('Precisa de internet para publicar. O texto não é guardado no aparelho.'),
    ).toBeOnTheScreen()
    // Ler continua: o aviso e as pessoas abrem.
    expect(screen.getByRole('button', { name: 'Pessoas. 15 pessoas' })).toBeEnabled()
  })
})

describe('toque na notificação de pedido de entrada', () => {
  test('quem decide pedidos vai para a tela deles, uma vez, e o parâmetro é limpo', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ segmento: 'pedidos' })
    await renderizarTela(<TelaComunidade />, {
      papel: 'admin',
      rotas: { [`GET ${BASE}/mural`]: mural({ organizacao: { pedidosDeEntrada: 1 } }) },
    })
    await screen.findByText('Fixado: Ensaio do louvor às 15h')
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/pedidos-de-entrada',
      params: { segmento: 'pedidos' },
    })
    expect(router.setParams).toHaveBeenCalledWith({ segmento: undefined })
    expect(jest.mocked(router.push).mock.calls.filter(([a]) => typeof a === 'object')).toHaveLength(
      1,
    )
  })

  test('o membro não é levado a lugar nenhum', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ segmento: 'pedidos' })
    await renderizarTela(<TelaComunidade />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/mural`]: mural() },
    })
    await screen.findByText('Fixado: Ensaio do louvor às 15h')
    expect(router.push).not.toHaveBeenCalled()
  })
})
