import { screen, userEvent, waitFor } from '@testing-library/react-native'

import { ETAPAS, EVENTO_ID, retratoDeTeste } from '@/testes/fixturas'
import { BASE, COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast } from '@/ui/Toast'

import { AoVivo } from '../TelaAoVivo'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

const CAMINHO = `${BASE}/eventos/${EVENTO_ID}/ao-vivo`
/** O long polling fica "pendurado", como a API faz até a versão mudar. */
const pendurado = () => new Promise<never>(() => {})

describe('ao vivo', () => {
  test('mostra etapa atual, a seguir, atraso e acompanha por long polling', async () => {
    const { servidor } = await renderizarTela(
      <AoVivo comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />,
      {
        papel: 'membro',
        rotas: {
          [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: retratoDeTeste() }),
          [`GET ${CAMINHO}?depoisDaVersao=3`]: pendurado,
        },
      },
    )

    // A etapa atual é o cabeçalho grande; a seguinte aparece em "A seguir".
    expect(await screen.findByRole('header', { name: 'Louvor' })).toBeOnTheScreen()
    expect(screen.getByText('A seguir')).toBeOnTheScreen()
    // A conexão aparece em chip, com texto (não só a cor).
    expect(screen.getByText('Ao vivo')).toBeOnTheScreen()
    expect(screen.getAllByText('Encerramento').length).toBeGreaterThan(0)
    expect(screen.getByText(/Atraso acumulado: \d+ min de atraso/)).toBeOnTheScreen()
    expect(screen.getByText('1 de 3 etapas concluídas')).toBeOnTheScreen()
    // Membro acompanha, sem controles.
    expect(screen.queryByRole('button', { name: 'Avançar etapa' })).toBeNull()
    expect(
      screen.getByText('Você está acompanhando. Quem conduz o andamento é a organização.'),
    ).toBeOnTheScreen()
    await waitFor(() =>
      expect(servidor.pedidos.some((p) => p.url.endsWith('?depoisDaVersao=3'))).toBe(true),
    )
  })

  test('quem conduz avança com a versão que conhece', async () => {
    const depois = retratoDeTeste({ versao: 4, etapaAtualId: ETAPAS[2] })
    const { servidor } = await renderizarTela(
      <AoVivo comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />,
      {
        rotas: {
          [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: retratoDeTeste() }),
          [`GET ${CAMINHO}?depoisDaVersao=3`]: pendurado,
          [`GET ${CAMINHO}?depoisDaVersao=4`]: pendurado,
          [`POST ${CAMINHO}`]: () => ({ status: 200, corpo: depois }),
        },
      },
    )

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Avançar etapa' }))

    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', CAMINHO)[0]?.corpo).toEqual({
        comando: 'avancar',
        versao: 3,
      }),
    )
  })

  test('409: a tela troca para o estado atual e avisa num toast', async () => {
    const atual = retratoDeTeste({
      versao: 5,
      etapaAtualId: ETAPAS[2],
      condutor: { vinculoId: 'outro', nome: 'Bruno Lima', ate: '2026-11-21T20:00:00.000Z' },
      souCondutor: false,
      etapas: retratoDeTeste().etapas.map((e, i) => ({
        ...e,
        situacao: i < 2 ? 'concluida' : 'atual',
      })),
    })
    await renderizarTela(
      <>
        <AoVivo comunidadeId={COMUNIDADE} eventoId={EVENTO_ID} />
        <HospedeiroDeToast />
      </>,
      {
        rotas: {
          [`GET ${CAMINHO}`]: () => ({ status: 200, corpo: retratoDeTeste() }),
          [`GET ${CAMINHO}?depoisDaVersao=3`]: pendurado,
          [`GET ${CAMINHO}?depoisDaVersao=5`]: pendurado,
          [`POST ${CAMINHO}`]: () => ({
            status: 409,
            corpo: {
              erro: 'conduzido_por_outra_pessoa',
              mensagem: 'Outra pessoa está conduzindo agora.',
              atual,
            },
          }),
        },
      },
    )

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Avançar etapa' }))

    expect(
      await screen.findByText('O andamento mudou. Outra pessoa está conduzindo agora.'),
    ).toBeOnTheScreen()
    expect(
      screen.getByText('Bruno Lima está conduzindo. Você está acompanhando.'),
    ).toBeOnTheScreen()
    // Com outra pessoa no controle, a barra não oferece comandos: só "Assumir a condução".
    expect(screen.queryByRole('button', { name: 'Concluir a última etapa' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Avançar etapa' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Assumir a condução' })).toBeOnTheScreen()
  })
})
