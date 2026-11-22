import { fireEvent, screen, waitFor } from '@testing-library/react-native'

import { BASE, COMUNIDADE, pedidosPara, renderizarTela } from '@/testes/telas'
import { confirmar } from '@/utilidades/confirmar'
import { HospedeiroDeToast } from '@/ui/Toast'

import { BotaoDenunciar } from '../BotaoDenunciar'
import { TelaPessoasBloqueadas } from '../TelaPessoasBloqueadas'

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

jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))

const PEDIDO = '33333333-3333-4333-8333-000000000001'

beforeEach(() => {
  jest.mocked(confirmar).mockReset()
})

describe('bloquear esta pessoa (junto do Denunciar)', () => {
  test('confirma explicando o que muda e, ao confirmar, bloqueia pelo conteúdo', async () => {
    const { servidor } = await renderizarTela(
      <>
        <BotaoDenunciar
          comunidadeId={COMUNIDADE}
          recursoTipo="pedido_oracao"
          recursoId={PEDIDO}
          descricao="o pedido de Bruno Lima"
        />
        <HospedeiroDeToast />
      </>,
      {
        papel: 'membro',
        rotas: {
          [`POST ${BASE}/bloqueios`]: () => ({
            status: 200,
            corpo: { id: 'b1', mensagem: 'Pronto.' },
          }),
        },
      },
    )
    expect(screen.getByRole('button', { name: 'Denunciar' })).toBeOnTheScreen()
    const bloquear = screen.getByRole('button', {
      name: 'Bloquear esta pessoa, quem escreveu o pedido de Bruno Lima',
    })

    // Cancelar a confirmação não manda nada.
    jest.mocked(confirmar).mockResolvedValueOnce(false)
    await fireEvent.press(bloquear)
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1))
    const pedidoDeConfirmacao = jest.mocked(confirmar).mock.calls[0]![0]
    expect(pedidoDeConfirmacao).toMatchObject({
      titulo: 'Bloquear esta pessoa?',
      confirmar: 'Bloquear',
      destrutivo: true,
    })
    // A confirmação diz o alcance, que a pessoa não é avisada e como desfazer.
    expect(pedidoDeConfirmacao.mensagem).toMatch(/só nesta comunidade/)
    expect(pedidoDeConfirmacao.mensagem).toMatch(/não é avisada/)
    expect(pedidoDeConfirmacao.mensagem).toMatch(/Avisos e encontros continuam/)
    expect(pedidoDeConfirmacao.mensagem).toMatch(/Pessoas bloqueadas/)
    expect(pedidosPara(servidor, 'POST', `${BASE}/bloqueios`)).toHaveLength(0)

    jest.mocked(confirmar).mockResolvedValueOnce(true)
    await fireEvent.press(bloquear)
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/bloqueios`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/bloqueios`)[0]!.corpo).toEqual({
      recursoTipo: 'pedido_oracao',
      recursoId: PEDIDO,
    })
    expect(await screen.findByText('Pessoa bloqueada. Ela não é avisada.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeOnTheScreen()
  })

  test('sem pessoa a identificar (sugestão anônima), a tela desliga o bloqueio', async () => {
    await renderizarTela(
      <BotaoDenunciar
        comunidadeId={COMUNIDADE}
        recursoTipo="sugestao"
        recursoId={PEDIDO}
        descricao='a sugestão "Lanche"'
        podeBloquear={false}
      />,
      { papel: 'organizador' },
    )
    expect(screen.getByRole('button', { name: 'Denunciar' })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /^Bloquear esta pessoa/ })).toBeNull()
  })

  test('a recusa da API vira mensagem em linguagem humana', async () => {
    jest.mocked(confirmar).mockResolvedValue(true)
    await renderizarTela(
      <BotaoDenunciar
        comunidadeId={COMUNIDADE}
        recursoTipo="sugestao"
        recursoId={PEDIDO}
        descricao='a sugestão "Lanche"'
      />,
      {
        papel: 'organizador',
        rotas: {
          [`POST ${BASE}/bloqueios`]: () => ({
            status: 422,
            corpo: {
              erro: 'autoria_anonima',
              mensagem: 'Esta sugestão é anônima: não dá para saber quem escreveu.',
            },
          }),
        },
      },
    )
    await fireEvent.press(screen.getByRole('button', { name: /^Bloquear esta pessoa/ }))
    expect(await screen.findByText('Não deu para bloquear')).toBeOnTheScreen()
    expect(
      screen.getByText('Esta sugestão é anônima: não dá para saber quem escreveu.'),
    ).toBeOnTheScreen()
  })
})

describe('tela Pessoas bloqueadas', () => {
  test('lista nome e data de quem eu bloqueei e desbloqueia sem diálogo, com Desfazer', async () => {
    let lista = [
      {
        id: 'b1',
        vinculoId: '22222222-2222-4222-8222-000000000002',
        nome: 'Bruno Lima',
        avatar: { icone: 'sol', cor: 'verde' },
        fotoVersao: null,
        bloqueadoEm: '2026-11-15T12:00:00.000Z',
      },
    ]
    const { servidor } = await renderizarTela(
      <>
        <TelaPessoasBloqueadas />
        <HospedeiroDeToast />
      </>,
      {
        papel: 'membro',
        rotas: {
          [`GET ${BASE}/bloqueios`]: () => ({ status: 200, corpo: { bloqueios: lista } }),
          [`DELETE ${BASE}/bloqueios/b1`]: () => {
            lista = []
            return { status: 200, corpo: { ok: true } }
          },
        },
      },
    )
    expect(await screen.findByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.getByText('Bloqueio em 15/11/2026')).toBeOnTheScreen()
    expect(screen.getByText('Pessoas bloqueadas')).toBeOnTheScreen()

    // Desfazer em vez de "tem certeza?": um toque desbloqueia, sem diálogo, e o toast oferece "Desfazer".
    const desbloquear = screen.getByRole('button', { name: 'Desbloquear Bruno Lima' })
    await fireEvent.press(desbloquear)
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${BASE}/bloqueios/b1`)).toHaveLength(1),
    )
    expect(confirmar).not.toHaveBeenCalled()
    expect(await screen.findByText('Bloqueio de Bruno Lima desfeito.')).toBeOnTheScreen()
    // A lista é relida: vazia, com o caminho para bloquear explicado e uma ação.
    expect(await screen.findByText('Ninguém bloqueado')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ver pedidos de oração' })).toBeOnTheScreen()
  })

  test('erro ao carregar mostra a mensagem e o "Tentar de novo"', async () => {
    await renderizarTela(<TelaPessoasBloqueadas />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/bloqueios`]: () => ({
          status: 500,
          corpo: { erro: 'interno', mensagem: 'Algo deu errado do nosso lado.' },
        }),
      },
    })
    expect(await screen.findByText('Algo deu errado do nosso lado.')).toBeOnTheScreen()
  })
})
