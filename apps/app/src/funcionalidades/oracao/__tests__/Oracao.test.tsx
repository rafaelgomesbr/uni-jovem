import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QUEM_VE_O_PEDIDO } from '@uj/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert } from 'react-native'

import { BASE, pedidosPara, PESSOAS, renderizarTela } from '@/testes/telas'

import { AVISO_DO_TEXTO, TelaNovoPedido } from '../TelaNovoPedido'
import { TelaOracao } from '../TelaOracao'
import { TelaPedidoDeOracao } from '../TelaPedidoDeOracao'
import { quemVaiVer } from '../visibilidade'

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
  anonimo: false,
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
      anonimo: false,
    })
    // "Somente eu" não pede confirmação: ninguém além da pessoa vai ler.
    expect(dialogo).not.toHaveBeenCalled()
  })

  test('publicar para a comunidade abre o resumo com quantas pessoas leem; Voltar não envia e o texto fica', async () => {
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

    // O resumo é uma folha (não o diálogo nativo): a frase, o aviso e o botão com o verbo.
    expect(
      await screen.findByText(`Vai aparecer com o seu nome para ${outras} pessoas.`),
    ).toBeOnTheScreen()
    expect(screen.getAllByText(AVISO_DO_TEXTO).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Publicar com meu nome' })).toBeOnTheScreen()
    expect(dialogo).not.toHaveBeenCalled()

    // Voltar fecha sem publicar, e o texto continua no campo.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Voltar' }).at(-1)!)
    expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)).toHaveLength(0)
    expect(screen.getByLabelText('Seu pedido')).toHaveDisplayValue('Pela minha família')

    // Publicando de fato: um envio só.
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))
    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar com meu nome' }))
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)[0]!.corpo).toEqual({
      texto: 'Pela minha família',
      visibilidade: 'comunidade',
      anonimo: false,
    })
  })

  test('para a equipe de oração vazia, o resumo diz a verdade: só você vê por enquanto', async () => {
    await renderizarTela(<TelaNovoPedido />, { papel: 'membro' })
    await fireEvent.press(await screen.findByRole('radio', { name: 'Equipe de oração' }))
    await fireEvent.changeText(screen.getByLabelText('Seu pedido'), 'Pela equipe')
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))
    expect(
      await screen.findByText(
        'Hoje ninguém além de você está na equipe de oração, então só você vê até alguém ser designado.',
      ),
    ).toBeOnTheScreen()
  })

  test('texto vazio: o erro aparece e a folha nem abre', async () => {
    await renderizarTela(<TelaNovoPedido />, { papel: 'membro' })
    await fireEvent.press(await screen.findByRole('radio', { name: 'Comunidade' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))
    expect(await screen.findByText('Escreva o seu pedido.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Publicar com meu nome' })).toBeNull()
  })

  test('sem internet: o botão diz que precisa de internet e que o texto não é guardado no aparelho', async () => {
    await renderizarTela(<TelaNovoPedido />, { papel: 'membro' })
    await screen.findByRole('radio', { name: 'Somente eu (padrão)' })
    await act(async () => onlineManager.setOnline(false))
    try {
      expect(
        await screen.findByText(
          'Precisa de internet para publicar. O texto não é guardado no aparelho.',
        ),
      ).toBeOnTheScreen()
      expect(screen.getByRole('button', { name: 'Publicar pedido' })).toBeDisabled()
    } finally {
      await act(async () => onlineManager.setOnline(true))
    }
  })

  test('falha ao publicar: a mensagem não promete guardar o texto e o campo continua preenchido', async () => {
    await renderizarTela(<TelaNovoPedido />, {
      papel: 'membro',
      rotas: {
        [`POST ${BASE}/oracao`]: () => ({
          status: 500,
          corpo: { codigo: 'erro_interno', mensagem: 'falha' },
        }),
      },
    })
    await fireEvent.changeText(await screen.findByLabelText('Seu pedido'), 'Pela minha saúde')
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))
    expect(await screen.findByText('Não deu para publicar')).toBeOnTheScreen()
    expect(
      screen.getByText(/O texto está só nesta tela: não é guardado no aparelho/),
    ).toBeOnTheScreen()
    expect(screen.getByLabelText('Seu pedido')).toHaveDisplayValue('Pela minha saúde')
  })

  test('as frases do resumo (quemVaiVer)', () => {
    const c = { equipe: 3, comunidade: 14 }
    expect(quemVaiVer('comunidade', true, c)).toBe('Vai aparecer como Anônimo para 14 pessoas.')
    expect(quemVaiVer('comunidade', false, c)).toBe('Vai aparecer com o seu nome para 14 pessoas.')
    expect(quemVaiVer('comunidade', false, { equipe: 0, comunidade: 1 })).toBe(
      'Vai aparecer com o seu nome para 1 pessoa.',
    )
    expect(quemVaiVer('equipe_oracao', true, c)).toBe(
      'Vai aparecer como Anônimo para a equipe de oração (3 pessoas).',
    )
    expect(quemVaiVer('comunidade', true, { equipe: null, comunidade: null })).toBe(
      'Vai aparecer como Anônimo para toda a comunidade.',
    )
    expect(quemVaiVer('somente_eu', true, c)).toBe('Só você vai ver este pedido.')
  })
})

describe('lista e pedido', () => {
  afterEach(() => jest.restoreAllMocks())

  test('vazio: o sol, o convite a ser o primeiro e a ação "Pedir oração"', async () => {
    await renderizarTela(<TelaOracao />, {
      papel: 'membro',
      rotas: { [`GET ${BASE}/oracao`]: () => ({ status: 200, corpo: { pedidos: [] } }) },
    })
    expect(await screen.findByText('Nenhum pedido ainda.')).toBeOnTheScreen()
    expect(screen.getByText(/Você pode ser o primeiro/)).toBeOnTheScreen()
    const pedir = screen.getAllByRole('button', { name: 'Pedir oração' })
    await userEvent.setup().press(pedir.at(-1)!)
    expect(router.push).toHaveBeenLastCalledWith('/oracao/novo')
  })

  test('erro: texto humano e "Tentar de novo"', async () => {
    await renderizarTela(<TelaOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao`]: () => ({
          status: 500,
          corpo: { codigo: 'erro_interno', mensagem: 'falha' },
        }),
      },
    })
    expect(await screen.findByText('Não deu para carregar os pedidos')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

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

    // "Mais" tem a palavra à vista: o botão de reticências sozinho não dizia nada (D62).
    expect(screen.getAllByText('Mais').length).toBeGreaterThan(0)

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
