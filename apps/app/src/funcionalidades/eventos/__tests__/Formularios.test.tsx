import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { rotuloCurtoDoDia } from '@uj/dominio'
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router'
import { Alert, Dimensions } from 'react-native'

import { DIA_DO_INICIO, EVENTO_ID, eventoDeTeste, INICIO } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast } from '@/ui/Toast'
import {
  formatarDataPorExtenso,
  hojeNoFuso,
  instanteDeDataEHora,
  somarDias,
} from '@/utilidades/datas'
import { confirmarAgora, reiniciarDesfazer } from '@/ui/ToastComDesfazer'

import { TelaEditarEvento } from '../TelaEditarEvento'
import { TelaMudarStatus } from '../TelaMudarStatus'
import { TelaNovoEvento } from '../TelaNovoEvento'
import { diasDoAtalho, resumoDosDias } from '../variosDias'

// Datas relativas a hoje: um sábado entre 7 e 13 dias à frente (o horário já
// passou se a data for fixa, e a tela recusa publicar no passado).
const [ANO, MES, DIA] = DIA_DO_INICIO.split('-').map(Number) as [number, number, number]
const HORA_ESCOLHIDA = new Date(ANO, MES - 1, DIA, 16, 0)

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
const MODELO_PADRAO = {
  chave: 'sabado_padrao',
  nome: 'Encontro padrão',
  categoria: 'Programação semanal',
  descricao: 'Programação habitual do encontro, com cerca de uma hora.',
  etapas: [{ titulo: 'Boas-vindas', duracaoMin: 60 }],
  checklist: [],
}
const ROTAS_DO_FORMULARIO = {
  [`GET ${BASE}/modelos`]: () => ({
    status: 200,
    corpo: { embutidos: [MODELO_PADRAO], daComunidade: [] },
  }),
  [`GET ${BASE}/locais`]: () => ({ status: 200, corpo: { locais: [] } }),
}

/** O preset do Jest simula fonte grande (2x); a grade do mês só aparece com a fonte normal. */
function usarFonte(fontScale: number) {
  const janela = { width: 390, height: 844, scale: 3, fontScale }
  Dimensions.set({ window: janela, screen: janela })
}

/**
 * Marca um dia no calendário de vários dias (D78): vira o mês até achar o dia e toca nele. O nome do
 * dia é o que o leitor de tela diz ("sábado, 28 de novembro de 2026").
 */
async function marcarDia(data: string) {
  const usuario = userEvent.setup()
  const nome = formatarDataPorExtenso(data)
  for (let i = 0; i < 18; i++) {
    const celula = screen.queryByRole('checkbox', { name: nome })
    if (celula) {
      await usuario.press(celula)
      return
    }
    await usuario.press(screen.getByRole('button', { name: 'Próximo mês' }))
  }
  throw new Error(`O dia ${data} não apareceu no calendário.`)
}

describe('criar encontro', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    usarFonte(1)
  })

  test('Encontro padrão: a hora já vem, o título nasce com o nome do dia e o rascunho sai com o modelo', async () => {
    parametros.mockReturnValue({ modelo: 'sabado_padrao' })
    const { servidor } = await renderizarTela(<TelaNovoEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`POST ${BASE}/eventos`]: () => ({ status: 200, corpo: { id: 'novo-1', versao: 1 } }),
      },
    })

    // O modelo não impõe dia: sem data escolhida, o título é "Encontro".
    expect(await screen.findByDisplayValue('Encontro')).toBeOnTheScreen()
    expect(screen.getByText('Nenhum dia escolhido.')).toBeOnTheScreen()
    // A hora do Encontro padrão já vem escolhida; o dia vem do calendário, nada é digitado.
    expect(screen.getByRole('button', { name: 'Hora: 16:00' })).toBeOnTheScreen()
    await marcarDia(DIA_DO_INICIO)
    // Marcou um sábado: o título acompanha o dia.
    expect(await screen.findByDisplayValue('Sábado')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)[0]?.corpo).toMatchObject({
      titulo: 'Sábado',
      categoria: 'Programação semanal',
      modelo: 'sabado_padrao',
      // 16:00 em São Paulo.
      inicio: INICIO,
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

  test('o título acompanha o dia escolhido: domingo vira "Domingo", quarta vira "Quarta"', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    // O dia do INICIO é um sábado: o dia seguinte é domingo; três dias depois, terça... e quarta.
    const domingo = somarDias(DIA_DO_INICIO, 1)
    const quarta = somarDias(DIA_DO_INICIO, 4)
    await screen.findByLabelText('Título')
    await marcarDia(domingo)
    expect(await screen.findByDisplayValue('Domingo')).toBeOnTheScreen()
    // Trocou o dia sem ter escrito título: o título vai junto.
    await marcarDia(domingo)
    await marcarDia(quarta)
    expect(await screen.findByDisplayValue('Quarta')).toBeOnTheScreen()
    expect(screen.queryByDisplayValue('Domingo')).toBeNull()
  })

  test('o título que a pessoa escreveu nunca é trocado, mesmo mudando o dia', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`POST ${BASE}/eventos`]: () => ({ status: 200, corpo: { id: 'novo-3', versao: 1 } }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Culto de jovens')
    await marcarDia(somarDias(DIA_DO_INICIO, 1))
    await escolher(/^Hora:/, HORA_ESCOLHIDA)
    expect(screen.getByDisplayValue('Culto de jovens')).toBeOnTheScreen()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)[0]?.corpo).toMatchObject({
      titulo: 'Culto de jovens',
    })
  })

  test('título apagado e salvo em branco: vale o nome do dia (nunca vai vazio)', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`POST ${BASE}/eventos`]: () => ({ status: 200, corpo: { id: 'novo-4', versao: 1 } }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Algo')
    await fireEvent.changeText(screen.getByLabelText('Título'), '')
    await marcarDia(somarDias(DIA_DO_INICIO, 1))
    await escolher(/^Hora:/, HORA_ESCOLHIDA)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)[0]?.corpo).toMatchObject({
      titulo: 'Domingo',
    })
  })

  test('o formulário é curto: quando, título, local; o resto fica dobrado em "Mais opções"', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    const usuario = userEvent.setup()
    expect(await screen.findByLabelText('Título')).toBeOnTheScreen()
    expect(screen.getByText('Quando?')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Esta semana' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Fim de semana' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Hora:/ })).toBeOnTheScreen()
    expect(screen.getByText('Onde')).toBeOnTheScreen()
    // Categoria, duração, quem vê e repetição só depois de abrir.
    expect(screen.queryByLabelText('Categoria')).toBeNull()
    expect(screen.queryByLabelText('Duração')).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Toda semana' })).toBeNull()
    await usuario.press(screen.getByRole('button', { name: 'Mais opções' }))
    expect(await screen.findByLabelText('Categoria')).toBeOnTheScreen()
    expect(screen.getByLabelText('Duração')).toBeOnTheScreen()
    expect(screen.getByText('Repetição')).toBeOnTheScreen()
    // Em branco, o caminho curto já tem categoria e duração: o líder só preenche o essencial.
    expect(screen.getByLabelText('Categoria')).toHaveDisplayValue('Encontro')
    expect(screen.getByDisplayValue('60')).toBeOnTheScreen()
  })

  test('só com o essencial (em branco), cria o rascunho com os padrões', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`POST ${BASE}/eventos`]: () => ({ status: 200, corpo: { id: 'novo-2', versao: 1 } }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Noite de Louvor')
    await marcarDia(DIA_DO_INICIO)
    await escolher(/^Hora:/, HORA_ESCOLHIDA)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)[0]?.corpo).toMatchObject({
      titulo: 'Noite de Louvor',
      categoria: 'Encontro',
      duracaoMin: 60,
      inicio: INICIO,
    })
  })

  test('erro em campo escondido abre "Mais opções" sozinho, para o campo com erro ficar à vista', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    const usuario = userEvent.setup()
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Luau')
    await marcarDia(DIA_DO_INICIO)
    await escolher(/^Hora:/, HORA_ESCOLHIDA)
    await usuario.press(screen.getByRole('button', { name: 'Mais opções' }))
    await fireEvent.changeText(screen.getByLabelText('Duração'), '2')
    await usuario.press(screen.getByRole('button', { name: 'Mais opções' }))
    // Dobrou, mas a duração está inválida: ao salvar, a seção volta aberta com o erro.
    await usuario.press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByText('Use minutos inteiros, de 5 a 1440.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(0)
  })

  test('"Novo encontro neste dia" (Agenda): o dia já vem marcado e o título é o dele', async () => {
    parametros.mockReturnValue({ data: '2026-12-05' })
    await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    expect(await screen.findByText('Sábado, 5 de dezembro')).toBeOnTheScreen()
    expect(
      screen.getByRole('checkbox', { name: formatarDataPorExtenso('2026-12-05') }),
    ).toBeChecked()
    expect(screen.getByDisplayValue('Sábado')).toBeOnTheScreen()
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

  test('já existe encontro nessa data: a tela avisa e salvar pergunta "Criar outro mesmo assim?" (D74)', async () => {
    parametros.mockReturnValue({ data: '2026-12-05' })
    const alerta = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, botoes) => botoes?.[0]?.onPress?.())
    await renderizarTela(<TelaNovoEvento />, {
      rotas: {
        ...ROTAS_DO_FORMULARIO,
        [`GET ${BASE}/eventos`]: () => ({
          status: 200,
          corpo: {
            eventos: [
              {
                id: 'ja-existe',
                titulo: 'Sábado Jovem',
                categoria: 'Encontro',
                inicio: '2026-12-05T19:00:00.000Z',
                duracaoMin: 60,
                fuso: 'America/Sao_Paulo',
                status: 'publicado',
                visibilidade: 'publica',
                serieId: null,
                versao: 1,
                localNome: null,
                localTipo: null,
                quantidadeDeEtapas: 3,
              },
            ],
          },
        }),
        [`POST ${BASE}/eventos`]: () => ({ status: 200, corpo: { id: 'novo-1', versao: 1 } }),
      },
    })
    expect(
      await screen.findByText(
        'Já existe um encontro neste dia: Sábado Jovem, 16:00. Se criar este também, a Agenda terá os dois.',
      ),
    ).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Outro encontro')
    await escolher(/^Hora:/, HORA_ESCOLHIDA)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    // O diálogo pergunta antes; o primeiro botão ("Criar outro mesmo assim") confirma, então cria.
    await waitFor(() => expect(alerta).toHaveBeenCalled())
    expect(alerta.mock.calls[0]![0]).toBe('Já existe um encontro neste dia')
    expect(alerta.mock.calls[0]![1]).toBe(
      'Já existe um encontro neste dia: Sábado Jovem, 16:00. Criar outro mesmo assim?',
    )
    expect(JSON.stringify(alerta.mock.calls[0]![2])).toContain('Criar outro mesmo assim')
    alerta.mockRestore()
  })

  test('com algo mudado, voltar do formulário pergunta antes de descartar', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    const prevenir = usePreventRemove as jest.Mock
    await screen.findByRole('button', { name: 'Salvar rascunho' })
    expect(prevenir).toHaveBeenLastCalledWith(false, expect.any(Function))
    await fireEvent.changeText(screen.getByLabelText('Título'), 'Luau')
    expect(prevenir).toHaveBeenLastCalledWith(true, expect.any(Function))
  })

  test('marcar um dia também conta como mudança a descartar', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    const prevenir = usePreventRemove as jest.Mock
    await screen.findByRole('button', { name: 'Salvar rascunho' })
    await marcarDia(DIA_DO_INICIO)
    expect(prevenir).toHaveBeenLastCalledWith(true, expect.any(Function))
  })

  test('campos inválidos não vão à rede e mostram o erro junto do campo', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Salvar rascunho' }))

    // O título nunca falta (o nome do dia); faltam o dia e a hora.
    expect(await screen.findByText('Escolha pelo menos um dia no calendário.')).toBeOnTheScreen()
    expect(screen.getByText('Escolha a hora.')).toBeOnTheScreen()
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

    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Culto semanal')
    await marcarDia(DIA_DO_INICIO)
    await escolher(/^Hora:/, HORA_ESCOLHIDA)
    // A repetição mora em "Mais opções" (D69): o formulário curto não a mostra.
    expect(screen.queryByRole('radio', { name: 'Toda semana' })).toBeNull()
    await usuario.press(screen.getByRole('button', { name: 'Mais opções' }))
    await fireEvent.changeText(screen.getByLabelText('Categoria'), 'Programação semanal')
    await fireEvent.changeText(screen.getByLabelText('Duração'), '60')
    await usuario.press(await screen.findByRole('radio', { name: 'Toda semana' }))
    expect(await screen.findByText('Toda semana, aos sábados, às 16:00')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/series`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/series`)[0]?.corpo).toMatchObject({
      regra: { frequencia: 'semanal', intervaloSemanas: 1, diasDaSemana: [6] },
      horaLocal: '16:00',
      inicioEm: DIA_DO_INICIO,
      duracaoMin: 60,
      publicar: true,
    })
  })
})

describe('criar vários dias de uma vez (D78)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    usarFonte(1)
  })

  const SEXTA = somarDias(DIA_DO_INICIO, -1)
  const SABADO_DO_INICIO = DIA_DO_INICIO
  const DOMINGO = somarDias(DIA_DO_INICIO, 1)

  const rotasDoLote = (extras: object = {}) => ({
    ...ROTAS_DO_FORMULARIO,
    [`POST ${BASE}/eventos/em-lote`]: () => ({
      status: 200,
      corpo: { eventos: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }] },
    }),
    ...extras,
  })

  test('marcar três dias mostra "3 encontros: sex, sáb, dom" antes de criar', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: rotasDoLote() })
    await screen.findByLabelText('Título')
    await marcarDia(SEXTA)
    await marcarDia(SABADO_DO_INICIO)
    await marcarDia(DOMINGO)
    expect(
      await screen.findByText(
        `3 encontros: ${[SEXTA, SABADO_DO_INICIO, DOMINGO].map(rotuloCurtoDoDia).join(', ')}`,
      ),
    ).toBeOnTheScreen()
    // Sem título escrito, cada encontro leva o nome do dia (o campo fica vazio, com a explicação).
    expect(
      screen.getByText('Em branco, cada encontro leva o nome do próprio dia.'),
    ).toBeOnTheScreen()
    // Cada dia marcado mostra o check e diz que está marcado.
    expect(screen.getByRole('checkbox', { name: formatarDataPorExtenso(SEXTA) })).toBeChecked()
    // Desmarcar tira o dia.
    await userEvent
      .setup()
      .press(screen.getByRole('checkbox', { name: formatarDataPorExtenso(SEXTA) }))
    expect(
      await screen.findByText(
        `2 encontros: ${[SABADO_DO_INICIO, DOMINGO].map(rotuloCurtoDoDia).join(', ')}`,
      ),
    ).toBeOnTheScreen()
  })

  test('cria um encontro por dia numa chamada só, com a mesma hora, sem título (o nome do dia)', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, { rotas: rotasDoLote() })
    await screen.findByLabelText('Título')
    await marcarDia(SABADO_DO_INICIO)
    await marcarDia(DOMINGO)
    await escolher(/^Hora/, HORA_ESCOLHIDA)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/em-lote`)).toHaveLength(1),
    )
    const corpo = pedidosPara(servidor, 'POST', `${BASE}/eventos/em-lote`)[0]?.corpo
    expect(corpo).toMatchObject({
      categoria: 'Encontro',
      duracaoMin: 60,
      publicar: true,
      dias: [
        { data: SABADO_DO_INICIO, hora: '16:00' },
        { data: DOMINGO, hora: '16:00' },
      ],
    })
    expect(corpo).not.toHaveProperty('titulo')
    // Nenhum POST de encontro avulso nem de série.
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(0)
    expect(pedidosPara(servidor, 'POST', `${BASE}/series`)).toHaveLength(0)
    // Volta para a Agenda dizendo o que criou.
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/agenda',
        params: { vista: 'lista' },
      }),
    )
  })

  test('título escrito vale para todos os dias', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, { rotas: rotasDoLote() })
    await fireEvent.changeText(await screen.findByLabelText('Título'), 'Retiro de jovens')
    await marcarDia(SABADO_DO_INICIO)
    await marcarDia(DOMINGO)
    await escolher(/^Hora/, HORA_ESCOLHIDA)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/em-lote`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/em-lote`)[0]?.corpo).toMatchObject({
      titulo: 'Retiro de jovens',
      publicar: false,
    })
  })

  test('"Horários diferentes": cada dia pode ter a própria hora', async () => {
    parametros.mockReturnValue({})
    const { servidor } = await renderizarTela(<TelaNovoEvento />, { rotas: rotasDoLote() })
    const usuario = userEvent.setup()
    await screen.findByLabelText('Título')
    await marcarDia(SABADO_DO_INICIO)
    await marcarDia(DOMINGO)
    await escolher(/^Hora/, HORA_ESCOLHIDA)
    await usuario.press(screen.getByRole('button', { name: /^Horários diferentes\. Recolhido/ }))
    // Domingo às 10:00; o sábado segue na hora de todos.
    await escolher(
      new RegExp(`^${resumoDosDias([DOMINGO])}`),
      new Date(ANO, MES - 1, DIA + 1, 10, 0),
    )
    expect(await screen.findByText('Horários diferentes (1)')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/em-lote`)).toHaveLength(1),
    )
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/em-lote`)[0]?.corpo).toMatchObject({
      dias: [
        { data: SABADO_DO_INICIO, hora: '16:00' },
        { data: DOMINGO, hora: '10:00' },
      ],
    })
  })

  test('atalho "Fim de semana": marca sábado e domingo de uma vez', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: rotasDoLote() })
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Fim de semana' }))
    const dias = diasDoAtalho('fim_de_semana', hojeNoFuso('America/Sao_Paulo'))
    expect(dias.length).toBeGreaterThan(0)
    expect(await screen.findByText(resumoDosDias(dias))).toBeOnTheScreen()
  })

  test('mais de um dia desliga a repetição e avisa que cada dia é um encontro próprio', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: rotasDoLote() })
    const usuario = userEvent.setup()
    await screen.findByLabelText('Título')
    await marcarDia(SABADO_DO_INICIO)
    await marcarDia(DOMINGO)
    await usuario.press(screen.getByRole('button', { name: 'Mais opções' }))
    expect(screen.queryByRole('radio', { name: 'Toda semana' })).toBeNull()
    expect(screen.getByText(/^A repetição vale para um dia só/)).toBeOnTheScreen()
    expect(screen.getByText('Encontros independentes')).toBeOnTheScreen()
  })

  test('dias já ocupados: a tela avisa quais, e criar pergunta antes', async () => {
    parametros.mockReturnValue({})
    const alerta = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, botoes) => botoes?.[1]?.onPress?.())
    const { servidor } = await renderizarTela(<TelaNovoEvento />, {
      rotas: rotasDoLote({
        [`GET ${BASE}/eventos`]: () => ({
          status: 200,
          corpo: {
            eventos: [
              {
                id: 'ja-existe',
                titulo: 'Noite de jogos',
                categoria: 'Encontro',
                inicio: instanteDeDataEHora(DOMINGO, '19:30', 'America/Sao_Paulo'),
                duracaoMin: 60,
                fuso: 'America/Sao_Paulo',
                status: 'publicado',
                visibilidade: 'publica',
                serieId: null,
                versao: 1,
                localNome: null,
                localTipo: null,
                quantidadeDeEtapas: 0,
              },
            ],
          },
        }),
      }),
    })
    await screen.findByLabelText('Título')
    await marcarDia(SABADO_DO_INICIO)
    await marcarDia(DOMINGO)
    expect(
      await screen.findByText(
        `Já existe encontro em ${rotuloCurtoDoDia(DOMINGO)} (Noite de jogos, 19:30). Se criar estes também, a Agenda terá os dois.`,
      ),
    ).toBeOnTheScreen()
    await escolher(/^Hora/, HORA_ESCOLHIDA)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(alerta).toHaveBeenCalled())
    expect(alerta.mock.calls[0]![0]).toBe('Já existe encontro nesses dias')
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/eventos/em-lote`)).toHaveLength(1),
    )
    alerta.mockRestore()
  })

  test('com fonte grande o mês vira uma lista de dias com caixa de marcar', async () => {
    usarFonte(2)
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: rotasDoLote() })
    const usuario = userEvent.setup()
    await screen.findByLabelText('Título')
    // Sem a grade de sete colunas: cada dia é uma linha.
    expect(
      screen.queryByRole('checkbox', { name: formatarDataPorExtenso(SABADO_DO_INICIO) }),
    ).toBeNull()
    for (const dia of [SABADO_DO_INICIO, DOMINGO]) {
      const nome = formatarDataPorExtenso(dia, false)
      for (let i = 0; i < 18 && !screen.queryByRole('checkbox', { name: nome }); i++) {
        await usuario.press(screen.getByRole('button', { name: 'Próximo mês' }))
      }
      await usuario.press(screen.getByRole('checkbox', { name: nome }))
    }
    expect(
      await screen.findByText(
        `2 encontros: ${[SABADO_DO_INICIO, DOMINGO].map(rotuloCurtoDoDia).join(', ')}`,
      ),
    ).toBeOnTheScreen()
    usarFonte(1)
  })

  test('o servidor recusa o lote: erro em palavras e nada de navegar', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, {
      rotas: rotasDoLote({
        [`POST ${BASE}/eventos/em-lote`]: () => ({
          status: 400,
          corpo: { erro: 'dados_invalidos', mensagem: 'Escolha até 14 dias.' },
        }),
      }),
    })
    await screen.findByLabelText('Título')
    await marcarDia(SABADO_DO_INICIO)
    await marcarDia(DOMINGO)
    await escolher(/^Hora/, HORA_ESCOLHIDA)
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByText('O encontro não foi salvo')).toBeOnTheScreen()
    expect(router.replace).not.toHaveBeenCalled()
  })
})

describe('editar encontro', () => {
  beforeEach(() => jest.clearAllMocks())

  test('encontro que se repete: salvar exige escolher o alcance; "só esta" faz PATCH no evento', async () => {
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
      screen.getByText('Escolha acima se a mudança vale só para esta data ou para a repetição.'),
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
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarDesfazer()
  })
  afterEach(() => reiniciarDesfazer())

  test('abre SEM escolha feita: "Adiar" e "Cancelar" lado a lado, cada um com o que faz, e o botão pede a escolha (D74)', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID })
    const { servidor } = await renderizarTela(<TelaMudarStatus />, {
      rotas: {
        [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }),
        [`POST ${CAMINHO}/status`]: () => ({ status: 200, corpo: { id: EVENTO_ID } }),
      },
    })
    const adiar = await screen.findByRole('radio', { name: 'Adiar' })
    const cancelar = screen.getByRole('radio', { name: 'Cancelar' })
    expect(adiar).not.toBeChecked()
    expect(cancelar).not.toBeChecked()
    // O que cada um faz, escrito antes de escolher.
    expect(
      screen.getByText(/o encontro continua, em outra data\. Quem participa é avisado\./),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(
        /o encontro termina e não volta\. Quem participa é avisado\. Isto não se desfaz\./,
      ),
    ).toBeOnTheScreen()
    // Nenhum botão de ação da frente: só o pedido para escolher, desabilitado, e sem formulário.
    expect(screen.queryByRole('button', { name: 'Adiar o encontro' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar o encontro' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Escolha adiar ou cancelar' })).toBeDisabled()
    expect(screen.queryByLabelText('Motivo')).toBeNull()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)
  })

  test('escolher "Cancelar": diz "Isto não se desfaz", quantas pessoas serão avisadas e pede o motivo', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID })
    await renderizarTela(<TelaMudarStatus />, {
      rotas: { [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }) },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Cancelar' }))
    expect(screen.getByText('Isto não se desfaz')).toBeOnTheScreen()
    expect(
      screen.getByText(/Vai avisar 1 pessoa convocada e quem se inscreveu\./),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Cancelar o encontro' })).toBeEnabled()
    expect(screen.getByLabelText('Motivo')).toBeOnTheScreen()
  })

  test('escolher "Adiar": o texto da contagem diz o mesmo número de segundos que a faixa conta', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID })
    await renderizarTela(
      <>
        <TelaMudarStatus />
        <HospedeiroDeToast />
      </>,
      { rotas: { [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }) } },
    )
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Adiar' }))
    expect(screen.getByText(/Você tem 5 segundos para desfazer\./)).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Motivo'), 'Falta de energia')
    await usuario.press(screen.getByRole('button', { name: 'Adiar o encontro' }))
    expect(await screen.findByText('5 s')).toBeOnTheScreen()
  })

  test('motivo é obrigatório; com ele, cancela e volta', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID, acao: 'cancelar' })
    const { servidor } = await renderizarTela(<TelaMudarStatus />, {
      rotas: {
        [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }),
        [`POST ${CAMINHO}/status`]: () => ({ status: 200, corpo: { id: EVENTO_ID } }),
      },
    })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('button', { name: 'Cancelar o encontro' }))
    expect(
      await screen.findByText('Explique o motivo: ele vai para quem participa.'),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)

    await fireEvent.changeText(screen.getByLabelText('Motivo'), 'Chuva forte na região')
    await usuario.press(screen.getByRole('button', { name: 'Cancelar o encontro' }))

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
    expect(await screen.findByText('Só a organização cancela ou adia encontros.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Cancelar o encontro' })).toBeNull()
  })

  test('a consequência vem escrita: "Vai avisar 1 pessoa convocada e quem se inscreveu."', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID, acao: 'cancelar' })
    await renderizarTela(<TelaMudarStatus />, {
      rotas: { [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }) },
    })
    expect(
      await screen.findByText(/Vai avisar 1 pessoa convocada e quem se inscreveu\./),
    ).toBeOnTheScreen()
    // Os dois caminhos na mesma tela: adiar e cancelar.
    expect(screen.getByRole('radio', { name: 'Cancelar' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Adiar' })).toBeOnTheScreen()
  })

  test('adiar avisa gente: volta ao encontro e o aviso espera 5 s, com Desfazer', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID, acao: 'adiar' })
    const { servidor } = await renderizarTela(
      <>
        <TelaMudarStatus />
        <HospedeiroDeToast />
      </>,
      {
        rotas: {
          [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }),
          [`POST ${CAMINHO}/status`]: () => ({ status: 200, corpo: { id: EVENTO_ID } }),
        },
      },
    )
    const usuario = userEvent.setup()
    expect(await screen.findByRole('radio', { name: 'Adiar' })).toBeChecked()
    await fireEvent.changeText(screen.getByLabelText('Motivo'), 'Falta de energia no salão')
    await usuario.press(screen.getByRole('button', { name: 'Adiar o encontro' }))

    expect(await screen.findByText('Adiando e avisando 1 pessoa.')).toBeOnTheScreen()
    expect(router.back).toHaveBeenCalled()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)[0]?.corpo).toEqual({
        status: 'adiado',
        motivo: 'Falta de energia no salão',
      }),
    )
  })

  test('adiar e desistir: Desfazer não envia nada', async () => {
    parametros.mockReturnValue({ eventoId: EVENTO_ID, acao: 'adiar' })
    const { servidor } = await renderizarTela(
      <>
        <TelaMudarStatus />
        <HospedeiroDeToast />
      </>,
      { rotas: { [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }) } },
    )
    const usuario = userEvent.setup()
    await fireEvent.changeText(await screen.findByLabelText('Motivo'), 'Falta de energia')
    await usuario.press(screen.getByRole('button', { name: 'Adiar o encontro' }))
    await usuario.press(await screen.findByRole('button', { name: 'Desfazer' }))
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)).toHaveLength(0)
  })
})
