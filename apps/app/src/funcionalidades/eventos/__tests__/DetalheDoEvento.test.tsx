import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { confirmar } from '@/utilidades/confirmar'
import { BASE, COMUNIDADE, MEU_VINCULO, PESSOAS, pedidosPara, renderizarTela } from '@/testes/telas'
import { mostrarToast } from '@/ui/Toast'

import { DetalheDoEvento } from '../DetalheDoEvento'

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
// O diálogo de confirmação: o teste lê o que ele pergunta e responde.
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`

function montar(papel: 'organizador' | 'membro', rotasExtras = {}, evento = eventoDeTeste()) {
  return renderizarTela(<DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />, {
    papel,
    rotas: {
      [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: evento }),
      ...rotasExtras,
    },
  })
}

describe('detalhe do evento', () => {
  beforeEach(() => jest.clearAllMocks())

  test('etapas com hora prevista e quem cuida, lidas por inteiro pelo leitor de tela', async () => {
    await montar('organizador')
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Roteiro' }))
    expect(
      await screen.findByLabelText(
        'Etapa 2 de 3: Louvor. Das 16:05 a 16:20, 15 min. Com Bruno Lima (responsável).',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByText('Total 30 min de 30 min previstos')).toBeOnTheScreen()
  })

  test('organizador reordena por botão: "Descer Boas-vindas" manda a ordem nova', async () => {
    const { servidor } = await montar('organizador', {
      [`PUT ${CAMINHO}/etapas/ordem`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    const usuario = userEvent.setup()

    await usuario.press(await screen.findByRole('radio', { name: 'Roteiro' }))
    // Fora da edição, a ordem não se mexe por engano; "Editar etapas" mostra Subir e Descer.
    expect(screen.queryByRole('button', { name: 'Descer Boas-vindas' })).toBeNull()
    await usuario.press(screen.getByRole('button', { name: 'Editar etapas' }))

    const descer = await screen.findByRole('button', { name: 'Descer Boas-vindas' })
    expect(screen.getByRole('button', { name: 'Subir Boas-vindas' })).toBeDisabled()
    await usuario.press(descer)

    await waitFor(() =>
      expect(pedidosPara(servidor, 'PUT', `${CAMINHO}/etapas/ordem`)[0]?.corpo).toEqual({
        ids: [ETAPAS[1], ETAPAS[0], ETAPAS[2]],
      }),
    )
  })

  test('as ações ficam na barra e na folha "Mais ações": 2 botões visíveis', async () => {
    await montar('organizador')
    const usuario = userEvent.setup()

    // Publicado e fora do dia: o primário é Editar, ao lado do "Mais", com o texto à vista.
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeOnTheScreen()
    expect(screen.getByText('Mais')).toBeOnTheScreen()
    // Fora do dia, o check-in não ocupa a barra.
    expect(screen.queryByRole('button', { name: 'Check-in de presença' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar encontro' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull()

    await usuario.press(screen.getByRole('button', { name: 'Mais ações' }))
    expect(await screen.findByRole('button', { name: /^Duplicar/ })).toBeOnTheScreen()
    // D57: o menu separa o que organiza do que fica neste aparelho.
    expect(screen.getByRole('header', { name: 'Organizar' })).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Cancelar encontro' }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]/status',
        params: { eventoId: EVENTO_ID, acao: 'cancelar' },
      }),
    )
  })

  test('rascunho: o primário é Publicar; a organização vê Convocados e as notas internas', async () => {
    await montar('organizador', {}, eventoDeTeste({ status: 'rascunho' }))
    const usuario = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeOnTheScreen()
    expect(screen.getByText('Rascunho')).toBeOnTheScreen()

    await usuario.press(screen.getByRole('radio', { name: 'Convocados' }))
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    // No rascunho, o aviso fixo diz que ninguém recebe nada antes de publicar.
    expect(
      screen.getByText('Rascunho: ninguém recebe a convocação até você publicar.'),
    ).toBeOnTheScreen()
    expect(screen.getByText('1 convocado: 1 aceitou')).toBeOnTheScreen()
    expect(screen.getByText('Aceitou')).toBeOnTheScreen()
    expect(screen.getAllByRole('button', { name: /^Convocar pessoa/ }).length).toBeGreaterThan(0)
    await usuario.press(screen.getByRole('radio', { name: 'Preparação' }))
    expect(await screen.findByText('Notas internas')).toBeOnTheScreen()
  })

  test('"Convocar pessoa" abre a folha ali mesmo; quem já está na etapa vem desabilitado', async () => {
    const { servidor } = await montar(
      'organizador',
      {
        [`POST ${CAMINHO}/atribuicoes`]: () => ({
          status: 200,
          corpo: { id: 'atr-nova', estado: 'pendente' },
        }),
      },
      eventoDeTeste({ status: 'rascunho' }),
    )
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Convocados' }))
    await usuario.press(screen.getByRole('button', { name: /^Convocar pessoa: .*Louvor$/ }))
    // Sem a tela intermediária: a folha abre na própria seção.
    expect(router.push).not.toHaveBeenCalled()
    const bruno = await screen.findByRole('radio', { name: 'Bruno Lima' })
    expect(bruno).toBeDisabled()
    expect(screen.getByText('Já convocado')).toBeOnTheScreen()

    await usuario.press(screen.getByRole('radio', { name: 'Carla Dias' }))
    await usuario.press(screen.getByRole('button', { name: 'Convocar' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/atribuicoes`)[0]?.corpo).toEqual({
        vinculoId: PESSOAS[2]!.vinculoId,
        etapaId: ETAPAS[1],
        funcao: 'responsável',
      }),
    )
    // Rascunho: o toast não promete um aviso que ainda não saiu.
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Salvo. A pessoa recebe a convocação quando você publicar.',
      }),
    )
  })

  test('publicado: convocar avisa de verdade, e o toast diz isso', async () => {
    await montar('organizador', {
      [`POST ${CAMINHO}/atribuicoes`]: () => ({
        status: 200,
        corpo: { id: 'atr-nova', estado: 'pendente' },
      }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Convocados' }))
    expect(screen.queryByText(/^Rascunho: ninguém recebe/)).toBeNull()
    await usuario.press(screen.getByRole('button', { name: 'Convocar pessoa: encontro todo' }))
    await usuario.press(await screen.findByRole('radio', { name: 'Carla Dias' }))
    await usuario.press(screen.getByRole('button', { name: 'Convocar' }))
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Convocação enviada. A resposta aparece aqui.',
      }),
    )
  })

  test('ninguém convocado: o estado vazio convida a convocar e abre a folha', async () => {
    await montar('organizador', {}, eventoDeTeste({ atribuicoes: [] }))
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Convocados' }))
    expect(screen.getByText('Ninguém convocado ainda')).toBeOnTheScreen()
    expect(screen.getByText('Convoque quem vai servir neste encontro.')).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Convocar pessoa' }))
    expect(await screen.findByRole('radio', { name: 'Bruno Lima' })).toBeEnabled()
  })

  test('tocar na pessoa convocada oferece "Tirar da convocação", com confirmação', async () => {
    const { servidor } = await montar('organizador', {
      [`DELETE ${CAMINHO}/atribuicoes/atr-1`]: () => ({ status: 200, corpo: { ok: true } }),
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: 'Convocados' }))
    await usuario.press(
      screen.getByRole('button', { name: 'Bruno Lima, responsável. Convocação: Aceitou' }),
    )
    await usuario.press(await screen.findByRole('button', { name: /^Tirar da convocação/ }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${CAMINHO}/atribuicoes/atr-1`)).toHaveLength(1),
    )
    expect(jest.mocked(confirmar).mock.calls[0]![0]).toMatchObject({
      titulo: 'Tirar Bruno Lima da convocação?',
      confirmar: 'Tirar da convocação',
    })
  })

  test('membro não vê controles de organização nem notas, e não marca tarefa alheia', async () => {
    await montar('membro')
    const usuario = userEvent.setup()
    await screen.findByRole('radio', { name: 'Visão geral' })
    // Membro: sem barra de ação, sem "Convocados", sem a lista de inscrições e sem check-in.
    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Convocados' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Inscrições/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Check-in/ })).toBeNull()

    await usuario.press(screen.getByRole('radio', { name: 'Roteiro' }))
    expect(screen.queryByRole('button', { name: 'Editar etapas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Descer Boas-vindas' })).toBeNull()

    await usuario.press(screen.getByRole('radio', { name: 'Preparação' }))
    expect(screen.queryByText('Notas internas')).toBeNull()
    // A própria tarefa pode ser concluída; a de outra pessoa fica desabilitada, com o motivo.
    expect(await screen.findByRole('checkbox', { name: 'Testar o som' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Comprar o lanche' })).toBeDisabled()
  })

  test('no dia: "Check-in" na barra, ao lado de "Abrir ao vivo", e fora do "Mais"', async () => {
    // Começou há um minuto: é hoje em qualquer fuso, e o ao vivo já pode abrir.
    const agora = new Date(Date.now() - 60_000).toISOString()
    await montar('organizador', {}, eventoDeTeste({ inicio: agora }))
    const usuario = userEvent.setup()

    expect(await screen.findByRole('button', { name: 'Abrir ao vivo' })).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Check-in de presença' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/checkin',
      params: { eventoId: EVENTO_ID },
    })
    // Na barra e na linha da Visão geral; nada mais pede gesto ou menu.
    expect(screen.getAllByRole('button', { name: /^Check-in de presença/ })).toHaveLength(2)
  })

  test('Visão geral: a linha "Check-in" abre a presença, em qualquer dia', async () => {
    await montar('organizador')
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: /^Check-in de presença\. Marque/ }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/checkin',
      params: { eventoId: EVENTO_ID },
    })
  })

  test('rascunho com data no passado: publicar avisa antes', async () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString()
    const { servidor } = await montar(
      'organizador',
      { [`POST ${CAMINHO}/status`]: () => ({ status: 200, corpo: { ok: true } }) },
      eventoDeTeste({ status: 'rascunho', inicio: ontem }),
    )
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Publicar' }))
    await waitFor(() =>
      expect(confirmar).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Esta data já passou',
          confirmar: 'Publicar mesmo assim',
        }),
      ),
    )
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${CAMINHO}/status`)[0]?.corpo).toEqual({
        status: 'publicado',
      }),
    )
  })

  test('membro se inscreve e vê o código de entrada', async () => {
    const { servidor } = await montar('membro', {
      [`POST ${CAMINHO}/inscricoes/eu`]: () => ({
        status: 200,
        corpo: { inscricaoId: 'insc-1', estado: 'confirmada', codigoCheckin: 'A1B2C3D4E5' },
      }),
    })

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Inscrever-me' }))

    expect(await screen.findByText('A1B2C 3D4E5')).toBeOnTheScreen()
    expect(screen.getByText('Sua inscrição: Confirmada')).toBeOnTheScreen()
    expect(screen.getByRole('image', { name: /QR do seu código de entrada/ })).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${CAMINHO}/inscricoes/eu`)).toHaveLength(1)
  })

  test('escalado e inscrito: um só destaque (a participação); a entrada vira cartão comum', async () => {
    await montar(
      'membro',
      {},
      eventoDeTeste({
        atribuicoes: [
          {
            id: 'atr-eu',
            etapaId: ETAPAS[1],
            vinculoId: MEU_VINCULO,
            funcao: 'violão',
            estado: 'pendente',
            nome: 'Ana Souza',
          },
        ],
      }),
    )
    expect(await screen.findByText('Sua participação')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Aceitar: Violão em Louvor' })).toBeOnTheScreen()
    // A inscrição continua a um toque, mas fora do cartão de destaque.
    expect(screen.getByRole('button', { name: 'Inscrever-me' })).toBeOnTheScreen()
  })

  test('encontro de outra comunidade (404) mostra "não encontrado" com ação', async () => {
    await renderizarTela(<DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />, {
      rotas: {
        [`GET ${CAMINHO}`]: () => ({
          status: 404,
          corpo: { erro: 'nao_encontrado', mensagem: 'Não encontrado.' },
        }),
      },
    })
    expect(await screen.findByText('Encontro não encontrado')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar para a agenda' })).toBeOnTheScreen()
  })
})
