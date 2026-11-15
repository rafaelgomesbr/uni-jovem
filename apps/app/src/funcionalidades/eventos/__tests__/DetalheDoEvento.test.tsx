import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, COMUNIDADE, MEU_VINCULO, pedidosPara, renderizarTela } from '@/testes/telas'

import { DetalheDoEvento } from '../DetalheDoEvento'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
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
    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Etapas' }))
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

    await usuario.press(await screen.findByRole('radio', { name: 'Etapas' }))
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

    // Publicado e fora do dia: o primário é Editar, ao lado do "Mais ações".
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeOnTheScreen()
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

  test('rascunho: o primário é Publicar; a organização vê Equipe e as notas internas', async () => {
    await montar('organizador', {}, eventoDeTeste({ status: 'rascunho' }))
    const usuario = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Publicar' })).toBeOnTheScreen()
    expect(screen.getByText('Rascunho')).toBeOnTheScreen()

    await usuario.press(screen.getByRole('radio', { name: 'Equipe' }))
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.getAllByRole('button', { name: /^Escalar pessoa/ }).length).toBeGreaterThan(0)
    await usuario.press(screen.getByRole('radio', { name: 'Preparação' }))
    expect(await screen.findByText('Notas internas')).toBeOnTheScreen()
  })

  test('membro não vê controles de organização nem notas, e não marca tarefa alheia', async () => {
    await montar('membro')
    const usuario = userEvent.setup()
    await screen.findByRole('radio', { name: 'Visão geral' })
    // Membro: sem barra de ação, sem "Equipe" e sem a lista de inscrições.
    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Equipe' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Inscrições/ })).toBeNull()

    await usuario.press(screen.getByRole('radio', { name: 'Etapas' }))
    expect(screen.queryByRole('button', { name: 'Editar etapas' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Descer Boas-vindas' })).toBeNull()

    await usuario.press(screen.getByRole('radio', { name: 'Preparação' }))
    expect(screen.queryByText('Notas internas')).toBeNull()
    // A própria tarefa pode ser concluída; a de outra pessoa fica desabilitada, com o motivo.
    expect(await screen.findByRole('checkbox', { name: 'Testar o som' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Comprar o lanche' })).toBeDisabled()
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
