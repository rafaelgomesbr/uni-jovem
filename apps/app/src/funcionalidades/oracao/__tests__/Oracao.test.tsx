import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QUEM_VE_O_PEDIDO } from '@uj/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert } from 'react-native'

import { BASE, pedidosPara, PESSOAS, renderizarTela } from '@/testes/telas'

import { AVISO_DO_TEXTO, TelaNovoPedido } from '../TelaNovoPedido'
import { TelaOracao } from '../TelaOracao'
import { TelaPedidoDeOracao } from '../TelaPedidoDeOracao'

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

const PEDIDO = {
  id: '55555555-5555-4555-8555-000000000001',
  texto: 'Pela prova de sábado',
  visibilidade: 'somente_eu',
  quemVe: QUEM_VE_O_PEDIDO.somente_eu,
  minha: true,
  autorNome: 'Ana Souza',
  respondidoEm: null,
  criadoEm: '2026-11-10T12:00:00.000Z',
  atualizadoEm: '2026-11-10T12:00:00.000Z',
  versao: 1,
  orando: { total: 0, euEstouOrando: false, pessoas: [] },
}

const DE_OUTRA = {
  ...PEDIDO,
  id: '55555555-5555-4555-8555-000000000002',
  texto: 'Pela minha família',
  visibilidade: 'comunidade',
  quemVe: QUEM_VE_O_PEDIDO.comunidade,
  minha: false,
  autorNome: 'Bruno Lima',
}

/** Responde ao diálogo nativo: o último botão confirma; `false` cancela. */
function responderDialogos(confirmar = true) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botoes) => {
    ;(confirmar ? botoes?.at(-1) : botoes?.[0])?.onPress?.()
  })
}

describe('novo pedido de oração', () => {
  afterEach(() => jest.restoreAllMocks())

  test('"Somente eu" vem marcado e a explicação de quem vê aparece antes de publicar', async () => {
    const dialogo = responderDialogos()
    const { servidor } = await renderizarTela(<TelaNovoPedido />, {
      papel: 'membro',
      rotas: { [`POST ${BASE}/oracao`]: () => ({ status: 200, corpo: { id: 'p1' } }) },
    })

    const somenteEu = await screen.findByRole('radio', { name: 'Somente eu (padrão)' })
    expect(somenteEu).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Comunidade' })).not.toBeChecked()
    // O aviso de privacidade e a explicação de quem vê estão na tela antes de qualquer envio.
    expect(screen.getByText(AVISO_DO_TEXTO)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Entenda como é guardado' })).toBeOnTheScreen()
    expect(
      screen.getByText(
        'Só você vê. Nem administradores nem o Criador do app têm tela para ler. Você pode mudar isso depois, sempre com confirmação.',
      ),
    ).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)).toHaveLength(0)

    await fireEvent.changeText(screen.getByLabelText('Seu pedido'), '  Pela prova de sábado  ')
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))

    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)[0]!.corpo).toEqual({
      texto: 'Pela prova de sábado',
      visibilidade: 'somente_eu',
    })
    // "Somente eu" não pede confirmação: ninguém além da pessoa vai ler.
    expect(dialogo).not.toHaveBeenCalled()
  })

  test('publicar para a comunidade mostra quantas pessoas leem e pede confirmação', async () => {
    const dialogo = responderDialogos(false)
    const { servidor } = await renderizarTela(<TelaNovoPedido />, {
      papel: 'membro',
      rotas: { [`POST ${BASE}/oracao`]: () => ({ status: 200, corpo: { id: 'p1' } }) },
    })

    await fireEvent.press(await screen.findByRole('radio', { name: 'Comunidade' }))
    const outras = PESSOAS.length - 1
    expect(
      await screen.findAllByText(
        new RegExp(`todos os membros ativos da Jovens Centro veem \\(${outras} pessoas hoje\\)`),
      ),
    ).not.toHaveLength(0)
    await fireEvent.changeText(screen.getByLabelText('Seu pedido'), 'Pela minha família')
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))

    await waitFor(() => expect(dialogo).toHaveBeenCalled())
    expect(dialogo.mock.calls[0]![0]).toBe('Publicar para toda a comunidade?')
    expect(dialogo.mock.calls[0]![1]).toBe(`${outras} pessoas vão poder ler este pedido.`)
    // Voltou no diálogo: nada é enviado.
    expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)).toHaveLength(0)
  })
})

describe('lista e pedido', () => {
  afterEach(() => jest.restoreAllMocks())

  test('"Estou orando" em pedido de outra pessoa e denúncia só no que é da comunidade', async () => {
    const { servidor } = await renderizarTela(<TelaOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao`]: () => ({ status: 200, corpo: { pedidos: [PEDIDO, DE_OUTRA] } }),
        [`POST ${BASE}/oracao/${DE_OUTRA.id}/orando`]: () => ({
          status: 200,
          corpo: { euEstouOrando: true, total: 1 },
        }),
      },
    })

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Estou orando pelo pedido de bruno lima' }),
    )
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/oracao/${DE_OUTRA.id}/orando`)).toHaveLength(1),
    )
    const usuario = userEvent.setup()
    // Nada de botões largos no cartão: denunciar, editar e excluir ficam em "Mais ações".
    expect(screen.queryByRole('button', { name: 'Denunciar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar ou mudar quem vê' })).toBeNull()

    // Só o pedido da comunidade, de outra pessoa, pode ser denunciado.
    await usuario.press(screen.getByRole('button', { name: 'Mais ações do pedido de bruno lima' }))
    expect(await screen.findAllByRole('button', { name: 'Denunciar' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Editar ou mudar quem vê' })).toBeNull()
    await usuario.press(screen.getByRole('button', { name: 'Fechar' }))

    // Os próprios pedidos têm editar e excluir, e não denunciar.
    await usuario.press(screen.getByRole('button', { name: 'Mais ações do seu pedido' }))
    await usuario.press(await screen.findByRole('button', { name: 'Editar ou mudar quem vê' }))
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/oracao/[pedidoId]',
      params: { pedidoId: PEDIDO.id, editar: '1' },
    })
    expect(screen.queryByRole('button', { name: 'Denunciar' })).toBeNull()
  })

  test('excluir o próprio pedido pede confirmação com o verbo explícito', async () => {
    const dialogo = responderDialogos()
    const { servidor } = await renderizarTela(<TelaOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao`]: () => ({ status: 200, corpo: { pedidos: [PEDIDO] } }),
        [`DELETE ${BASE}/oracao/${PEDIDO.id}`]: () => ({ status: 200, corpo: { ok: true } }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('button', { name: 'Mais ações do seu pedido' }))
    await usuario.press(await screen.findByRole('button', { name: 'Excluir pedido' }))
    await waitFor(() =>
      expect(pedidosPara(servidor, 'DELETE', `${BASE}/oracao/${PEDIDO.id}`)).toHaveLength(1),
    )
    expect(dialogo.mock.calls[0]![0]).toBe('Excluir este pedido?')
    expect(dialogo.mock.calls[0]![2]?.at(-1)?.text).toBe('Excluir pedido')
  })

  test('o texto não fica no cache depois que a tela fecha (gcTime 0)', async () => {
    const { consultas, unmount } = await renderizarTela(<TelaOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao`]: () => ({ status: 200, corpo: { pedidos: [PEDIDO] } }),
      },
    })
    expect(await screen.findByText('Pela prova de sábado')).toBeOnTheScreen()
    await unmount()
    await waitFor(() =>
      expect(
        consultas
          .getQueryCache()
          .getAll()
          .filter((q) => q.queryKey.includes('oracao')),
      ).toHaveLength(0),
    )
  })

  test('mudar quem vê exige confirmação e manda o público visto e o novo', async () => {
    const dialogo = responderDialogos()
    // "Editar ou mudar quem vê" abre o pedido no modo de edição.
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ pedidoId: PEDIDO.id, editar: '1' })
    const { servidor } = await renderizarTela(<TelaPedidoDeOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao/${PEDIDO.id}`]: () => ({ status: 200, corpo: PEDIDO }),
        [`PUT ${BASE}/oracao/${PEDIDO.id}/visibilidade`]: () => ({
          status: 200,
          corpo: { id: PEDIDO.id, visibilidade: 'equipe_oracao', versao: 2 },
        }),
      },
    })

    const mudar = await screen.findByRole('button', { name: 'Mudar quem vê' })
    expect(mudar).toBeDisabled()
    await fireEvent.press(screen.getByRole('radio', { name: 'Equipe de oração' }))
    await fireEvent.press(mudar)

    await waitFor(() =>
      expect(pedidosPara(servidor, 'PUT', `${BASE}/oracao/${PEDIDO.id}/visibilidade`)).toHaveLength(
        1,
      ),
    )
    expect(dialogo.mock.calls[0]![0]).toBe('Mudar a visibilidade para Equipe de oração?')
    expect(dialogo.mock.calls[0]![1]).toMatch(/^Antes: Só você vê/)
    expect(dialogo.mock.calls[0]![1]).toMatch(/Mais pessoas vão poder ler este pedido/)
    expect(
      pedidosPara(servidor, 'PUT', `${BASE}/oracao/${PEDIDO.id}/visibilidade`)[0]!.corpo,
    ).toEqual({ de: 'somente_eu', para: 'equipe_oracao' })
  })
})
