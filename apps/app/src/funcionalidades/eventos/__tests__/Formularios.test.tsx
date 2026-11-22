import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router'
import { Alert } from 'react-native'

import { DIA_DO_INICIO, EVENTO_ID, eventoDeTeste, INICIO } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast } from '@/ui/Toast'
import { confirmarAgora, reiniciarDesfazer } from '@/ui/ToastComDesfazer'

import { TelaEditarEvento } from '../TelaEditarEvento'
import { TelaMudarStatus } from '../TelaMudarStatus'
import { TelaNovoEvento } from '../TelaNovoEvento'

// Datas relativas a hoje: um sábado entre 7 e 13 dias à frente (o horário já
// passou se a data for fixa, e a tela recusa publicar no passado).
const [ANO, MES, DIA] = DIA_DO_INICIO.split('-').map(Number) as [number, number, number]
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DATA_ESCOLHIDA = new Date(ANO, MES - 1, DIA, 12)
const HORA_ESCOLHIDA = new Date(ANO, MES - 1, DIA, 16, 0)
const ROTULO_DA_DATA = new RegExp(`^Data: Sáb\\., ${DIA} de ${MESES[MES - 1]}\\. de ${ANO}`)

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

describe('criar encontro', () => {
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
    await escolher(/^Data:/, DATA_ESCOLHIDA)
    expect(screen.getByRole('button', { name: ROTULO_DA_DATA })).toBeTruthy()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Salvar rascunho' }))

    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)[0]?.corpo).toMatchObject({
      titulo: 'Sábado',
      categoria: 'Programação de sábado',
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

  test('o formulário é curto: título, data, hora e local; o resto fica dobrado em "Mais opções"', async () => {
    parametros.mockReturnValue({})
    await renderizarTela(<TelaNovoEvento />, { rotas: ROTAS_DO_FORMULARIO })
    const usuario = userEvent.setup()
    expect(await screen.findByLabelText('Título')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /^Data:/ })).toBeOnTheScreen()
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
    expect(screen.getByDisplayValue('Encontro')).toBeOnTheScreen()
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
    await escolher(/^Data:/, DATA_ESCOLHIDA)
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
    await escolher(/^Data:/, DATA_ESCOLHIDA)
    await escolher(/^Hora:/, HORA_ESCOLHIDA)
    await usuario.press(screen.getByRole('button', { name: 'Mais opções' }))
    await fireEvent.changeText(screen.getByLabelText('Duração'), '2')
    await usuario.press(screen.getByRole('button', { name: 'Mais opções' }))
    // Dobrou, mas a duração está inválida: ao salvar, a seção volta aberta com o erro.
    await usuario.press(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByText('Use minutos inteiros, de 5 a 1440.')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/eventos`)).toHaveLength(0)
  })

  test('"Novo encontro neste dia" (Agenda): a data já vem escolhida', async () => {
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
    await escolher(/^Data:/, DATA_ESCOLHIDA)
    await escolher(/^Hora:/, HORA_ESCOLHIDA)
    // A repetição mora em "Mais opções" (D69): o formulário curto não a mostra.
    expect(screen.queryByRole('radio', { name: 'Toda semana' })).toBeNull()
    await usuario.press(screen.getByRole('button', { name: 'Mais opções' }))
    await fireEvent.changeText(screen.getByLabelText('Categoria'), 'Programação de sábado')
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
    expect(screen.getByText(/Você tem 10 segundos para desfazer\./)).toBeOnTheScreen()
    await fireEvent.changeText(screen.getByLabelText('Motivo'), 'Falta de energia')
    await usuario.press(screen.getByRole('button', { name: 'Adiar o encontro' }))
    expect(await screen.findByText('10 s')).toBeOnTheScreen()
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

  test('adiar avisa gente: volta ao encontro e o aviso espera 10 s, com Desfazer', async () => {
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
