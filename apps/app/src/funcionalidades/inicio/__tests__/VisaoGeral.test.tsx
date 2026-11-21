import { screen, userEvent } from '@testing-library/react-native'
import { versiculoDoDia } from '@uj/conteudo'
import { router } from 'expo-router'

import { INICIO } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { reiniciarVersiculoDaSessao } from '../../versiculo/CartaoDoVersiculo'
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

const INICIO_VAZIO = {
  proximosEventos: [],
  minhasEscalas: [],
  minhasTarefas: [],
  substituicoesAbertas: 0,
}

const MINHA = {
  escopo: 'minha',
  convocacoesParaResponder: 2,
  convocacoesProximas: 1,
  tarefasAbertas: 3,
  inscricoes: 1,
  presenca30dias: { presentes: 2, encontros: 3 },
  oracoesAtivas: 1,
}

const DA_COMUNIDADE = {
  escopo: 'comunidade',
  pessoasAtivas: 12,
  proximosEncontros: [
    {
      id: 'e1',
      titulo: 'Sábado com a juventude',
      inicio: INICIO,
      fuso: 'America/Sao_Paulo',
      convocados: 5,
      semResposta: 3,
      recusadas: 1,
    },
    {
      id: 'e2',
      titulo: 'Luau',
      inicio: INICIO,
      fuso: 'America/Sao_Paulo',
      convocados: 2,
      semResposta: 0,
      recusadas: 0,
    },
  ],
  convocacoes: { semResposta: 3, recusadas: 1 },
  pedidosDeEntrada: 2,
  denunciasAbertas: 4,
  presencaMedia: { encontros: 5, media: 18.5 },
  tarefasAtrasadas: 2,
}

const ok = (corpo: unknown) => () => ({ status: 200, corpo })
const rotasDeBase = (minha: unknown = MINHA, inicio: unknown = INICIO_VAZIO) => ({
  [`GET ${BASE}/inicio`]: ok(inicio),
  [`GET ${BASE}/visao-geral?escopo=minha`]: ok(minha),
})

beforeEach(() => {
  jest.clearAllMocks()
  reiniciarVersiculoDaSessao()
})

describe('versículo do dia no Início', () => {
  test('aparece recolhido; tocar mostra o texto e a tradução, tocar de novo recolhe', async () => {
    const v = versiculoDoDia(new Date())
    await renderizarTela(<TelaInicio />, { rotas: rotasDeBase() })

    const botao = await screen.findByRole('button', {
      name: `Versículo do dia, ${v.referencia}. Mostrar texto`,
    })
    expect(botao).toBeCollapsed()
    await screen.findByText('Seu resumo')
    // Minimizado: o rótulo e a referência, sem o texto nem a tradução.
    expect(screen.getByText('Versículo do dia')).toBeOnTheScreen()
    expect(screen.getByText(v.referencia)).toBeOnTheScreen()
    expect(screen.queryByText(v.texto)).toBeNull()
    expect(screen.queryByText(/BLIVRE/)).toBeNull()

    const usuario = userEvent.setup()
    await usuario.press(botao)

    expect(screen.getByText(v.texto)).toBeOnTheScreen()
    expect(screen.getByText(`${v.referencia} · BLIVRE`)).toBeOnTheScreen()
    // A atribuição da licença segue ao alcance enquanto o texto está aberto.
    await usuario.press(screen.getByRole('button', { name: /^Sobre a tradução: Bíblia Livre/ }))
    expect(router.push).toHaveBeenCalledWith('/versiculo/traducao')
    const aberto = screen.getByRole('button', {
      name: `Versículo do dia, ${v.referencia}. Recolher texto`,
    })
    expect(aberto).toBeExpanded()

    await usuario.press(aberto)
    expect(screen.queryByText(v.texto)).toBeNull()
    expect(
      screen.getByRole('button', { name: `Versículo do dia, ${v.referencia}. Mostrar texto` }),
    ).toBeCollapsed()
  })

  test('a linha que abre e recolhe tem alvo de pelo menos 44 pt', async () => {
    const v = versiculoDoDia(new Date())
    await renderizarTela(<TelaInicio />, { rotas: rotasDeBase() })
    const botao = await screen.findByRole('button', {
      name: `Versículo do dia, ${v.referencia}. Mostrar texto`,
    })
    await screen.findByText('Seu resumo')
    const estilo = (Array.isArray(botao.props.style) ? botao.props.style : [botao.props.style])
      .flat()
      .reduce(
        (a: Record<string, unknown>, s: Record<string, unknown> | null) => ({ ...a, ...s }),
        {},
      )
    expect(estilo.minHeight).toBeGreaterThanOrEqual(44)
  })
})

describe('Minha visão', () => {
  test('mostra os números da pessoa, cada um com o rótulo e o destino certos', async () => {
    await renderizarTela(<TelaInicio />, { rotas: rotasDeBase() })
    const usuario = userEvent.setup()

    const responder = await screen.findByRole('button', {
      name: 'Convocações para responder: 2. Abrir Escalas',
    })
    await usuario.press(responder)
    expect(router.push).toHaveBeenCalledWith('/escalas')

    expect(
      screen.getByRole('button', {
        name: 'Convocações aceitas: 1. Próximos encontros. Abrir Escalas',
      }),
    ).toBeOnTheScreen()
    expect(screen.getByLabelText('Tarefas abertas: 3')).toBeOnTheScreen()
    expect(screen.getByLabelText('Inscrições em encontros: 1')).toBeOnTheScreen()
    expect(
      screen.getByLabelText('Presença nos últimos 30 dias: 2 de 3. 3 encontros'),
    ).toBeOnTheScreen()
    // Pedido de oração: só a contagem, nunca texto.
    await usuario.press(
      screen.getByRole('button', { name: 'Pedidos de oração ativos: 1. Abrir Oração' }),
    )
    expect(router.push).toHaveBeenCalledWith('/oracao')
  })

  test('tudo zerado: o resumo some e fala o estado vazio, com ação', async () => {
    await renderizarTela(<TelaInicio />, {
      rotas: rotasDeBase({
        ...MINHA,
        convocacoesParaResponder: 0,
        convocacoesProximas: 0,
        tarefasAbertas: 0,
        inscricoes: 0,
        presenca30dias: { presentes: 0, encontros: 0 },
        oracoesAtivas: 0,
      }),
    })
    expect(await screen.findByText('Nenhum encontro marcado')).toBeOnTheScreen()
    expect(screen.queryByText('Seu resumo')).toBeNull()
  })

  test('falha só nos números: o resto do Início segue e dá para tentar de novo', async () => {
    let tentativas = 0
    const { servidor } = await renderizarTela(<TelaInicio />, {
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=minha`]: () => {
          tentativas += 1
          return tentativas === 1
            ? {
                status: 500,
                corpo: {
                  erro: 'interno',
                  mensagem: 'Algo deu errado do nosso lado. Tente de novo.',
                },
              }
            : { status: 200, corpo: MINHA }
        },
      },
    })

    expect(await screen.findByText('Não deu para carregar o seu resumo')).toBeOnTheScreen()
    expect(screen.getByText('Nenhum encontro marcado')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('button', { name: 'Convocações para responder: 2. Abrir Escalas' }),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', `${BASE}/visao-geral`)).toHaveLength(2)
  })

  test('carregando: esqueleto com rótulo para o leitor de tela, depois os números', async () => {
    let liberar: (r: { status: number; corpo: unknown }) => void = () => {}
    const demorada = new Promise<{ status: number; corpo: unknown }>((r) => (liberar = r))
    await renderizarTela(<TelaInicio />, {
      rotas: { ...rotasDeBase(), [`GET ${BASE}/visao-geral?escopo=minha`]: () => demorada },
    })
    expect(await screen.findByLabelText('Carregando o seu resumo')).toBeOnTheScreen()

    liberar({ status: 200, corpo: MINHA })
    expect(await screen.findByText('Seu resumo')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Carregando o seu resumo')).toBeNull()
  })
})

describe('seletor "Minha visão | Da comunidade"', () => {
  test('organizador e administrador veem o seletor; começa na Minha visão', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'organizador', rotas: rotasDeBase() })
    const minha = await screen.findByRole('radio', { name: 'Minha visão' })
    expect(minha).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Da comunidade' })).not.toBeChecked()
  })

  test('administrador também vê o seletor', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'admin', rotas: rotasDeBase() })
    expect(await screen.findByRole('radio', { name: 'Da comunidade' })).toBeOnTheScreen()
  })

  test('membro não vê o seletor nem pede a visão da comunidade', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasDeBase(),
    })
    expect(
      await screen.findByRole('button', { name: 'Convocações para responder: 2. Abrir Escalas' }),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('radio', { name: 'Da comunidade' })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Visão geral' })).toBeNull()
    expect(servidor.pedidos.filter((p) => p.url.includes('escopo=comunidade'))).toHaveLength(0)
  })

  test('"Da comunidade": os números e os atalhos de cada um', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      papel: 'admin',
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok(DA_COMUNIDADE),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Da comunidade' }))

    // Cada número leva à tela certa.
    await usuario.press(
      await screen.findByRole('button', { name: 'Convocações sem resposta: 3. Abrir Escalas' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/escalas')
    await usuario.press(
      screen.getByRole('button', {
        name: 'Convocações recusadas: 1. Chame outra pessoa. Abrir Escalas',
      }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/escalas')
    await usuario.press(
      screen.getByRole('button', { name: 'Pedidos de entrada: 2. Abrir Comunidade' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/comunidade')
    await usuario.press(
      screen.getByRole('button', { name: 'Denúncias abertas: 4. Abrir Denúncias' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/denuncias')
    await usuario.press(screen.getByRole('button', { name: 'Tarefas atrasadas: 2. Abrir Agenda' }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/agenda',
      params: { vista: 'lista' },
    })
    await usuario.press(
      screen.getByRole('button', { name: 'Pessoas ativas: 12. Abrir Comunidade' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/comunidade')
    await usuario.press(
      screen.getByRole('button', {
        name: 'Presença média: 18,5. Por encontro, nos últimos 5 encontros. Abrir Relatórios',
      }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/relatorios')

    // Os atalhos dizem em texto o que pede atenção (cor nunca é o único sinal).
    expect(screen.getAllByText('Resolver').length).toBeGreaterThan(0)
    expect(pedidosPara(servidor, 'GET', `${BASE}/visao-geral`)).toHaveLength(2)
  })

  test('próximos 14 dias: a situação das convocações em texto e o toque abre o encontro', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok(DA_COMUNIDADE),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Da comunidade' }))

    expect(await screen.findByText('3 sem resposta')).toBeOnTheScreen()
    expect(screen.getByText('Todos responderam')).toBeOnTheScreen()
    await usuario.press(
      screen.getByRole('button', { name: /^Sábado com a juventude, .*3 sem resposta/ }),
    )
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e1' },
    })
  })

  test('organizador não recebe denúncias (nulas): a linha não aparece', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok({
          ...DA_COMUNIDADE,
          denunciasAbertas: null,
        }),
      },
    })
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Da comunidade' }))
    expect(await screen.findByText('Pedidos de entrada')).toBeOnTheScreen()
    expect(screen.queryByText('Denúncias abertas')).toBeNull()
  })

  test('sem encontros nos próximos 14 dias: texto claro e a ação de criar', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok({
          ...DA_COMUNIDADE,
          proximosEncontros: [],
          presencaMedia: { encontros: 0, media: null },
        }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Da comunidade' }))

    expect(
      await screen.findByText('Nenhum encontro publicado para os próximos 14 dias.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('Nenhum encontro recente com presença registrada')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Novo encontro' }))
    expect(router.push).toHaveBeenLastCalledWith('/evento/novo')
  })

  test('erro da API: mensagem humana e "Tentar de novo"; carregando tem esqueleto', async () => {
    let tentativas = 0
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: () => {
          tentativas += 1
          return tentativas === 1
            ? {
                status: 500,
                corpo: {
                  erro: 'interno',
                  mensagem: 'Algo deu errado do nosso lado. Tente de novo.',
                },
              }
            : { status: 200, corpo: DA_COMUNIDADE }
        },
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Da comunidade' }))

    expect(await screen.findByText('Não deu para carregar a visão da comunidade')).toBeOnTheScreen()
    expect(screen.getByText('Algo deu errado do nosso lado. Tente de novo.')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('button', { name: 'Convocações sem resposta: 3. Abrir Escalas' }),
    ).toBeOnTheScreen()
  })

  test('voltar para "Minha visão" mostra o Início pessoal de novo', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok(DA_COMUNIDADE),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Da comunidade' }))
    expect(await screen.findByText('Para resolver')).toBeOnTheScreen()
    expect(screen.queryByText('Seu resumo')).toBeNull()

    await usuario.press(screen.getByRole('radio', { name: 'Minha visão' }))
    expect(await screen.findByText('Seu resumo')).toBeOnTheScreen()
    expect(screen.queryByText('Para resolver')).toBeNull()
  })
})
