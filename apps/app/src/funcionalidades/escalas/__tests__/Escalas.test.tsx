import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert } from 'react-native'

import { DIA_DO_INICIO, INICIO } from '@/testes/fixturas'
import { BASE, pedidosPara, PESSOAS, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'
import { formatarDataPorExtenso } from '@/utilidades/datas'

import { datasParaDisponibilidade, rotuloDaData, TelaEscalas } from '../TelaEscalas'
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

describe('escalas', () => {
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

    // Aceitar e Pedir substituição na linha; "Não posso ir" à vista logo abaixo, sem menu.
    expect(
      await screen.findByRole('button', {
        name: 'Aceitar a convocação em Sábado com a juventude, Louvor · responsável',
      }),
    ).toBeOnTheScreen()
    expect(screen.getByText('Não posso ir')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Mais ações/ })).toBeNull()
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
