import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { DIA_DO_INICIO, INICIO } from '@/testes/fixturas'
import { BASE, COMUNIDADE, pedidosPara, renderizarTela, respostaEu } from '@/testes/telas'
import { formatarDataPorExtenso } from '@/utilidades/datas'

import { TelaInicio } from '../TelaInicio'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
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

  test('confirmar a escala chama a API da própria atribuição', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: {
        [`GET ${BASE}/inicio`]: () => ({ status: 200, corpo: INICIO_CHEIO }),
        [`POST ${BASE}/atribuicoes/a1/confirmar`]: () => ({
          status: 200,
          corpo: { estado: 'confirmada' },
        }),
      },
    })

    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'Confirmar a escala em Sábado com a juventude, Louvor · responsável',
      }),
    )

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(1),
    )
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

    expect(await screen.findByText('Nenhum evento marcado')).toBeOnTheScreen()
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

    expect(await screen.findByText('Nenhum evento marcado')).toBeOnTheScreen()
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

  test('Criador: o destaque "Primeiros passos" cria a primeira comunidade e a Plataforma fica a um toque', async () => {
    await renderizarTela(<TelaInicio />, { rotas: { 'GET /api/v1/eu': eu(true) } })

    expect(await screen.findByText('Crie sua primeira comunidade')).toBeOnTheScreen()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Criar comunidade' }))
    expect(router.push).toHaveBeenCalledWith('/plataforma/nova')
    await usuario.press(screen.getByRole('button', { name: /^Plataforma/ }))
    expect(router.push).toHaveBeenCalledWith('/plataforma')
    // O versículo continua; não há status de sincronização sem comunidade.
    expect(screen.getByText('Versículo do dia')).toBeOnTheScreen()
  })

  test('membro: estado vazio com ação para colar o convite e a explicação', async () => {
    await renderizarTela(<TelaInicio />, { rotas: { 'GET /api/v1/eu': eu(false) } })

    expect(await screen.findByText('Você ainda não participa de uma comunidade')).toBeOnTheScreen()
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Colar link de convite' }))
    expect(router.push).toHaveBeenCalledWith('/entrar-com-convite')
    await usuario.press(screen.getByRole('button', { name: 'Como conseguir um convite' }))
    expect(router.push).toHaveBeenCalledWith('/como-conseguir-convite')
    expect(screen.queryByRole('button', { name: 'Criar comunidade' })).toBeNull()
  })

  test('várias comunidades e nenhuma escolhida: a lista escolhe direto', async () => {
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
    await renderizarTela(<TelaInicio />, { rotas: { 'GET /api/v1/eu': eu(false, comunidades) } })

    expect(
      await screen.findByRole('button', { name: /^Jovens Vila Nova, .*Escolher esta comunidade/ }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: /^Jovens Centro, .*Escolher esta comunidade/ }),
    ).toBeOnTheScreen()
  })
})
