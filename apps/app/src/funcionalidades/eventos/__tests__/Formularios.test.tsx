import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router'
import { Alert } from 'react-native'

import { EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { TelaEditarEvento } from '../TelaEditarEvento'
import { TelaMudarStatus } from '../TelaMudarStatus'
import { TelaNovoEvento } from '../TelaNovoEvento'

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

const parametros = useLocalSearchParams as jest.Mock

/**
 * Escolhe no seletor nativo (dublê do `@expo/ui`): toca o campo, o seletor
 * abre logo abaixo, o teste faz o papel da roda e o campo fecha de novo.
 */
async function escolher(rotulo: RegExp, valor: Date) {
  const usuario = userEvent.setup()
  await usuario.press(screen.getByRole('button', { name: rotulo }))
  const seletor = screen.getAllByTestId('seletor-de-data').at(-1)!
  await fireEvent(seletor, 'valueChange', {}, valor)
  await usuario.press(screen.getByRole('button', { name: rotulo }))
}
const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`
const SABADO = {
  chave: 'sabado_padrao',
  nome: 'Sábado padrão',
  categoria: 'Programação de sábado',
  descricao: 'Programação habitual de sábado, com cerca de uma hora.',
  etapas: [{ titulo: 'Boas-vindas', duracaoMin: 60 }],
  checklist: [],
}
const ROTAS_DO_FORMULARIO = {
  [`GET ${BASE}/modelos`]: () => ({
    status: 200,
    corpo: { embutidos: [SABADO], daComunidade: [] },
  }),
  [`GET ${BASE}/locais`]: () => ({ status: 200, corpo: { locais: [] } }),
}

describe('criar programação', () => {
  beforeEach(() => jest.clearAllMocks())

  test('Sábado padrão vem preenchido e cria o rascunho com o modelo', async () => {
    parametros.mockReturnValue({ modelo: 'sabado_padrao' })
    const { servidor } = await renderizarTela(<TelaNovoEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`POST ${BASE}/eventos`]: () => ({ status: 200, corpo: { id: 'novo-1', versao: 1 } }),
      },
    })

    expect(await screen.findByDisplayValue('Sábado')).toBeOnTheScreen()
    // A hora do Sábado padrão já vem escolhida; a data vem do seletor, nada é digitado.
    expect(screen.getByRole('button', { name: 'Hora: 16:00' })).toBeOnTheScreen()
    await escolher(/^Data:/, new Date(2026, 10, 21, 12))
    expect(screen.getByRole('button', { name: /^Data: Sáb\., 21 de nov\. de 2026/ })).toBeTruthy()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)[0]?.corpo).toMatchObject({
      titulo: 'Sábado',
      categoria: 'Programação de sábado',
      modelo: 'sabado_padrao',
      // 16:00 em São Paulo.
      inicio: '2026-11-21T19:00:00.000Z',
      visibilidade: 'interna',
    })
    // Sem duração digitada, quem decide é a soma das etapas do modelo.
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)[0]?.corpo).not.toHaveProperty(
      'duracaoMin',
    )
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]',
        params: { eventoId: 'novo-1' },
      }),
    )
  })

  test('"Nova programação neste dia" (Agenda): a data já vem escolhida', async () => {
    parametros.mockReturnValue({ data: '2026-12-05' })
    await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    expect(
      await screen.findByRole('button', { name: /^Data: Sáb\., 5 de dez\. de 2026/ }),
    ).toBeOnTheScreen()
  })

  test('data no passado: publicar avisa antes; "Cancelar" não cria nada', async () => {
    // Quem erra o ano no calendário (M6). 04/01/2020 foi sábado.
    parametros.mockReturnValue({ modelo: 'sabado_padrao', data: '2020-01-04' })
    const alerta = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, botoes) => botoes?.[0]?.onPress?.())
    const { servidor } = await renderizarTela(<TelaNovoEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`POST ${BASE}/eventos`]: () => ({ status: 200, corpo: { id: 'novo-1', versao: 1 } }),
      },
    })

    expect(await screen.findByDisplayValue('Sábado')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() => expect(alerta).toHaveBeenCalled())
    expect(alerta.mock.calls[0]![0]).toBe('Esta data já passou')
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(0)
    alerta.mockRestore()
  })

  test('com algo mudado, fechar o formulário pergunta antes de descartar', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    const prevenir = usePreventRemove as jest.Mock
    await screen.findByRole('button', { name: 'Salvar rascunho' })
    expect(prevenir).toHaveBeenLastCalledWith(false, expect.any(Function))
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Luau')
    expect(prevenir).toHaveBeenLastCalledWith(true, expect.any(Function))
  })

  test('campos inválidos não vão à rede e mostram o erro junto do campo', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Salvar rascunho' }))

    expect(await screen.findByText('Dê um título com pelo menos 2 letras.')).toBeOnTheScreen()
    expect(screen.getByText('Escolha a data.')).toBeOnTheScreen()
    // O resumo do topo diz quantos campos faltam.
    expect(screen.getByText(/^Faltam \d+ campos$/)).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(0)
  })

  test('série semanal: cria pela rota de séries com a regra e a hora local', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`POST ${BASE}/series`]: () => ({ status: 200, corpo: { id: 'serie-1', ocorrencias: 26 } }),
      },
    })
    const usuario = userEvent.setup()

    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Sábado')
    await fireEvent.changeText(screen.getByLabelText('Categoria'), 'Programação de sábado')
    await escolher(/^Data:/, new Date(2026, 10, 21, 12))
    await escolher(/^Hora:/, new Date(2026, 10, 21, 16, 0))
    await fireEvent.changeText(screen.getByLabelText('Duração'), '60')
    await usuario.press(screen.getByRole('radio', { name: 'Toda semana' }))
    expect(await screen.findByText('Toda semana, aos sábados, às 16:00')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/series`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/series`)[0]?.corpo).toMatchObject({
      regra: { frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [6] },
      horaLocal: '16:00',
      inicioEm: '2026-11-21',
      duracaoMin: 60,
      publicar: true,
    })
  })
})

describe('editar programação', () => {
  beforeEach(() => jest.clearAllMocks())

  test('evento de série: salvar exige escolher o alcance; "só esta" faz PATCH no evento', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID })
    const { servidor } = await renderizarTela(<TelaEditarEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`GET ${CAMINHO}`]: () => ({
          status: 200,
          corpo: eventoDeTeste({ serieId: '55555555-5555-4555-8555-000000000001' }),
        }),
        [`PATCH ${CAMINHO}`]: () => ({ status: 200, corpo: { id: EVENTO_ID, versao: 4 } }),
      },
    })
    const usuario = userEvent.setup()

    const salvar = await screen.findByRole('button', { name: 'Salvar alterações' })
    expect(salvar).toBeDisabled()
    expect(
      screen.getByText('Escolha acima se a mudança vale só para esta ocorrência ou para a série.'),
    ).toBeOnTheScreen()

    await usuario.press(screen.getByRole('radio', { name: 'Só esta ocorrência' }))
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Sábado especial')
    await usuario.press(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(pedidosPara(servidor, 'PATCH', CAMINHO)).toHaveLength(1))
    expect(pedidosPara(servidor, 'PATCH', CAMINHO)[0]?.corpo).toEqual({
      versao: 3,
      titulo: 'Sábado especial',
    })
  })

  test('409: mostra a versão atual e deixa escolher, sem sobrescrever sozinho', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID })
    let leituras = 0
    const { servidor } = await renderizarTela(<TelaEditarEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`GET ${CAMINHO}`]: () => {
          leituras++
          // Na segunda leitura, outra pessoa já tinha trocado o título.
          return {
            status: 200,
            corpo:
              leituras === 1
                ? eventoDeTeste()
                : eventoDeTeste({ titulo: 'Sábado da Carla', versao: 4 }),
          }
        },
        [`PATCH ${CAMINHO}`]: () => ({
          status: 409,
          corpo: {
            erro: 'conflito',
            mensagem: 'Outra pessoa alterou isto enquanto você editava.',
            atual: { versao: 4 },
          },
        }),
      },
    })

    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Sábado especial')
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Outra pessoa salvou antes de você')).toBeOnTheScreen()
    expect(screen.getByText(/Título: na versão atual está "Sábado da Carla"/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Salvar a minha versão' })).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Descartar a minha e usar a atual' }),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'PATCH', CAMINHO)).toHaveLength(1)
  })
})

describe('cancelar ou adiar', () => {
  beforeEach(() => jest.clearAllMocks())

  test('motivo é obrigatório; com ele, cancela e volta', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID, acao: 'cancelar' })
    const { servidor } = await renderizarTela(<TelaMudarStatus />, {
      rotas: {
        [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }),
        [`POST ${CAMINHO}/status`]: () => ({ status: 200, corpo: { id: EVENTO_ID } }),
      },
    })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('button', { name: 'Cancelar evento' }))
    expect(
      await screen.findByText('Explique o motivo: ele vai para quem participa.'),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)

    await fireEvent.changeText(screen.getByLabelText('Motivo'), 'Chuva forte na região')
    await usuario.press(screen.getByRole('button', { name: 'Cancelar evento' }))

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)[0]?.corpo).toEqual({
        status: 'cancelado',
        motivo: 'Chuva forte na região',
      }),
    )
    await waitFor(() => expect(router.back).toHaveBeenCalled())
  })

  test('membro não cancela: a tela explica em vez de oferecer o botão', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID, acao: 'cancelar' })
    await renderizarTela(<TelaMudarStatus />, {
      papel: 'membro',
      rotas: { [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }) },
    })
    expect(await screen.findByText('Só a organização cancela ou adia eventos.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Cancelar evento' })).toBeNull()
  })
})
