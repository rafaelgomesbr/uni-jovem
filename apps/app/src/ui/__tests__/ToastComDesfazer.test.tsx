/**
 * D65: o toast com Desfazer. O ato aparece feito, o envio só sai ao fim dos 10 s, "Desfazer"
 * cancela, e nada se envia duas vezes. A contagem é anunciada uma vez e o foco não é roubado.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { DESFAZER } from '@uj/tokens'
import { StyleSheet } from 'react-native'

import { HospedeiroDeToast } from '../Toast'
import {
  aoMudarEstadoDoApp,
  confirmarAgora,
  desfazerAgora,
  haDesfazerPendente,
  mostrarDesfazer,
} from '../ToastComDesfazer'
import { anunciar } from '../anunciar'

jest.mock('../anunciar', () => ({ anunciar: jest.fn() }))
jest.mock('../acessibilidade', () => ({
  usePreferenciasDeAcessibilidade: jest.fn(),
}))
const preferencias = jest.requireMock('../acessibilidade') as {
  usePreferenciasDeAcessibilidade: jest.Mock
}

function reduzir(valor: boolean) {
  preferencias.usePreferenciasDeAcessibilidade.mockReturnValue({
    reduzirMovimento: valor,
    reduzirTransparencia: false,
    aumentarContraste: false,
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  reduzir(false)
})

afterEach(async () => {
  // Cada teste termina sem pendente: o armazenamento é do módulo, não da árvore.
  await act(async () => {
    desfazerAgora()
  })
  jest.useRealTimers()
})

const passar = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms))

describe('toast com Desfazer: a contagem de 10 s', () => {
  test('o envio só sai ao fim dos 10 s, uma vez, e o toast some', async () => {
    const aoConfirmar = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Publicando e avisando 11 pessoas.', aoConfirmar })
    })
    expect(screen.getByText('Publicando e avisando 11 pessoas.')).toBeOnTheScreen()
    expect(screen.getByText('10 s')).toBeOnTheScreen()

    await passar(9_000)
    expect(aoConfirmar).not.toHaveBeenCalled()
    expect(screen.getByText('1 s')).toBeOnTheScreen()

    await passar(1_000)
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Publicando e avisando 11 pessoas.')).toBeNull()
    expect(haDesfazerPendente()).toBe(false)

    // Passa o tempo de novo: nada se repete.
    await passar(30_000)
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })

  test('a contagem desce de segundo em segundo, em número', async () => {
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Você avisou que não pode ir.', aoConfirmar: jest.fn() })
    })
    for (const esperado of ['9 s', '8 s', '7 s']) {
      await passar(1_000)
      expect(screen.getByText(esperado)).toBeOnTheScreen()
    }
  })

  test('Desfazer cancela: o envio nunca sai e o estado volta', async () => {
    const aoConfirmar = jest.fn()
    const aoDesfazer = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Presença de Ana registrada.', aoConfirmar, aoDesfazer })
    })
    await passar(4_000)
    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
    expect(aoDesfazer).toHaveBeenCalledTimes(1)
    expect(aoConfirmar).not.toHaveBeenCalled()
    expect(screen.queryByText('Presença de Ana registrada.')).toBeNull()

    // O tempo que sobrava passa e continua sem envio.
    await passar(20_000)
    expect(aoConfirmar).not.toHaveBeenCalled()
    expect(aoDesfazer).toHaveBeenCalledTimes(1)
  })

  test('não duplica: desfazer e depois o fim da contagem, ou confirmar duas vezes, só valem uma vez', async () => {
    const aoConfirmar = jest.fn()
    const aoDesfazer = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Convocado.', aoConfirmar, aoDesfazer })
    })
    await act(async () => {
      confirmarAgora()
      confirmarAgora()
      desfazerAgora()
    })
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
    expect(aoDesfazer).not.toHaveBeenCalled()
  })

  test('um toast novo CONFIRMA o anterior (nunca se perde um envio) e começa a própria contagem', async () => {
    const primeiro = jest.fn()
    const segundo = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Primeiro.', aoConfirmar: primeiro })
    })
    await passar(3_000)
    await act(async () => {
      mostrarDesfazer({ texto: 'Segundo.', aoConfirmar: segundo })
    })
    expect(primeiro).toHaveBeenCalledTimes(1)
    expect(segundo).not.toHaveBeenCalled()
    expect(screen.getByText('10 s')).toBeOnTheScreen()
    await passar(10_000)
    expect(segundo).toHaveBeenCalledTimes(1)
    expect(primeiro).toHaveBeenCalledTimes(1)
  })

  test('o tempo é configurável (6 s numa falha de ação, com "Tentar de novo")', async () => {
    const aoDesfazer = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({
        texto: 'Não deu para registrar sua resposta.',
        rotuloDoBotao: 'Tentar de novo',
        segundos: 6,
        aoConfirmar: jest.fn(),
        aoDesfazer,
      })
    })
    expect(screen.getByText('6 s')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(aoDesfazer).toHaveBeenCalledTimes(1)
  })

  test('o app vai para segundo plano durante a espera: o envio sai; voltar ao primeiro plano não faz nada', async () => {
    const aoConfirmar = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Lembrando Bruno e Camila.', aoConfirmar })
    })
    await act(async () => aoMudarEstadoDoApp('active'))
    expect(aoConfirmar).not.toHaveBeenCalled()
    await act(async () => aoMudarEstadoDoApp('background'))
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })
})

describe('toast com Desfazer: acessibilidade e movimento', () => {
  test('anuncia uma vez "Desfazer disponível por 10 segundos"; é região de status; o botão tem 44', async () => {
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Convocado.', aoConfirmar: jest.fn() })
    })
    expect(anunciar).toHaveBeenCalledTimes(1)
    expect(anunciar).toHaveBeenCalledWith(`Convocado. ${DESFAZER.anuncio(10)}`)
    expect(screen.getByTestId('toast-com-desfazer')).toHaveProp('accessibilityLiveRegion', 'polite')
    const botao = screen.getByRole('button', { name: 'Desfazer' })
    const estilo = StyleSheet.flatten(botao.props.style as never) as Record<string, number>
    expect(estilo.minHeight).toBeGreaterThanOrEqual(44)
    expect(estilo.minWidth).toBeGreaterThanOrEqual(44)
    // A contagem passa e o anúncio não se repete.
    await passar(5_000)
    expect(anunciar).toHaveBeenCalledTimes(1)
  })

  test('com movimento: a barra de 3 pt existe; com Reduzir movimento ela some e o número continua', async () => {
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Convocado.', aoConfirmar: jest.fn() })
    })
    expect(screen.getByTestId('toast-barra')).toBeOnTheScreen()
    await act(async () => desfazerAgora())

    reduzir(true)
    await act(async () => {
      mostrarDesfazer({ texto: 'Convocado de novo.', aoConfirmar: jest.fn() })
    })
    expect(screen.queryByTestId('toast-barra')).toBeNull()
    expect(screen.getByText('10 s')).toBeOnTheScreen()
    await passar(2_000)
    expect(screen.getByText('8 s')).toBeOnTheScreen()
  })
})
