import { screen, userEvent } from '@testing-library/react-native'
import { router } from 'expo-router'

import {
  eventoDoMomento,
  inicioComMomento,
  momentoDeTeste,
  parteDoMomento,
  RELOGIO,
} from '@/testes/momento'
import { BASE, renderizarTela } from '@/testes/telas'
import type { ParteDoMomento } from '@/servicos/contratoV3'

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

const VISAO = {
  [`GET ${BASE}/visao-geral?escopo=minha`]: () => ({
    status: 200,
    corpo: {
      escopo: 'minha',
      convocacoesParaResponder: 0,
      convocacoesProximas: 1,
      tarefasAbertas: 0,
      inscricoes: 0,
      presenca30dias: { presentes: 0, encontros: 0 },
      oracoesAtivas: 0,
    },
  }),
}

const rotasCom = (parte: Partial<ParteDoMomento> | null, relogio: object = {}, musicas = 0) => ({
  ...VISAO,
  [`GET ${BASE}/inicio`]: () => ({
    status: 200,
    corpo: inicioComMomento(
      momentoDeTeste({
        ...relogio,
        evento: eventoDoMomento({ musicas }),
        suaParte: parte ? [parteDoMomento({ estado: 'confirmada', ...parte })] : [],
      }),
    ),
  }),
})

const ABRIR = { name: 'Abrir o repertório: Sábado Jovem' }
const VER = { name: 'Ver o repertório: Sábado Jovem' }

describe('modo músico no Início (D61, D62, D68): o botão "Abrir o repertório" no cartão do momento', () => {
  beforeEach(() => jest.clearAllMocks())

  test('convocado ao louvor (pela etapa): é o primário do cartão e leva ao Meu repertório', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'integrante', etapaTitulo: 'Louvor' }),
    })
    const abrir = await screen.findByRole('button', ABRIR)
    await userEvent.setup().press(abrir)
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
    // O cartão "Meu repertório" não existe mais no Início.
    expect(screen.queryByText('Meu repertório')).toBeNull()
  })

  test('função de banda (violão) no encontro inteiro também conta', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'violão', etapaTitulo: null }),
    })
    expect(await screen.findByRole('button', ABRIR)).toBeOnTheScreen()
  })

  test('quem não toca (recepção) não vê o botão', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'recepção', etapaTitulo: 'Palavra' }),
    })
    await screen.findByText('Sua parte: Palavra · recepção')
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
  })

  test('convocação de louvor recusada não mostra o botão nem a linha "Sua parte"', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'Bateria', etapaTitulo: 'Louvor', estado: 'recusada' }),
    })
    await screen.findByText('Você avisou que não pode. A liderança será avisada.')
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
    expect(screen.queryByText(/^Sua parte/)).toBeNull()
  })

  test('convocação de louvor ainda pendente: primeiro responder; o repertório só depois de aceitar', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'Vocal', etapaTitulo: 'Louvor', estado: 'pendente' }),
    })
    expect(await screen.findByRole('button', { name: /^Aceitar a convocação/ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
  })

  test('sem nenhuma convocação, nada de botão', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'membro', rotas: rotasCom(null) })
    await screen.findByRole('button', { name: 'Ver o encontro' })
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
  })

  test('na véspera o primário é "Como chegar", e o repertório continua a um toque', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'Vocal', etapaTitulo: 'Louvor' }, RELOGIO.vespera),
    })
    expect(
      await screen.findByRole('button', { name: 'Como chegar a Sábado Jovem' }),
    ).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', ABRIR))
    expect(router.push).toHaveBeenCalledWith('/meu-repertorio')
  })
})

describe('repertório para toda a comunidade (D73): "Ver o repertório" quando o encontro tem músicas', () => {
  beforeEach(() => jest.clearAllMocks())

  test('quem não toca (recepção) e o encontro tem músicas: "Ver o repertório" abre a lista do encontro', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'recepção', etapaTitulo: 'Palavra' }, {}, 4),
    })
    const ver = await screen.findByRole('button', VER)
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
    await userEvent.setup().press(ver)
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/repertorio',
      params: { eventoId: 'e1' },
    })
  })

  test('sem nenhuma convocação também vê: o repertório é de todos, e "Ver o encontro" é só a chamada do cartão', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'membro', rotas: rotasCom(null, {}, 2) })
    expect(await screen.findByRole('button', VER)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Ver o encontro' })).toBeNull()
    expect(screen.getAllByText('Ver o encontro')).toHaveLength(1)
  })

  test('sem músicas e sem tocar: nenhum botão de repertório', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'membro', rotas: rotasCom(null, {}, 0) })
    await screen.findByRole('button', { name: 'Ver o encontro' })
    expect(screen.queryByRole('button', VER)).toBeNull()
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
  })

  test('convocação de louvor recusada: quem não toca vê a lista (não o Meu repertório)', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'Bateria', etapaTitulo: 'Louvor', estado: 'recusada' }, {}, 3),
    })
    await screen.findByText('Você avisou que não pode. A liderança será avisada.')
    expect(screen.getByRole('button', VER)).toBeOnTheScreen()
    expect(screen.queryByRole('button', ABRIR)).toBeNull()
  })

  test('quem toca (pendente) e há músicas: o primário segue "Aceitar"; o repertório é o dele, sem esconder o pedido', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotasCom({ funcao: 'Vocal', etapaTitulo: 'Louvor', estado: 'pendente' }, {}, 3),
    })
    expect(await screen.findByRole('button', { name: /^Aceitar a convocação/ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', VER)).toBeNull()
  })

  test('o líder que não toca: "Ver o repertório" com músicas, "Montar o repertório" sem elas', async () => {
    const usuario = userEvent.setup()
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => ({
          status: 200,
          corpo: inicioComMomento(
            momentoDeTeste({
              evento: eventoDoMomento({ musicas: 0 }),
              lider: {
                convocados: 3,
                confirmados: 3,
                recusaram: 0,
                pendentes: 0,
                responderam: 3,
                faltamResponder: [],
                faltamResponderTotal: 0,
                faltaFuncao: [],
                musicas: 0,
                inscritos: 0,
                presentes: 0,
                lembraveis: 0,
                avisariaAoPublicar: 3,
              },
            }),
          ),
        }),
      },
    })
    const montar = await screen.findByRole('button', { name: 'Montar o repertório: Sábado Jovem' })
    await usuario.press(montar)
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/repertorio',
      params: { eventoId: 'e1' },
    })
  })

  test('o líder na véspera, com músicas: "Ver o repertório" à mão, fora do par de botões', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: {
        ...VISAO,
        [`GET ${BASE}/inicio`]: () => ({
          status: 200,
          corpo: inicioComMomento(
            momentoDeTeste({
              ...RELOGIO.vespera,
              evento: eventoDoMomento({ musicas: 3 }),
              lider: {
                convocados: 3,
                confirmados: 3,
                recusaram: 0,
                pendentes: 0,
                responderam: 3,
                faltamResponder: [],
                faltamResponderTotal: 0,
                faltaFuncao: [],
                musicas: 3,
                inscritos: 0,
                presentes: 0,
                lembraveis: 0,
                avisariaAoPublicar: 3,
              },
            }),
          ),
        }),
      },
    })
    const ver = await screen.findByRole('button', VER)
    await userEvent.setup().press(ver)
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/repertorio',
      params: { eventoId: 'e1' },
    })
  })
})
