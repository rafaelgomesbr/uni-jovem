import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { DIA_DO_INICIO, INICIO } from '@/testes/fixturas'
import { BASE, COMUNIDADE, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'
import { formatarDataPorExtenso } from '@/utilidades/datas'

import { TelaInicio } from '../TelaInicio'

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
// O diálogo de confirmação: o teste lê o que ele pergunta e responde.
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

// Um sábado à frente, 19:00 UTC = 16:00 em São Paulo.
const SABADO = INICIO

const INICIO_CHEIO = {
  proximosEventos: [
    {
      id: 'e1',
      titulo: 'Sábado com a juventude',
      categoria: 'Programação de sábado',
      inicio: SABADO,
      duracaoMin: 60,
      status: 'publicado',
      localNome: 'Salão',
      localTipo: 'interno',
    },
  ],
  minhasEscalas: [
    {
      id: 'a1',
      funcao: 'responsável',
      estado: 'pendente',
      eventoId: 'e1',
      eventoTitulo: 'Sábado com a juventude',
      eventoInicio: SABADO,
      etapaTitulo: 'Louvor',
    },
  ],
  minhasTarefas: [
    { id: 't1', titulo: 'Comprar o brinde', prazo: null, eventoId: 'e1', eventoTitulo: 'Sábado' },
  ],
  substituicoesAbertas: 2,
}

const INICIO_VAZIO = {
  proximosEventos: [],
  minhasEscalas: [],
  minhasTarefas: [],
  substituicoesAbertas: 0,
}

describe('tela Início', () => {
  beforeEach(() => jest.clearAllMocks())

  test('mostra eventos, escalas e tarefas reais, no horário da comunidade', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: { [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_CHEIO }) },
    })

    expect(
      await screen.findByRole('button', {
        name: `Sábado com a juventude, Publicado, ${formatarDataPorExtenso(DIA_DO_INICIO)}, às 16:00, duração de 1 h, local: Salão`,
      }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Louvor · responsável')).toBeOnTheScreen()
    expect(screen.getByRole('checkbox', { name: 'Comprar o brinde' })).toBeOnTheScreen()
    expect(
      screen.getByText('Há 2 pedidos de substituição que você pode assumir.'),
    ).toBeOnTheScreen()
  })

  test('"Você foi convocado": aceitar chama a API da própria atribuição e avisa', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: {
        [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_CHEIO }),
        [`POST ${BASE}/atribuicoes/a1/confirmar`]: () => ({
          status: 200,
          corpo: { estado: 'confirmada' },
        }),
      },
    })

    expect(await screen.findByText('Você foi convocado')).toBeOnTheScreen()
    await userEvent.setup().press(
      screen.getByRole('button', {
        name: 'Aceitar a convocação em Sábado com a juventude, Louvor · responsável',
      }),
    )

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(1),
    )
    expect(mostrarToast).toHaveBeenCalledWith({
      texto: 'Você aceitou. A organização já vê sua resposta.',
    })
  })

  test('"Não posso ir" pergunta antes, recusa a própria convocação e avisa', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: {
        [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_CHEIO }),
        [`POST ${BASE}/atribuicoes/a1/recusar`]: () => ({
          status: 200,
          corpo: { estado: 'recusada' },
        }),
      },
    })

    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'Não posso ir: avisar a organização sobre Sábado com a juventude, Louvor · responsável',
      }),
    )

    expect(jest.mocked(confirmar).mock.calls[0]![0]).toEqual({
      titulo: 'Avisar que você não pode ir?',
      mensagem: 'A organização recebe o aviso para chamar outra pessoa.',
      confirmar: 'Avisar que não posso',
      cancelar: 'Voltar',
      destrutivo: true,
    })
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(1),
    )
    expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Pronto. A organização foi avisada.' })
  })

  test('"Voltar" no diálogo não recusa nada', async () => {
    jest.mocked(confirmar).mockResolvedValueOnce(false)
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: { [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_CHEIO }) },
    })

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: /^Não posso ir: avisar a organização/ }))

    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(0)
  })

  test('concluir a própria tarefa manda só "concluida"', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: {
        [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_CHEIO }),
        [`PATCH ${BASE}/eventos/e1/tarefas/t1`]: () => ({ status: 200, corpo: { id: 't1' } }),
      },
    })

    await userEvent.setup().press(await screen.findByRole('checkbox', { name: 'Comprar o brinde' }))

    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', `${BASE}/eventos/e1/tarefas/t1`)[0]?.corpo).toEqual({
        concluida: true,
      }),
    )
  })

  test('vazio, para organizador: oferece o Sábado padrão', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: { [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_VAZIO }) },
    })

    expect(await screen.findByText('Nenhum encontro marcado')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Novo Sábado padrão' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/novo',
      params: { modelo: 'sabado_padrao' },
    })
    expect(screen.getByRole('button', { name: 'Informar minha disponibilidade' })).toBeOnTheScreen()
  })

  test('vazio, para membro: leva à agenda, sem criar', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_VAZIO }) },
    })

    expect(await screen.findByText('Nenhum encontro marcado')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Novo Sábado padrão' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Ver a agenda' }).length).toBeGreaterThan(0)
  })

  test('erro da API vira mensagem humana com "Tentar de novo"', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: {
        [`GET ${BASE}/inicio`]: () => ({
          status: 500,
          corpo: { erro: 'interno', mensagem: 'Algo deu errado do nosso lado. Tente de novo.' },
        }),
      },
    })

    expect(
      await screen.findByText('Algo deu errado do nosso lado. Tente de novo.'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('com inscrição próxima, mostra "Minhas inscrições" e abre o evento', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: {
        [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_CHEIO }),
        [`GET ${BASE}/inscricoes/eu`]: () => ({
          status: 200,
          corpo: {
            inscricoes: [
              {
                inscricaoId: 'i1',
                estado: 'confirmada',
                codigoCheckin: 'A1B2C3D4E5',
                criadaEm: '2026-11-10T12:00:00.000Z',
                presente: false,
                evento: {
                  id: 'e9',
                  titulo: 'Retiro de verão',
                  inicio: SABADO,
                  duracaoMin: 120,
                  fuso: 'America/Sao_Paulo',
                  status: 'publicado',
                  localNome: 'Sítio',
                },
              },
            ],
          },
        }),
      },
    })

    const linha = await screen.findByRole('button', {
      name: /^Retiro de verão, .*Inscrição confirmada/,
    })
    expect(screen.getByText('Inscrito')).toBeOnTheScreen()
    await userEvent.setup().press(linha)
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e9' },
    })
  })
})

describe('Início sem comunidade', () => {
  beforeEach(() => jest.clearAllMocks())

  function eu(criador: boolean, comunidades: unknown[] = []) {
    const base = respostaEu('membro')
    return () => ({
      status: 200,
      corpo: { ...base, conta: { ...base.conta, criador }, comunidades },
    })
  }

  test('Criador: o destaque "Para começar" cria a primeira comunidade (a Plataforma fica no Perfil)', async () => {
    await renderizarTela(<TelaInicio />, { rotas: { 'GET /api/v1/eu': eu(true) } })

    expect(await screen.findByText('Crie sua primeira comunidade')).toBeOnTheScreen()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Criar comunidade' }))
    expect(router.push).toHaveBeenCalledWith('/plataforma/nova')
    // D57: a Plataforma não se repete no Início; mora só no Perfil.
    expect(screen.queryByRole('button', { name: /^Plataforma/ })).toBeNull()
    // O versículo continua; não há status de sincronização sem comunidade.
    expect(screen.getByText('Versículo do dia')).toBeOnTheScreen()
  })

  test('conta sem comunidade: "Comece por aqui" com os três caminhos (ADR 0007)', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: {
        'GET /api/v1/eu': eu(false),
        'GET /api/v1/eu/pedidos': () => ({ status: 200, corpo: { pedidos: [] } }),
      },
    })

    expect(await screen.findByText('Comece por aqui')).toBeOnTheScreen()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Usar código ou convite' }))
    expect(router.push).toHaveBeenCalledWith('/tenho-um-codigo')
    await usuario.press(screen.getByRole('button', { name: 'Criar comunidade' }))
    expect(router.push).toHaveBeenCalledWith('/criar-comunidade')
    // Sem pedidos, a seção "Meus pedidos" não aparece.
    expect(screen.queryByText('Meus pedidos')).toBeNull()
    expect(screen.getByText('Versículo do dia')).toBeOnTheScreen()
  })

  describe('várias comunidades (D57: nunca abre com as abas vazias)', () => {
    const outra = '33333333-3333-4333-8333-333333333333'
    const comunidades = [
      {
        id: COMUNIDADE,
        nome: 'Jovens Centro',
        cor: '#5B4BDB',
        estado: 'ativa',
        papel: 'membro',
        designacoes: [],
      },
      {
        id: outra,
        nome: 'Jovens Vila Nova',
        cor: '#15803D',
        estado: 'ativa',
        papel: 'admin',
        designacoes: [],
      },
    ]
    const cofre = (jest.requireMock('expo-secure-store') as { __cofre: Map<string, string> })
      .__cofre
    afterEach(() => cofre.delete('uj.comunidadeAtiva.conta-eu'))

    test('nenhuma escolhida: entra direto na primeira, sem a lista de escolha', async () => {
      await renderizarTela(<TelaInicio />, {
        rotas: {
          'GET /api/v1/eu': eu(false, comunidades),
          [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_VAZIO }),
        },
      })
      expect(
        await screen.findByRole('button', { name: /^Comunidade Jovens Centro, Membro/ }),
      ).toBeOnTheScreen()
      expect(screen.queryByText('Suas comunidades')).toBeNull()
    })

    test('com a última usada guardada, abre nela', async () => {
      cofre.set('uj.comunidadeAtiva.conta-eu', outra)
      await renderizarTela(<TelaInicio />, {
        rotas: {
          'GET /api/v1/eu': eu(false, comunidades),
          [`GET /api/v1/c/${outra}/inicio`]: () => ({ status: 200, corpo: INICIO_VAZIO }),
        },
      })
      expect(
        await screen.findByRole('button', { name: /^Comunidade Jovens Vila Nova, Administrador/ }),
      ).toBeOnTheScreen()
    })
  })
})
