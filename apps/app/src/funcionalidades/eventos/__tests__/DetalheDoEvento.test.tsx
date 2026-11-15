import { screen, userEvent, waitFor } from '@testing-library/react-native'
import { router } from 'expo-router'

import { ETAPAS, EVENTO_ID, eventoDeTeste } from '@/testes/fixturas'
import { BASE, COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'

import { DetalheDoEvento } from '../DetalheDoEvento'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}`

function montar(papel: 'organizador' | 'membro', rotasExtras = {}) {
  return renderizarTela(<DetalheDoEvento comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />, {
    papel,
    rotas: {
      [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: eventoDeTeste() }),
      ...rotasExtras,
    },
  })
}

describe('detalhe do evento', () => {
  beforeEach(() => jest.clearAllMocks())

  test('etapas com hora prevista e quem cuida, lidas por inteiro pelo leitor de tela', async () => {
    await montar('organizador')
    expect(
      await screen.findByLabelText(
        'Etapa 2 de 3: Louvor. Das 16:05 a 16:20, 15 min. Com Bruno Lima (responsável).',
      ),
    ).toBeOnTheScreen()
  })

  test('organizador reordena por botão: "Descer Boas-vindas" manda a ordem nova', async () => {
    const { servidor } = await montar('organizador', {
      [`PUT ${CAMINHO}/etapas/ordem`]: () => ({ status: 200, corpo: { ok: true } }),
    })

    const descer = await screen.findByRole('button', { name: 'Descer Boas-vindas' })
    expect(screen.getByRole('button', { name: 'Subir Boas-vindas' })).toBeDisabled()
    await userEvent.setup().press(descer)

    await waitFor(() =>
      expect(pedidosPara(servidor, 'PUT', `${CAMINHO}/etapas/ordem`)[0]?.corpo).toEqual({
        ids: [ETAPAS[1], ETAPAS[0], ETAPAS[2]],
      }),
    )
  })

  test('cancelar leva à tela do motivo; a organização vê as notas internas', async () => {
    await montar('organizador')
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Cancelar evento' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/evento/[eventoId]/status',
      params: { eventoId: EVENTO_ID, acao: 'cancelar' },
    })
    expect(screen.getByText('Notas internas')).toBeOnTheScreen()
  })

  test('membro não vê controles de organização nem notas, e não marca tarefa alheia', async () => {
    await montar('membro')
    await screen.findByText('Programação')
    expect(screen.queryByRole('button', { name: 'Descer Boas-vindas' })).toBeNull()
    expect(screen.queryByText('Organização')).toBeNull()
    expect(screen.queryByText('Notas internas')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Inscrições' })).toBeNull()
    // A própria tarefa pode ser concluída; a de outra pessoa fica desabilitada, com o motivo.
    expect(screen.getByRole('checkbox', { name: 'Testar o som' })).toBeEnabled()
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
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen()
  })
})
