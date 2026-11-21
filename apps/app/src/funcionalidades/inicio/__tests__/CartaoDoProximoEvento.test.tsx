import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { INICIO } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { confirmar } from '@/utilidades/confirmar'

import { acoesDoCartao, type SituacaoDoCartao } from '../CartaoDoProximoEvento'
import { dataCompleta, diasAte, faixaDeHorario, proximidadeDoEncontro } from '../quando'
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
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const SITUACAO_NEUTRA: SituacaoDoCartao = {
  organiza: false,
  rascunho: false,
  aoVivo: false,
  naHoraDoCheckin: false,
  convocacaoPendente: false,
  noLouvor: false,
  semResposta: 0,
  podeSeInscrever: false,
}

describe('o botão certo do cartão do encontro (tabela da auditoria de 21/11/2026)', () => {
  const caso = (
    quem: string,
    estado: Partial<SituacaoDoCartao>,
    primaria: string,
    secundaria: string | null,
  ) => ({ quem, estado, primaria, secundaria })

  test.each([
    caso('membro, convocação pendente', { convocacaoPendente: true }, 'aceitar', 'naoPossoIr'),
    caso('membro, confirmado no louvor', { noLouvor: true }, 'repertorio', 'ver'),
    caso('membro, confirmado em outra função', {}, 'ver', null),
    caso('membro, encontro público aberto', { podeSeInscrever: true }, 'inscrever', 'ver'),
    caso('membro, acontecendo agora', { aoVivo: true }, 'aoVivo', null),
    caso('líder, rascunho', { organiza: true, rascunho: true }, 'publicar', 'editar'),
    caso(
      'líder, convocados sem resposta',
      { organiza: true, semResposta: 2 },
      'verQuemFalta',
      'ver',
    ),
    caso(
      'líder, no dia (2 h antes)',
      { organiza: true, naHoraDoCheckin: true, semResposta: 2 },
      'checkin',
      'aoVivo',
    ),
    caso('líder, nada pendente', { organiza: true }, 'ver', null),
  ])('$quem: $primaria e $secundaria', ({ estado, primaria, secundaria }) => {
    expect(acoesDoCartao({ ...SITUACAO_NEUTRA, ...estado })).toEqual({ primaria, secundaria })
  })

  test('a convocação pendente vem antes do louvor e da inscrição', () => {
    expect(
      acoesDoCartao({ ...SITUACAO_NEUTRA, convocacaoPendente: true, noLouvor: true }).primaria,
    ).toBe('aceitar')
  })
})

describe('quando: proximidade, data completa e horário', () => {
  const fuso = 'America/Sao_Paulo'
  // 21/11/2026, 16:00 em São Paulo (19:00 UTC).
  const encontro = '2026-11-21T19:00:00.000Z'

  test('Hoje, Amanhã e Em N dias, pelo calendário do fuso', () => {
    expect(
      proximidadeDoEncontro(diasAte(encontro, fuso, new Date('2026-11-21T10:00:00.000Z'))),
    ).toBe('Hoje')
    expect(
      proximidadeDoEncontro(diasAte(encontro, fuso, new Date('2026-11-20T23:00:00.000Z'))),
    ).toBe('Amanhã')
    expect(
      proximidadeDoEncontro(diasAte(encontro, fuso, new Date('2026-11-16T15:00:00.000Z'))),
    ).toBe('Em 5 dias')
    // Meia-noite em São Paulo ainda é o dia anterior em UTC: vale o fuso da comunidade.
    expect(diasAte(encontro, fuso, new Date('2026-11-21T02:30:00.000Z'))).toBe(1)
  })

  test('a data completa diz o dia do mês, não só "Sábado"', () => {
    expect(dataCompleta(encontro, fuso)).toBe('Sábado, 21 de nov.')
    expect(dataCompleta('2026-11-16T19:00:00.000Z', fuso)).toBe('Segunda, 16 de nov.')
  })

  test('o horário vai do começo ao fim', () => {
    expect(faixaDeHorario(encontro, 60, fuso)).toBe('16:00 às 17:00')
    expect(faixaDeHorario(encontro, 90, fuso)).toBe('16:00 às 17:30')
  })
})

const EVENTO = {
  id: 'e1',
  titulo: 'Sábado Jovem',
  categoria: 'Programação de sábado',
  inicio: INICIO,
  duracaoMin: 60,
  status: 'publicado',
  localNome: 'Salão da igreja',
  localTipo: 'interno',
}

const inicioCom = (parte: object = {}) => ({
  status: 200,
  corpo: {
    proximosEventos: [EVENTO],
    minhasEscalas: [],
    minhasTarefas: [],
    substituicoesAbertas: 0,
    ...parte,
  },
})

const escala = (parte: object = {}) => ({
  id: 'a1',
  funcao: 'Vocal',
  estado: 'confirmada',
  eventoId: 'e1',
  eventoTitulo: 'Sábado Jovem',
  eventoInicio: INICIO,
  etapaTitulo: 'Louvor',
  ...parte,
})

const MINHA_ZERADA = {
  escopo: 'minha',
  convocacoesParaResponder: 0,
  convocacoesProximas: 0,
  tarefasAbertas: 0,
  inscricoes: 0,
  presenca30dias: { presentes: 0, encontros: 0 },
  oracoesAtivas: 0,
}

const DA_COMUNIDADE = {
  escopo: 'comunidade',
  pessoasAtivas: 15,
  proximosEncontros: [
    {
      id: 'e1',
      titulo: 'Sábado Jovem',
      inicio: INICIO,
      fuso: 'America/Sao_Paulo',
      convocados: 11,
      semResposta: 2,
      recusadas: 0,
    },
  ],
  convocacoes: { semResposta: 2, recusadas: 0 },
  pedidosDeEntrada: 0,
  denunciasAbertas: 0,
  presencaMedia: { encontros: 0, media: null },
  tarefasAtrasadas: 0,
}

const rotas = (inicio: ReturnType<typeof inicioCom>, extra: Record<string, () => unknown> = {}) =>
  ({
    [`GET ${BASE}/inicio`]: () => inicio,
    [`GET ${BASE}/visao-geral?escopo=minha`]: () => ({ status: 200, corpo: MINHA_ZERADA }),
    ...extra,
  }) as never

describe('cartão do próximo encontro, por estado', () => {
  beforeEach(() => jest.clearAllMocks())

  test('membro sem convocação: "Ver o encontro", o cartão inteiro abre o encontro e não há linha "Você:"', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'membro', rotas: rotas(inicioCom()) })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Ver o encontro' }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e1' },
    })
    expect(screen.queryByText(/^Você:/)).toBeNull()
    expect(screen.getByText('Salão da igreja')).toBeOnTheScreen()
  })

  test('membro confirmado no louvor: "Abrir o repertório" é o primário e leva ao Meu repertório', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotas(inicioCom({ minhasEscalas: [escala()] })),
    })
    const usuario = userEvent.setup()
    expect(await screen.findByText('Você: Louvor · Vocal')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: /^Abrir o meu repertório/ }))
    expect(router.push).toHaveBeenLastCalledWith('/meu-repertorio')
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
  })

  test('membro confirmado em outra função: só "Ver o encontro"', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotas(
        inicioCom({ minhasEscalas: [escala({ funcao: 'Recepção', etapaTitulo: null })] }),
      ),
    })
    expect(await screen.findByText('Você: Recepção')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /repertório/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Ver o encontro' })).toHaveLength(1)
  })

  test('encontro público com inscrição aberta e pessoa não inscrita: "Inscrever-me"', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotas(inicioCom(), {
        [`GET ${BASE}/eventos/e1`]: () => ({
          status: 200,
          corpo: {
            ...EVENTO,
            visibilidade: 'publica',
            inscricaoAte: null,
            etapas: [],
            atribuicoes: [],
          },
        }),
        [`GET ${BASE}/inscricoes/eu`]: () => ({ status: 200, corpo: { inscricoes: [] } }),
      }),
    })
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Inscrever-me' }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e1' },
    })
  })

  test('acontecendo agora: "Acompanhar ao vivo"', async () => {
    const comecouHa10Min = new Date(Date.now() - 10 * 60_000).toISOString()
    await renderizarTela(<TelaInicio />, {
      papel: 'membro',
      rotas: rotas(inicioCom({ proximosEventos: [{ ...EVENTO, inicio: comecouHa10Min }] })),
    })
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Acompanhar ao vivo' }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]/ao-vivo',
      params: { eventoId: 'e1' },
    })
    expect(screen.getByText('Ao vivo')).toBeOnTheScreen()
    expect(screen.getByText('Hoje')).toBeOnTheScreen()
  })

  test('líder, rascunho: "Publicar" pergunta antes e "Editar" abre a edição', async () => {
    const { servidor } = await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: rotas(inicioCom({ proximosEventos: [{ ...EVENTO, status: 'rascunho' }] }), {
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: () => ({
          status: 200,
          corpo: DA_COMUNIDADE,
        }),
        [`POST ${BASE}/eventos/e1/status`]: () => ({ status: 200, corpo: { status: 'publicado' } }),
      }),
    })
    const usuario = userEvent.setup()
    expect(await screen.findByText('Rascunho')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Editar' }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]/editar',
      params: { eventoId: 'e1' },
    })

    await usuario.press(screen.getByRole('button', { name: 'Publicar o encontro Sábado Jovem' }))
    expect(jest.mocked(confirmar).mock.calls[0]![0]).toMatchObject({
      titulo: 'Publicar este encontro?',
      confirmar: 'Publicar',
    })
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/e1/status`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/e1/status`)[0]!.corpo).toEqual({
      status: 'publicado',
    })
    await waitFor(() => expect(mostrarToast).toHaveBeenCalledWith({ texto: 'Encontro publicado.' }))
  })

  test('líder, publicado com convocados sem resposta: a pergunta dele e "Ver quem falta responder"', async () => {
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: rotas(inicioCom(), {
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: () => ({
          status: 200,
          corpo: DA_COMUNIDADE,
        }),
      }),
    })
    expect(await screen.findByText('9 de 11 aceitaram')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ver quem falta responder' }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e1', aba: 'convocados' },
    })
    expect(screen.getByRole('button', { name: 'Ver o encontro' })).toBeOnTheScreen()
  })

  test('líder, no dia (2 h antes): "Fazer check-in" e "Abrir ao vivo"', async () => {
    const emUmaHora = new Date(Date.now() + 60 * 60_000).toISOString()
    await renderizarTela(<TelaInicio />, {
      papel: 'organizador',
      rotas: rotas(inicioCom({ proximosEventos: [{ ...EVENTO, inicio: emUmaHora }] }), {
        [`GET ${BASE}/visao-geral?escopo=comunidade`]: () => ({
          status: 200,
          corpo: DA_COMUNIDADE,
        }),
      }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Fazer check-in' }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]/checkin',
      params: { eventoId: 'e1' },
    })
    await usuario.press(screen.getByRole('button', { name: 'Abrir ao vivo' }))
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/evento/[eventoId]/ao-vivo',
      params: { eventoId: 'e1' },
    })
  })

  test('o cartão chama atenção para a data: o texto diz "Em N dias" além da cor', async () => {
    await renderizarTela(<TelaInicio />, { papel: 'membro', rotas: rotas(inicioCom()) })
    expect(await screen.findByText(/^Em \d+ dias$/)).toBeOnTheScreen()
    expect(screen.getByText(/^Sábado, \d+ de [a-z]{3}\. · 16:00 às 17:00$/)).toBeOnTheScreen()
  })
})
