import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { confirmar } from '@/utilidades/confirmar'
import { BASE, COMUNIDADE, MEU_VINCULO, pedidosPara, renderizarTela } from '@/testes/telas'

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
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Programação' }))
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

    await usuario.press(await screen.findByRole('radio', { name: 'Programação' }))
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
    expect(screen.queryByRole('button', { name: 'Cancelar evento' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull()

    await usuario.press(screen.getByRole('button', { name: 'Mais ações' }))
    expect(await screen.findByRole('button', { name: /^Duplicar/ })).toBeOnTheScreen()
    await usuario.press(screen.getByRole('button', { name: 'Cancelar evento' }))
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/evento/[eventoId]/status',
        params: { eventoId: EVENTO_ID, acao: 'cancelar' },
      }),
    )
  })

  test('rascunho: o primário é Publicar; a organização vê Quem serve e as notas internas', async () => {
    await montar('organizador', {}, eventoDeTeste({ status: 'rascunho' }))
    const usuario = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeOnTheScreen()
    expect(screen.getByText('Rascunho')).toBeOnTheScreen()

    await usuario.press(screen.getByRole('radio', { name: 'Quem serve' }))
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.getAllByRole('button', { name: /^Escalar pessoa/ }).length).toBeGreaterThan(0)
    await usuario.press(screen.getByRole('radio', { name: 'Preparação' }))
    expect(await screen.findByText('Notas internas')).toBeOnTheScreen()
  })

  test('membro não vê controles de organização nem notas, e não marca tarefa alheia', async () => {
    await montar('membro')
    const usuario = userEvent.setup()
    await screen.findByRole('radio', { name: 'Visão geral' })
    // Membro: sem barra de ação, sem "Quem serve", sem a lista de inscrições e sem check-in.
    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Quem serve' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Inscrições/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Check-in/ })).toBeNull()

    await usuario.press(screen.getByRole('radio', { name: 'Programação' }))
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
    expect(screen.getByRole('button', { name: 'Confirmar: Violão em Louvor' })).toBeOnTheScreen()
    // A inscrição continua a um toque, mas fora do cartão de destaque.
    expect(screen.getByRole('button', { name: 'Inscrever-me' })).toBeOnTheScreen()
  })

  test('evento de outra comunidade (404) mostra "não encontrada" com ação', async () => {
    await renderizarTela(<DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />, {
      rotas: {
        [`GET ${CAMINHO}`]: () => ({
          status: 404,
          corpo: { erro: 'nao_encontrado', mensagem: 'Não encontrado.' },
        }),
      },
    })
    expect(await screen.findByText('Programação não encontrada')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar para os programas' })).toBeOnTheScreen()
  })
})
