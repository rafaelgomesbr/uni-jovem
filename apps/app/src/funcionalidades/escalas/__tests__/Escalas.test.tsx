import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert } from 'react-native'

import { DIA_DO_INICIO, INICIO } from '@/testes/fixturas'
import { BASE, pedidosPara, PESSOAS, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { formatarDataPorExtenso } from '@/utilidades/datas'

import {
  datasParaDisponibilidade,
  resumoDasRespostas,
  rotuloDaData,
  TelaEscalas,
} from '../TelaEscalas'
import { TelaPedirSubstituicao } from '../TelaPedirSubstituicao'

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
// O retorno depois de agir vai em toast: o teste confere o texto.
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const SABADO = INICIO
const ESCALA = {
  id: 'a1',
  funcao: 'responsável',
  estado: 'pendente',
  eventoId: 'e1',
  eventoTitulo: 'Sábado com a juventude',
  eventoInicio: SABADO,
  eventoStatus: 'publicado',
  etapaTitulo: 'Louvor',
  substituicaoAberta: null,
}

/** Confirma automaticamente o diálogo nativo (o botão de ação é o último). */
function confirmarDialogos() {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botoes) => {
    botoes?.at(-1)?.onPress?.()
  })
}

const ROTAS = {
  [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [ESCALA] } }),
  [`GET ${BASE}/substituicoes`]: () => ({
    status: 200,
    corpo: {
      substituicoes: [
        {
          id: 's1',
          pedidaPor: 'Bruno Lima',
          minha: false,
          possoAssumir: true,
          dirigida: false,
          motivo: 'Viagem',
          funcao: 'integrante',
          evento: { id: 'e1', titulo: 'Sábado com a juventude', inicio: SABADO },
          etapa: 'Dinâmica',
        },
      ],
    },
  }),
  [`GET ${BASE}/eventos`]: () => ({ status: 200, corpo: { eventos: [] } }),
  [`GET ${BASE}/disponibilidade`]: () => ({ status: 200, corpo: { disponibilidade: [] } }),
}

describe('aba Escalas (D57)', () => {
  beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}))
  afterEach(() => jest.restoreAllMocks())

  test('a convocação pendente tem "Aceitar" à vista e aceita na própria aba, com toast', async () => {
    const { servidor } = await renderizarTela(<TelaEscalas />, {
      papel: 'membro',
      rotas: {
        ...ROTAS,
        [`POST ${BASE}/atribuicoes/a1/confirmar`]: () => ({
          status: 200,
          corpo: { estado: 'confirmada' },
        }),
      },
    })
    // Raiz de aba: título "Escalas" e os segmentos Próximas e Disponibilidade.
    expect(await screen.findByRole('radio', { name: 'Próximas' })).toBeChecked()
    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'Aceitar a convocação em Sábado com a juventude, Louvor · responsável',
      }),
    )
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(1),
    )
    expect(mostrarToast).toHaveBeenCalledWith({
      texto: 'Você aceitou. A organização já vê sua resposta.',
    })
    // Membro não convoca: o cartão "Aguardando resposta" nem é pedido.
    expect(pedidosPara(servidor, 'GET', `${BASE}/convocacoes/aguardando-resposta`)).toHaveLength(0)
    expect(screen.queryByRole('header', { name: 'Aguardando resposta' })).toBeNull()
  })

  test('para a organização, "Aguardando resposta" no topo lista os encontros e abre cada um', async () => {
    await renderizarTela(<TelaEscalas />, {
      papel: 'organizador',
      rotas: {
        ...ROTAS,
        [`GET ${BASE}/convocacoes/aguardando-resposta`]: () => ({
          status: 200,
          corpo: {
            encontros: [
              {
                id: 'e1',
                titulo: 'Sábado com a juventude',
                inicio: SABADO,
                fuso: 'America/Sao_Paulo',
                pendentes: 2,
                recusadas: 1,
              },
            ],
          },
        }),
      },
    })
    expect(await screen.findByRole('header', { name: 'Aguardando resposta' })).toBeOnTheScreen()
    // O número sempre com a palavra: nunca só a cor.
    const linha = screen.getByRole('button', {
      name: /^Sábado com a juventude, .*2 sem resposta · 1 não pode ir\. Abrir o encontro$/,
    })
    await userEvent.setup().press(linha)
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]',
      params: { eventoId: 'e1' },
    })
  })

  test('sem nada esperando resposta, o cartão não aparece', async () => {
    await renderizarTela(<TelaEscalas />, {
      papel: 'admin',
      rotas: {
        ...ROTAS,
        [`GET ${BASE}/convocacoes/aguardando-resposta`]: () => ({
          status: 200,
          corpo: { encontros: [] },
        }),
      },
    })
    expect(await screen.findByRole('radio', { name: 'Próximas' })).toBeOnTheScreen()
    expect(screen.queryByRole('header', { name: 'Aguardando resposta' })).toBeNull()
  })

  test('`?vista=disponibilidade` (do Início) abre direto na Disponibilidade', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ vista: 'disponibilidade' })
    await renderizarTela(<TelaEscalas />, { papel: 'membro', rotas: ROTAS })
    expect(await screen.findByRole('radio', { name: 'Disponibilidade' })).toBeChecked()
  })

  test('resumo das respostas, com a palavra junto do número', () => {
    expect(resumoDasRespostas(1, 0)).toBe('1 sem resposta')
    expect(resumoDasRespostas(0, 2)).toBe('2 não podem ir')
    expect(resumoDasRespostas(3, 1)).toBe('3 sem resposta · 1 não pode ir')
  })
})

describe('escalas', () => {
  beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({}))
  afterEach(() => jest.restoreAllMocks())

  test('assumir uma substituição aberta, com confirmação', async () => {
    confirmarDialogos()
    const { servidor } = await renderizarTela(<TelaEscalas />, {
      papel: 'membro',
      rotas: {
        ...ROTAS,
        [`POST ${BASE}/substituicoes/s1/assumir`]: () => ({
          status: 200,
          corpo: { atribuicaoId: 'a9' },
        }),
      },
    })

    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'Assumir a escala de Bruno Lima em Sábado com a juventude',
      }),
    )

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/substituicoes/s1/assumir`)).toHaveLength(1),
    )
  })

  test('"Não posso ir" fica à vista e recusa com confirmação', async () => {
    const dialogo = confirmarDialogos()
    const { servidor } = await renderizarTela(<TelaEscalas />, {
      papel: 'membro',
      rotas: {
        ...ROTAS,
        [`POST ${BASE}/atribuicoes/a1/recusar`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    const usuario = userEvent.setup()

    // Pendente: só "Aceitar" e "Não posso ir" (D62), os dois à vista, sem menu.
    expect(
      await screen.findByRole('button', {
        name: 'Aceitar a convocação em Sábado com a juventude, Louvor · responsável',
      }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Não posso ir')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Mais ações/ })).toBeNull()
    // "Pedir substituição" só existe depois de aceitar.
    expect(screen.queryByRole('button', { name: /^Pedir substituição/ })).toBeNull()
    await usuario.press(
      screen.getByRole('button', {
        name: 'Não posso ir: avisar a organização sobre Sábado com a juventude, Louvor · responsável',
      }),
    )

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(1),
    )
    expect(dialogo.mock.calls[0]![0]).toBe('Avisar que você não pode ir?')
  })

  test('convocação pendente tem exatamente dois botões: Aceitar e Não posso ir (D62)', async () => {
    await renderizarTela(<TelaEscalas />, { papel: 'membro', rotas: ROTAS })
    await screen.findByRole('button', { name: /^Aceitar a convocação/ })
    const botoes = screen
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel as string | undefined)
      .filter((nome) => /^(Aceitar|Não posso ir|Pedir substituição)/.test(nome ?? ''))
    expect(botoes).toHaveLength(2)
    expect(botoes.some((nome) => nome?.startsWith('Aceitar'))).toBe(true)
    expect(botoes.some((nome) => nome?.startsWith('Não posso ir'))).toBe(true)
  })

  test('depois de aceitar, aparece "Pedir substituição" e saem "Aceitar" e "Não posso ir"', async () => {
    await renderizarTela(<TelaEscalas />, {
      papel: 'membro',
      rotas: {
        ...ROTAS,
        [`GET ${BASE}/minhas-escalas`]: () => ({
          status: 200,
          corpo: { escalas: [{ ...ESCALA, estado: 'confirmada' }] },
        }),
      },
    })
    expect(
      await screen.findByRole('button', {
        name: 'Pedir substituição na escala de Sábado com a juventude, Louvor · responsável',
      }),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Aceitar a convocação/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Não posso ir/ })).toBeNull()
  })

  test('informar disponibilidade numa data manda PUT para aquele dia', async () => {
    const { servidor } = await renderizarTela(<TelaEscalas />, {
      papel: 'membro',
      rotas: {
        ...ROTAS,
        [`GET ${BASE}/eventos`]: () => ({
          status: 200,
          corpo: {
            eventos: [
              {
                id: 'e1',
                titulo: 'Sábado',
                categoria: 'Programação de sábado',
                inicio: SABADO,
                duracaoMin: 60,
                fuso: 'America/Sao_Paulo',
                status: 'publicado',
                visibilidade: 'interna',
                serieId: null,
                versao: 1,
                localNome: null,
                localTipo: null,
                quantidadeDeEtapas: 0,
              },
            ],
          },
        }),
        [`PUT ${BASE}/disponibilidade/${DIA_DO_INICIO}`]: () => ({
          status: 200,
          corpo: { ok: true },
        }),
      },
    })

    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Disponibilidade' }))
    // Cada data é uma pílula ("sáb 21 nov"), lida por extenso: ativa quer dizer "posso ajudar".
    const dia = await screen.findByRole('checkbox', {
      name: formatarDataPorExtenso(DIA_DO_INICIO, false),
    })
    expect(screen.getByText(rotuloDaData(DIA_DO_INICIO))).toBeOnTheScreen()
    expect(dia).not.toBeChecked()
    await usuario.press(dia)

    await waitFor(() =>
      expect(
        pedidosPara(servidor, 'PUT', `${BASE}/disponibilidade/${DIA_DO_INICIO}`)[0]?.corpo,
      ).toEqual({ disponivel: true }),
    )
  })

  test('datas para disponibilidade: dias com evento; sem eventos, os próximos sábados', () => {
    expect(rotuloDaData('2026-11-21')).toBe('sáb 21 nov')
    expect(datasParaDisponibilidade('2026-11-14', ['2026-11-21', '2026-11-10'], [])).toEqual([
      '2026-11-21',
    ])
    const sabados = datasParaDisponibilidade('2026-11-16', [], [])
    expect(sabados[0]).toBe('2026-11-21')
    expect(sabados).toHaveLength(6)
  })
})

describe('pedir substituição', () => {
  test('para uma pessoa: sem escolher, explica; escolhendo, manda o vínculo dela', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ atribuicaoId: 'a1' })
    const { servidor } = await renderizarTela(<TelaPedirSubstituicao />, {
      papel: 'membro',
      rotas: {
        ...ROTAS,
        [`POST ${BASE}/atribuicoes/a1/substituicao`]: () => ({
          status: 200,
          corpo: { substituicaoId: 's2' },
        }),
      },
    })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('radio', { name: 'Uma pessoa específica' }))
    await usuario.press(screen.getByRole('button', { name: 'Pedir substituição' }))
    expect(
      await screen.findByText(
        'Escolha para quem vai o pedido, ou deixe para qualquer pessoa da comunidade.',
      ),
    ).toBeOnTheScreen()

    // A própria pessoa não aparece como opção.
    expect(screen.queryByRole('radio', { name: 'Ana Souza' })).toBeNull()
    await usuario.press(await screen.findByRole('radio', { name: 'Carla Dias' }))
    await usuario.press(screen.getByRole('button', { name: 'Pedir substituição' }))

    await waitFor(() =>
      expect(
        pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/substituicao`)[0]?.corpo,
      ).toEqual({ motivo: null, paraVinculoId: PESSOAS[2]!.vinculoId }),
    )
    // Retorno depois de agir: o toast diz quem foi avisado, e a tela fecha.
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Pedido de substituição enviado. Avisamos a pessoa escolhida.',
      }),
    )
    expect(router.back).toHaveBeenCalled()
  })

  test('para qualquer pessoa da comunidade: um toque só cria um pedido, e o toast avisa', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ atribuicaoId: 'a1' })
    // Aberta direto (link ou notificação): sem tela para voltar, vai para as escalas.
    ;(router.canGoBack as jest.Mock).mockReturnValueOnce(false)
    let responder: () => void = () => {}
    const { servidor } = await renderizarTela(<TelaPedirSubstituicao />, {
      papel: 'membro',
      rotas: {
        ...ROTAS,
        [`POST ${BASE}/atribuicoes/a1/substituicao`]: () =>
          new Promise((r) => {
            responder = () => r({ status: 200, corpo: { substituicaoId: 's3' } })
          }),
      },
    })
    const usuario = userEvent.setup()

    expect(
      await screen.findByRole('radio', { name: 'Qualquer pessoa da comunidade' }),
    ).toBeChecked()
    const botao = screen.getByRole('button', { name: 'Pedir substituição' })
    await usuario.press(botao)
    await usuario.press(botao)
    responder()

    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Pedido de substituição enviado. Avisamos a equipe.',
      }),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/substituicao`)).toHaveLength(1)
    expect(router.replace).toHaveBeenCalledWith('/escalas')
  })
})
