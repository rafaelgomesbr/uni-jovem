import { screen, userEvent } from '@testing-library/react-native'
import { versiculoDoDia } from '@uj/conteudo'
import { router } from 'expo-router'

import { INICIO } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import {
  comecoDoVersiculo,
  reiniciarVersiculoDaSessao,
  semColchetes,
} from '../../versiculo/CartaoDoVersiculo'
import { tituloDoResumo } from '../MinhaVisaoGeral'
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

/** Uma tarefa aberta no encontro e1: é para lá que "Concluir tarefas" leva. */
const TAREFA = {
  id: 't1',
  titulo: 'Comprar o brinde',
  prazo: null,
  eventoId: 'e1',
  eventoTitulo: 'Sábado',
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

const TUDO_ZERADO = {
  ...MINHA,
  convocacoesParaResponder: 0,
  convocacoesProximas: 0,
  tarefasAbertas: 0,
  inscricoes: 0,
  presenca30dias: { presentes: 0, encontros: 0 },
  oracoesAtivas: 0,
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
  ],
  convocacoes: { semResposta: 3, recusadas: 1 },
  pedidosDeEntrada: 2,
  denunciasAbertas: 4,
  presencaMedia: { encontros: 5, media: 18.5 },
  tarefasAtrasadas: 2,
}

const SEM_PENDENCIAS = {
  ...DA_COMUNIDADE,
  proximosEncontros: [],
  convocacoes: { semResposta: 0, recusadas: 0 },
  pedidosDeEntrada: 0,
  denunciasAbertas: 0,
  tarefasAtrasadas: 0,
}

const ok = (corpo: unknown) => () => ({ status: 200, corpo })
const rotasDeBase = (minha: unknown = MINHA, inicio: unknown = INICIO_VAZIO) => ({
  [`GET ${BASE}/inicio`]: ok(inicio),
  [`GET ${BASE}/visao-geral?escopo=minha`]: ok(minha),
})
const comTarefa = { ...INICIO_VAZIO, minhasTarefas: [TAREFA] }

const RESUMO_FECHADO = /^Seu resumo: .*Recolhido, toque para ver\.$/
const RESUMO_ABERTO = /^Seu resumo: .*Aberto, toque para recolher\.$/

beforeEach(() => {
  jest.clearAllMocks()
  reiniciarVersiculoDaSessao()
})

describe('texto do versículo na exibição (Q7)', () => {
  test('os colchetes do tradutor saem, as palavras ficam', () => {
    expect(semColchetes('Não [fostes] vós [que] me escolhestes')).toBe(
      'Não fostes vós que me escolhestes',
    )
    expect(semColchetes('Sem colchete nenhum')).toBe('Sem colchete nenhum')
  })

  test('o começo traz as primeiras palavras entre aspas e reticências, sem pontuação solta', () => {
    expect(
      comecoDoVersiculo('Não [fostes] vós que me escolhestes, mas eu vos escolhi e vos nomeei'),
    ).toBe('“Não fostes vós que me escolhestes, mas…”')
    // Curto demais para cortar: inteiro, sem reticências.
    expect(comecoDoVersiculo('Deus é amor.')).toBe('“Deus é amor”')
  })
})

describe('versículo do dia no Início', () => {
  test('uma linha recolhida com o começo do texto; tocar abre o texto inteiro, a tradução e a atribuição', async () => {
    const v = versiculoDoDia(new Date())
    await renderizarTela(<TelaInicio />, { rotas: rotasDeBase() })

    const botao = await screen.findByRole('button', {
      name: `Versículo do dia, ${v.referencia}. Recolhido. Toque para ler.`,
    })
    expect(botao).toBeCollapsed()
    await screen.findByText('Seu resumo')
    // Recolhido: o começo do texto entre aspas, sem o texto inteiro, sem a tradução e sem colchetes.
    expect(screen.getByText(comecoDoVersiculo(v.texto))).toBeOnTheScreen()
    expect(screen.queryByText(semColchetes(v.texto))).toBeNull()
    expect(screen.queryByText(/BLIVRE/)).toBeNull()
    expect(screen.queryByText(/[[\]]/)).toBeNull()

    const usuario = userEvent.setup()
    await usuario.press(botao)

    expect(screen.getByText(semColchetes(v.texto))).toBeOnTheScreen()
    expect(screen.getByText(`${v.referencia} · BLIVRE`)).toBeOnTheScreen()
    // A atribuição da licença segue ao alcance enquanto o texto está aberto.
    await usuario.press(screen.getByRole('button', { name: /^Sobre a tradução: Bíblia Livre/ }))
    expect(router.push).toHaveBeenCalledWith('/versiculo/traducao')
    // "Horário e notificação" saiu do cartão: mora no Perfil e na tela cheia.
    expect(screen.queryByRole('button', { name: /^Horário e notificação/ })).toBeNull()
    const aberto = screen.getByRole('button', {
      name: `Versículo do dia, ${v.referencia}. Aberto. Toque para recolher.`,
    })
    expect(aberto).toBeExpanded()

    await usuario.press(aberto)
    expect(screen.queryByText(semColchetes(v.texto))).toBeNull()
    expect(
      screen.getByRole('button', {
        name: `Versículo do dia, ${v.referencia}. Recolhido. Toque para ler.`,
      }),
    ).toBeCollapsed()
  })

  test('a linha que abre e recolhe tem alvo de pelo menos 44 pt', async () => {
    const v = versiculoDoDia(new Date())
    await renderizarTela(<TelaInicio />, { rotas: rotasDeBase() })
    const botao = await screen.findByRole('button', {
      name: `Versículo do dia, ${v.referencia}. Recolhido. Toque para ler.`,
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

describe('título do resumo', () => {
  test('diz a única coisa que importa: tudo em dia, 1 coisa ou N coisas', () => {
    expect(tituloDoResumo(0)).toBe('Tudo em dia')
    expect(tituloDoResumo(1)).toBe('1 coisa esperando você')
    expect(tituloDoResumo(2)).toBe('2 coisas esperando você')
    expect(tituloDoResumo(7)).toBe('7 coisas esperando você')
  })
})

describe('Seu resumo (acordeão)', () => {
  test('nasce fechado, com o título que conta as linhas, e sem nenhuma linha à mostra', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasDeBase(MINHA, comTarefa),
    })
    const resumo = await screen.findByRole('button', {
      name: 'Seu resumo: 2 coisas esperando você. Recolhido, toque para ver.',
    })
    expect(resumo).toBeCollapsed()
    expect(screen.getByText('2 coisas esperando você')).toBeOnTheScreen()
    expect(screen.queryByText('Responder 2 convocações')).toBeNull()
    expect(screen.queryByText('Concluir 3 tarefas')).toBeNull()
  })

  test('aberto: só linhas com valor, com verbo, e cada uma leva a um lugar', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasDeBase(MINHA, { ...comTarefa, substituicoesAbertas: 1 }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: RESUMO_FECHADO }))
    expect(screen.getByRole('button', { name: RESUMO_ABERTO })).toBeExpanded()

    await usuario.press(
      screen.getByRole('button', { name: 'Responder 2 convocações. Abrir Escalas' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/escalas')

    await usuario.press(
      screen.getByRole('button', { name: 'Concluir 3 tarefas. Abrir o encontro' }),
    )
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e1' },
    })

    await usuario.press(
      screen.getByRole('button', { name: 'Ver 1 pedido de substituição. Abrir Escalas' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/escalas')
  })

  test('o título conta exatamente as linhas listadas', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasDeBase(MINHA, { ...comTarefa, substituicoesAbertas: 1 }),
    })
    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'Seu resumo: 3 coisas esperando você. Recolhido, toque para ver.',
      }),
    )
    expect(screen.getAllByRole('button', { name: /\. Abrir / })).toHaveLength(3)
  })

  test('nada de zero: linha sem valor não entra (1 coisa, no singular)', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasDeBase({ ...TUDO_ZERADO, convocacoesParaResponder: 1 }),
    })
    const usuario = userEvent.setup()
    await usuario.press(
      await screen.findByRole('button', {
        name: 'Seu resumo: 1 coisa esperando você. Recolhido, toque para ver.',
      }),
    )
    expect(
      screen.getByRole('button', { name: 'Responder 1 convocação. Abrir Escalas' }),
    ).toBeOnTheScreen()
    expect(screen.queryByText(/Concluir/)).toBeNull()
    expect(screen.queryByText(/substituição/)).toBeNull()
    expect(screen.queryByText(/\b0\b/)).toBeNull()
  })

  test('saíram do resumo: convocações aceitas, inscrições, presença de 30 dias e oração ativa', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'membro', rotas: rotasDeBase() })
    await userEvent.setup().press(await screen.findByRole('button', { name: RESUMO_FECHADO }))
    expect(screen.queryByText(/Convocações aceitas/)).toBeNull()
    expect(screen.queryByText(/Inscrições em encontros/)).toBeNull()
    expect(screen.queryByText(/Presença nos últimos 30 dias/)).toBeNull()
    expect(screen.queryByText(/Pedidos de oração ativos/)).toBeNull()
  })

  test('"Tudo em dia": sem linha, sem seta, sem botão que abre', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasDeBase(TUDO_ZERADO),
    })
    expect(await screen.findByText('Tudo em dia')).toBeOnTheScreen()
    expect(screen.getByLabelText('Seu resumo: Tudo em dia')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: RESUMO_FECHADO })).toBeNull()
    expect(screen.queryByRole('button', { name: RESUMO_ABERTO })).toBeNull()
  })

  test('falha só nos números: o resto do Início segue e dá para tentar de novo', async () => {
    let tentativas = 0
    const { servidor } = await renderizarTela(<TelaInicio />, {
      papel: 'membro',
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
    expect(await screen.findByRole('button', { name: RESUMO_FECHADO })).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'GET', `${BASE}/visao-geral`)).toHaveLength(2)
  })

  test('carregando: esqueleto com rótulo para o leitor de tela, depois o título', async () => {
    let liberar: (r: { status: number; corpo: unknown }) => void = () => {}
    const demorada = new Promise<{ status: number; corpo: unknown }>((r) => (liberar = r))
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: { ...rotasDeBase(), [`GET ${BASE}/visao-geral?escopo=minha`]: () => demorada },
    })
    expect(await screen.findByLabelText('Carregando o seu resumo')).toBeOnTheScreen()

    liberar({ status: 200, corpo: MINHA })
    expect(await screen.findByText('Seu resumo')).toBeOnTheScreen()
    expect(screen.queryByLabelText('Carregando o seu resumo')).toBeNull()
  })
})

describe('Início de quem organiza (D62, Q1): o mesmo do membro, sem seletor', () => {
  test('não há "Minha visão | Da comunidade" para organizador nem para administrador', async () => {
    for (const papel of ['organizador', 'admin'] as const) {
      const { unmount } = await renderizarTela(<TelaInicio />, {
        papel,
        rotas: {
          ...rotasDeBase(),
          [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok(DA_COMUNIDADE),
        },
      })
      await screen.findByRole('button', { name: RESUMO_FECHADO })
      expect(screen.queryByRole('radio', { name: 'Minha visão' })).toBeNull()
      expect(screen.queryByRole('radio', { name: 'Da comunidade' })).toBeNull()
      expect(screen.queryByRole('radiogroup', { name: 'Visão geral' })).toBeNull()
      await unmount()
    }
  })

  test('o título soma "Para você" e "Da organização"; aberto, os dois grupos têm subtítulo em texto', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'admin',
      rotas: {
        ...rotasDeBase(MINHA, comTarefa),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok(DA_COMUNIDADE),
      },
    })
    // 2 pessoais (convocações e tarefas) + 5 da organização (sem resposta, recusadas, entrada, denúncias, atrasadas).
    const resumo = await screen.findByRole('button', {
      name: 'Seu resumo: 7 coisas esperando você. Recolhido, toque para ver.',
    })
    await userEvent.setup().press(resumo)
    expect(screen.getByText('Para você')).toBeOnTheScreen()
    expect(screen.getByText('Da organização')).toBeOnTheScreen()
  })

  test('"Da organização": cada linha tem verbo e leva à tela certa; os números ficam sempre à mão', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'admin',
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok(DA_COMUNIDADE),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: RESUMO_FECHADO }))

    await usuario.press(
      await screen.findByRole('button', { name: 'Ver 3 convocações sem resposta. Abrir Escalas' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/escalas')
    await usuario.press(
      screen.getByRole('button', { name: 'Ver 1 convocação recusada. Abrir Escalas' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/escalas')
    await usuario.press(
      screen.getByRole('button', { name: 'Ver 2 pedidos de entrada. Abrir Comunidade' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/comunidade')
    await usuario.press(
      screen.getByRole('button', { name: 'Ver 4 denúncias abertas. Abrir Denúncias' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/denuncias')
    await usuario.press(
      screen.getByRole('button', { name: 'Ver 2 tarefas atrasadas. Abrir Agenda' }),
    )
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/agenda',
      params: { vista: 'lista' },
    })
    await usuario.press(
      screen.getByRole('button', { name: 'Ver os números e relatórios. Abrir Relatórios' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/relatorios')
  })

  test('"Próximos 14 dias" e "Números da comunidade" saíram do Início', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'admin',
      rotas: {
        ...rotasDeBase(),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok(DA_COMUNIDADE),
      },
    })
    await userEvent.setup().press(await screen.findByRole('button', { name: RESUMO_FECHADO }))
    expect(screen.queryByText('Próximos 14 dias')).toBeNull()
    expect(screen.queryByText('Números da comunidade')).toBeNull()
    expect(screen.queryByText('Pessoas ativas')).toBeNull()
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
    await userEvent.setup().press(await screen.findByRole('button', { name: RESUMO_FECHADO }))
    expect(await screen.findByText('Ver 2 pedidos de entrada')).toBeOnTheScreen()
    expect(screen.queryByText(/denúncia/)).toBeNull()
  })

  test('sem pendências: "Tudo em dia", e ainda dá para abrir e ir aos números e relatórios', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...rotasDeBase(TUDO_ZERADO),
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: ok(SEM_PENDENCIAS),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(
      await screen.findByRole('button', {
        name: 'Seu resumo: Tudo em dia. Recolhido, toque para ver.',
      }),
    )
    expect(screen.queryByText('Para você')).toBeNull()
    await usuario.press(
      screen.getByRole('button', { name: 'Ver os números e relatórios. Abrir Relatórios' }),
    )
    expect(router.push).toHaveBeenLastCalledWith('/relatorios')
  })

  test('erro só na visão da organização: o pessoal segue e dá para tentar de novo', async () => {
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
    await usuario.press(await screen.findByRole('button', { name: RESUMO_FECHADO }))
    expect(
      await screen.findByText('Não deu para carregar a visão da organização'),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Responder 2 convocações. Abrir Escalas' }),
    ).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('button', { name: 'Ver 3 convocações sem resposta. Abrir Escalas' }),
    ).toBeOnTheScreen()
  })

  test('membro não vê os grupos nem pede a visão da comunidade', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasDeBase(),
    })
    await userEvent.setup().press(await screen.findByRole('button', { name: RESUMO_FECHADO }))
    expect(
      screen.getByRole('button', { name: 'Responder 2 convocações. Abrir Escalas' }),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Para você')).toBeNull()
    expect(screen.queryByText('Da organização')).toBeNull()
    expect(screen.queryByText(/números e relatórios/)).toBeNull()
    expect(servidor.pedidos.filter((p) => p.url.includes('escopo=comunidade'))).toHaveLength(0)
  })
})
