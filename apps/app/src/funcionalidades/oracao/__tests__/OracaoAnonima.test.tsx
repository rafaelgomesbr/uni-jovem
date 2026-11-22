import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import { QUEM_VE_O_PEDIDO } from '@uj/dominio'
import { useLocalSearchParams } from 'expo-router'
import { Alert } from 'react-native'

import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'

import { MARCA_DO_ANONIMO } from '../CartaoDoPedido'
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

/** Pedido anônimo de outra pessoa: a API já manda sem o nome (D55). */
const ANONIMO_DE_OUTRA = {
  id: '55555555-5555-4555-8555-0000000000a1',
  texto: 'Pela minha ansiedade',
  visibilidade: 'comunidade',
  quemVe: QUEM_VE_O_PEDIDO.comunidade,
  minha: false,
  anonimo: true,
  autorNome: null,
  respondidoEm: null,
  criadoEm: '2026-11-10T12:00:00.000Z',
  atualizadoEm: '2026-11-10T12:00:00.000Z',
  versao: 1,
  orando: { total: 0, euEstouOrando: false, pessoas: [] },
}

/** O mesmo, visto pela autora: o nome dela vem, e a marca de anônimo aparece. */
const MEU_ANONIMO = {
  ...ANONIMO_DE_OUTRA,
  id: '55555555-5555-4555-8555-0000000000a2',
  texto: 'Pela minha entrevista',
  minha: true,
  autorNome: 'Ana Souza',
}

function responderDialogos(confirmar = true) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botoes) => {
    ;(confirmar ? botoes?.at(-1) : botoes?.[0])?.onPress?.()
  })
}

describe('novo pedido: publicar como anônimo', () => {
  afterEach(() => jest.restoreAllMocks())

  test('o interruptor só aparece quando mais alguém pode ler, vem desligado e diz UMA frase do estado atual', async () => {
    const dialogo = responderDialogos()
    const { servidor } = await renderizarTela(<TelaNovoPedido />, {
      papel: 'membro',
      rotas: { [`POST ${BASE}/oracao`]: () => ({ status: 200, corpo: { id: 'p1' } }) },
    })

    // "Somente eu" (o padrão): anonimato não faz sentido, o interruptor nem aparece.
    await screen.findByRole('radio', { name: 'Somente eu (padrão)' })
    expect(screen.queryByRole('switch', { name: 'Publicar como anônimo' })).toBeNull()

    await fireEvent.press(screen.getByRole('radio', { name: 'Comunidade' }))
    const interruptor = await screen.findByRole('switch', { name: 'Publicar como anônimo' })
    expect(interruptor).not.toBeChecked()
    // O estado em texto, não só na cor do interruptor, e sem a frase que contradiz.
    expect(screen.getByText(/^Desligado: seu nome aparece/)).toBeOnTheScreen()
    expect(screen.queryByText(/^Ligado:/)).toBeNull()
    expect(
      screen.queryByText('Seu nome não aparece para ninguém da comunidade, nem para a liderança.'),
    ).toBeNull()

    await fireEvent.press(interruptor)
    expect(screen.getByRole('switch', { name: 'Publicar como anônimo' })).toBeChecked()
    expect(screen.getByText(/^Ligado: o pedido sai como "Anônimo"\./)).toBeOnTheScreen()
    expect(screen.queryByText(/^Desligado:/)).toBeNull()

    await fireEvent.changeText(screen.getByLabelText('Seu pedido'), 'Pela minha ansiedade')
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))
    // O resumo da folha diz "Anônimo" e o botão tem o verbo (o diálogo nativo não é mais usado).
    expect(
      await screen.findByText(/^Vai aparecer como Anônimo para \d+ pessoas\.$/),
    ).toBeOnTheScreen()
    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar como Anônimo' }))

    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)).toHaveLength(1))
    expect(dialogo).not.toHaveBeenCalled()
    expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)[0]!.corpo).toEqual({
      texto: 'Pela minha ansiedade',
      visibilidade: 'comunidade',
      anonimo: true,
    })
  })

  test('ligar o anonimato e voltar para "Somente eu": o pedido vai sem anonimato', async () => {
    const { servidor } = await renderizarTela(<TelaNovoPedido />, {
      papel: 'membro',
      rotas: { [`POST ${BASE}/oracao`]: () => ({ status: 200, corpo: { id: 'p1' } }) },
    })
    await fireEvent.press(await screen.findByRole('radio', { name: 'Comunidade' }))
    await fireEvent.press(screen.getByRole('switch', { name: 'Publicar como anônimo' }))
    await fireEvent.press(screen.getByRole('radio', { name: 'Somente eu (padrão)' }))
    expect(screen.queryByRole('switch', { name: 'Publicar como anônimo' })).toBeNull()

    await fireEvent.changeText(screen.getByLabelText('Seu pedido'), 'Só para mim')
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))
    await waitFor(() => expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)).toHaveLength(1))
    expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)[0]!.corpo).toMatchObject({
      visibilidade: 'somente_eu',
      anonimo: false,
    })
  })

  test('o aviso de privacidade fala em palavras comuns e continua dizendo a verdade (D62, Q4)', async () => {
    await renderizarTela(<TelaNovoPedido />, { papel: 'membro' })
    expect(await screen.findByText(AVISO_DO_TEXTO)).toBeOnTheScreen()
    // A substância legal: guardado cifrado ("em código"), e quem cuida do servidor consegue ler.
    expect(AVISO_DO_TEXTO).toMatch(/guardado em código/)
    expect(AVISO_DO_TEXTO).toMatch(/quem cuida do servidor consegue lê-lo, se precisar/)
    expect(AVISO_DO_TEXTO).toMatch(/Evite nomes e doenças de outras pessoas/)
    // Sem o jargão antigo.
    expect(AVISO_DO_TEXTO).not.toMatch(/criptografia|cifrado|capacidade técnica/)
    // O detalhe completo continua a um toque.
    expect(screen.getByRole('button', { name: 'Entenda como é guardado' })).toBeOnTheScreen()
  })

  test('anônimo para a comunidade: o resumo diz "Anônimo" e o botão tem o verbo; Voltar não envia', async () => {
    responderDialogos(false)
    const { servidor } = await renderizarTela(<TelaNovoPedido />, {
      papel: 'membro',
      rotas: { [`POST ${BASE}/oracao`]: () => ({ status: 200, corpo: { id: 'p1' } }) },
    })
    await fireEvent.press(await screen.findByRole('radio', { name: 'Comunidade' }))
    await fireEvent.press(screen.getByRole('switch', { name: 'Publicar como anônimo' }))
    await fireEvent.changeText(screen.getByLabelText('Seu pedido'), 'Pela minha família')
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar pedido' }))
    expect(await screen.findByText('Vai aparecer como Anônimo para 2 pessoas.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Publicar como Anônimo' })).toBeOnTheScreen()
    await fireEvent.press(screen.getAllByRole('button', { name: 'Voltar' }).at(-1)!)
    expect(pedidosPara(servidor, 'POST', `${BASE}/oracao`)).toHaveLength(0)
  })
})

describe('lista e detalhe: pedido anônimo', () => {
  afterEach(() => jest.restoreAllMocks())

  test('de outra pessoa: "Anônimo" com ícone, sem nome e sem bloquear', async () => {
    await renderizarTela(<TelaOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao`]: () => ({ status: 200, corpo: { pedidos: [ANONIMO_DE_OUTRA] } }),
      },
    })
    expect(await screen.findByText('Pela minha ansiedade')).toBeOnTheScreen()
    // O chip (com o ícone de anônimo) e a sobrancelha dizem "Anônimo" por extenso.
    expect(screen.getByText('Anônimo')).toBeOnTheScreen()
    expect(screen.getByText(/^Anônimo · /)).toBeOnTheScreen()
    expect(screen.queryByText(MARCA_DO_ANONIMO)).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Estou orando pelo pedido anônimo' }),
    ).toBeOnTheScreen()

    // Denunciar continua; bloquear não, porque não há pessoa a identificar.
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: 'Mais ações do pedido anônimo' }))
    expect(await screen.findAllByRole('button', { name: 'Denunciar' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Bloquear esta pessoa/ })).toBeNull()
  })

  test('da própria autora: a marca "Você publicou como anônimo" na lista e no detalhe', async () => {
    const lista = await renderizarTela(<TelaOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao`]: () => ({ status: 200, corpo: { pedidos: [MEU_ANONIMO] } }),
      },
    })
    expect(await screen.findByText('Pela minha entrevista')).toBeOnTheScreen()
    expect(screen.getByLabelText(MARCA_DO_ANONIMO)).toBeOnTheScreen()
    expect(screen.getByText('Anônimo')).toBeOnTheScreen()
    await lista.unmount()
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ pedidoId: MEU_ANONIMO.id })
    await renderizarTela(<TelaPedidoDeOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao/${MEU_ANONIMO.id}`]: () => ({ status: 200, corpo: MEU_ANONIMO }),
      },
    })
    expect(await screen.findByLabelText(MARCA_DO_ANONIMO)).toBeOnTheScreen()
  })

  test('na edição, mostrar o nome pede confirmação e envia `anonimo: false` com a versão', async () => {
    const dialogo = responderDialogos()
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ pedidoId: MEU_ANONIMO.id, editar: '1' })
    const { servidor } = await renderizarTela(<TelaPedidoDeOracao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/oracao/${MEU_ANONIMO.id}`]: () => ({ status: 200, corpo: MEU_ANONIMO }),
        [`PATCH ${BASE}/oracao/${MEU_ANONIMO.id}`]: () => ({
          status: 200,
          corpo: { id: MEU_ANONIMO.id, versao: 2, anonimo: false },
        }),
      },
    })
    const interruptor = await screen.findByRole('switch', { name: 'Publicar como anônimo' })
    expect(interruptor).toBeChecked()
    await fireEvent.press(interruptor)
    await waitFor(() =>
      expect(pedidosPara(servidor, 'PATCH', `${BASE}/oracao/${MEU_ANONIMO.id}`)).toHaveLength(1),
    )
    expect(dialogo.mock.calls[0]![0]).toBe('Mostrar o seu nome?')
    expect(pedidosPara(servidor, 'PATCH', `${BASE}/oracao/${MEU_ANONIMO.id}`)[0]!.corpo).toEqual({
      anonimo: false,
      versao: 1,
    })
  })
})
