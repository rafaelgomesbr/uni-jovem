/**
 * D69: responder à convocação sem "tem certeza?". O ato aparece feito na hora (armazenamento de
 * respostas em espera), o envio só sai ao fim dos 10 s, Desfazer cancela, e a falha volta com
 * "Tentar de novo". Mais a tela "Preciso de alguém no meu lugar".
 */
import { act, screen, userEvent, waitFor } from '@testing-library/react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'

import { INICIO } from '@/testes/fixturas'
import { BASE, pedidosPara, renderizarTela } from '@/testes/telas'
import { HospedeiroDeToast, mostrarToast } from '@/ui/Toast'
import { confirmarAgora, desfazerAgora, haDesfazerPendente } from '@/ui/ToastComDesfazer'

import { useResponderComDesfazer, type ParteParaResponder } from '../consultas'
import {
  definirResposta,
  estadoEfetivo,
  limparResposta,
  reiniciarRespostas,
  useRespostasOtimistas,
} from '../respostasOtimistas'
import { TelaPedirSubstituicao } from '../TelaPedirSubstituicao'

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
jest.mock('@/ui/Toast', () => ({
  ...jest.requireActual('@/ui/Toast'),
  mostrarToast: jest.fn(),
}))

const PARTE: ParteParaResponder = {
  atribuicaoId: 'a1',
  eventoInicio: INICIO,
  fuso: 'America/Sao_Paulo',
  funcao: 'Vocal',
  etapaTitulo: 'Louvor',
}

/** Uma tela mínima: dois botões que usam o gancho e o que a pessoa vê da convocação. */
function Sonda() {
  const { aceitar, recusar } = useResponderComDesfazer('11111111-1111-4111-8111-111111111111')
  const otimistas = useRespostasOtimistas()
  return (
    <>
      <Text onPress={() => aceitar(PARTE)}>aceitar</Text>
      <Text onPress={() => recusar(PARTE)}>recusar</Text>
      <Text>{`estado: ${estadoEfetivo('a1', 'pendente', otimistas)}`}</Text>
      <HospedeiroDeToast />
    </>
  )
}

describe('respostas em espera (armazenamento)', () => {
  beforeEach(() => reiniciarRespostas())

  test('a resposta em espera vence a do servidor, e limpar devolve a do servidor', () => {
    const vazio = new Map<string, 'confirmada' | 'recusada'>()
    expect(estadoEfetivo('a1', 'pendente', vazio)).toBe('pendente')
    expect(estadoEfetivo('a1', 'pendente', new Map([['a1', 'confirmada' as const]]))).toBe(
      'confirmada',
    )
    definirResposta('a1', 'recusada')
    limparResposta('a1')
    limparResposta('a1')
  })
})

describe('aceitar e "Não posso ir" com Desfazer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    reiniciarRespostas()
  })
  afterEach(async () => {
    await act(async () => desfazerAgora())
  })

  test('aceitar: a tela muda na hora, o toast diz onde a pessoa está e a API só sai ao fim', async () => {
    const { servidor } = await renderizarTela(<Sonda />, {
      papel: 'membro',
      rotas: {
        [`POST ${BASE}/atribuicoes/a1/confirmar`]: () => ({
          status: 200,
          corpo: { estado: 'confirmada' },
        }),
        [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [] } }),
      },
    })
    await userEvent.setup().press(await screen.findByText('aceitar'))
    expect(await screen.findByText('estado: confirmada')).toBeOnTheScreen()
    // O texto do toast é o do documento: "Você está no Louvor, sábado 28." (aqui, o dia do teste).
    expect(await screen.findByText(/^Você está no Louvor, sábado \d+\.$/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(0)
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(1),
    )
    // Chegou: a resposta em espera sai e vale a do servidor.
    await waitFor(() => expect(screen.getByText('estado: pendente')).toBeOnTheScreen())
  })

  test('"Não posso ir": o texto diz que a liderança será avisada só depois; Desfazer não envia', async () => {
    const { servidor } = await renderizarTela(<Sonda />, { papel: 'membro' })
    await userEvent.setup().press(await screen.findByText('recusar'))
    expect(await screen.findByText('estado: recusada')).toBeOnTheScreen()
    expect(await screen.findByText('Você avisou que não pode ir.')).toBeOnTheScreen()
    await act(async () => desfazerAgora())
    expect(await screen.findByText('estado: pendente')).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/recusar`)).toHaveLength(0)
  })

  test('falha ao enviar: volta ao estado de antes e o toast oferece "Tentar de novo"', async () => {
    let tentativas = 0
    const { servidor } = await renderizarTela(<Sonda />, {
      papel: 'membro',
      rotas: {
        [`POST ${BASE}/atribuicoes/a1/confirmar`]: () => {
          tentativas += 1
          return tentativas === 1
            ? { status: 500, corpo: { erro: 'erro_interno', mensagem: 'Falhou.' } }
            : { status: 200, corpo: { estado: 'confirmada' } }
        },
        [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [] } }),
      },
    })
    await userEvent.setup().press(await screen.findByText('aceitar'))
    await act(async () => confirmarAgora())
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
    expect(screen.getByText('Não deu para registrar sua resposta.')).toBeOnTheScreen()
    expect(screen.getByText('estado: pendente')).toBeOnTheScreen()
    // "Tentar de novo" refaz o ato (aceita de novo na tela) e o envio sai.
    await act(async () => desfazerAgora())
    await act(async () => confirmarAgora())
    await waitFor(() =>
      expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/confirmar`)).toHaveLength(2),
    )
    expect(haDesfazerPendente()).toBe(false)
  })
})

describe('"Preciso de alguém no meu lugar"', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useLocalSearchParams).mockReturnValue({ atribuicaoId: 'a1' })
  })

  const ESCALA = {
    id: 'a1',
    funcao: 'Vocal',
    estado: 'confirmada',
    eventoId: 'e1',
    eventoTitulo: 'Sábado Jovem',
    eventoInicio: INICIO,
    eventoStatus: 'publicado',
    etapaTitulo: 'Louvor',
    substituicaoAberta: null,
  }

  test('duas opções, motivo opcional e "Enviar pedido"; o toast diz que a pessoa continua na parte', async () => {
    const { servidor } = await renderizarTela(<TelaPedirSubstituicao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [ESCALA] } }),
        [`POST ${BASE}/atribuicoes/a1/substituicao`]: () => ({ status: 200, corpo: { id: 's1' } }),
      },
    })
    expect(await screen.findByText('Louvor · Vocal')).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: /^Qualquer pessoa da comunidade/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /^Escolher uma pessoa/ })).toBeOnTheScreen()
    // A palavra da interface mudou: nada de "Pedir substituição".
    expect(screen.queryByText('Pedir substituição')).toBeNull()
    await userEvent.setup().type(screen.getByLabelText(/^Motivo/), 'Viagem')
    await userEvent.setup().press(screen.getByRole('button', { name: 'Enviar pedido' }))
    await waitFor(() =>
      expect(
        pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/substituicao`)[0]?.corpo,
      ).toEqual({
        motivo: 'Viagem',
        paraVinculoId: null,
      }),
    )
    await waitFor(() =>
      expect(mostrarToast).toHaveBeenCalledWith({
        texto: 'Pedido enviado. Você continua na sua parte até alguém assumir.',
      }),
    )
    expect(router.back).toBeDefined()
  })

  test('escolher uma pessoa sem escolher ninguém não envia e diz o que falta', async () => {
    const { servidor } = await renderizarTela(<TelaPedirSubstituicao />, {
      papel: 'membro',
      rotas: {
        [`GET ${BASE}/minhas-escalas`]: () => ({ status: 200, corpo: { escalas: [ESCALA] } }),
      },
    })
    const usuario = userEvent.setup()
    await usuario.press(await screen.findByRole('radio', { name: /^Escolher uma pessoa/ }))
    await usuario.press(screen.getByRole('button', { name: 'Enviar pedido' }))
    expect(await screen.findByText(/^Escolha para quem vai o pedido/)).toBeOnTheScreen()
    expect(pedidosPara(servidor, 'POST', `${BASE}/atribuicoes/a1/substituicao`)).toHaveLength(0)
  })
})
