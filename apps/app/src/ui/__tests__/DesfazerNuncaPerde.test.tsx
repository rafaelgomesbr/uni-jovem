/**
 * D74: a ação pendente do Desfazer nunca se perde em silêncio. Se o app vai para segundo plano,
 * a página é fechada ou a pessoa navega, o envio sai na hora; se a rede falha, repete sozinho e,
 * esgotadas as tentativas, a faixa vira "Tentar de novo". E o número de segundos que a folha diz
 * é o mesmo que a faixa conta.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { DESFAZER } from '@uj/tokens'
import type { useSyncExternalStore as UsarArmazenamento } from 'react'
import { AccessibilityInfo, Text } from 'react-native'

import { emDescarga } from '@/servicos/descarga'
import { ErroDaApi, SemConexao } from '@/servicos/erros'

import { HospedeiroDeToast } from '../Toast'
import {
  aoFecharAPagina,
  aoMudarEstadoDoApp,
  conhecerOLeitorDeTela,
  confirmarAgora,
  desfazerAgora,
  ESPERAS_ENTRE_TENTATIVAS_MS,
  frasePraDesfazer,
  haDesfazerPendente,
  mostrarDesfazer,
  segundosDaEsperaAgora,
  useSegundosDoDesfazer,
} from '../ToastComDesfazer'
import { anunciar } from '../anunciar'

/** O caminho da tela, como o roteador o dá: uma assinatura, para quem o lê se atualizar. */
const mockOuvintes = new Set<() => void>()
let mockCaminho = '/evento/1'
jest.mock('expo-router', () => {
  const { useSyncExternalStore } = jest.requireActual<{
    useSyncExternalStore: typeof UsarArmazenamento
  }>('react')
  return {
    usePathname: () =>
      useSyncExternalStore(
        (o: () => void) => {
          mockOuvintes.add(o)
          return () => mockOuvintes.delete(o)
        },
        () => mockCaminho,
      ),
  }
})

/** A pessoa navega para outra tela. */
async function irPara(caminho: string) {
  mockCaminho = caminho
  await act(async () => mockOuvintes.forEach((o) => o()))
}
jest.mock('../anunciar', () => ({ anunciar: jest.fn() }))
jest.mock('../acessibilidade', () => ({
  usePreferenciasDeAcessibilidade: jest.fn(() => ({
    reduzirMovimento: true,
    reduzirTransparencia: false,
    aumentarContraste: false,
  })),
}))

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockCaminho = '/evento/1'
})

afterEach(async () => {
  // O armazenamento é do módulo, não da árvore: cada teste termina sem pendente.
  await act(async () => {
    desfazerAgora()
    desfazerAgora()
  })
  jest.useRealTimers()
})

const passar = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms))
const esperasTodas = ESPERAS_ENTRE_TENTATIVAS_MS.reduce((a, b) => a + b, 0)

describe('a ação pendente nunca se perde (D74)', () => {
  test('segundo plano durante a espera: o envio sai na hora, uma vez, e a faixa some', async () => {
    const aoConfirmar = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Convocando 2 pessoas.', aoConfirmar })
    })
    await passar(3_000)
    await act(async () => aoMudarEstadoDoApp('inactive'))
    expect(aoConfirmar).not.toHaveBeenCalled()
    await act(async () => aoMudarEstadoDoApp('background'))
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
    expect(haDesfazerPendente()).toBe(false)
    // O relógio parou: nada se repete ao voltar nem ao passar o tempo.
    await act(async () => aoMudarEstadoDoApp('active'))
    await passar(30_000)
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })

  test('a página web é fechada: o envio sai e os pedidos desse instante sobrevivem ao fechamento', async () => {
    const aoConfirmar = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Publicando.', aoConfirmar })
    })
    expect(emDescarga()).toBe(false)
    await act(async () => aoFecharAPagina())
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
    expect(emDescarga()).toBe(true)
  })

  test('a pessoa navega para outra tela (a tela some): o envio sai na hora', async () => {
    const aoConfirmar = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Lembrando 4 pessoas.', aoConfirmar })
    })
    await passar(2_000)
    expect(aoConfirmar).not.toHaveBeenCalled()
    await irPara('/agenda')
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Lembrando 4 pessoas.')).toBeNull()
  })

  test('quando a própria ação leva a outra tela, só a primeira navegação não envia', async () => {
    const aoConfirmar = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Adiando o encontro.', aoConfirmar, seguePeloCaminho: true })
    })
    await irPara('/evento/2')
    expect(aoConfirmar).not.toHaveBeenCalled()
    expect(screen.getByText('Adiando o encontro.')).toBeOnTheScreen()
    await irPara('/agenda')
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })

  test('falha de rede: o envio é repetido sozinho e, passando, nada aparece de errado', async () => {
    const aoConfirmar = jest
      .fn()
      .mockRejectedValueOnce(new SemConexao())
      .mockRejectedValueOnce(new SemConexao())
      .mockResolvedValue(undefined)
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Publicando.', aoConfirmar })
    })
    await act(async () => confirmarAgora())
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
    await passar(ESPERAS_ENTRE_TENTATIVAS_MS[0]!)
    expect(aoConfirmar).toHaveBeenCalledTimes(2)
    await passar(ESPERAS_ENTRE_TENTATIVAS_MS[1]!)
    expect(aoConfirmar).toHaveBeenCalledTimes(3)
    expect(haDesfazerPendente()).toBe(false)
  })

  test('esgotadas as tentativas: a faixa vira "Tentar de novo", sem contagem, e o toque envia de novo', async () => {
    const aoConfirmar = jest.fn().mockRejectedValue(new SemConexao())
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({
        texto: 'Publicando.',
        textoDaFalha: 'Não deu para publicar. Nada foi enviado.',
        aoConfirmar,
      })
    })
    await act(async () => confirmarAgora())
    await passar(esperasTodas)
    expect(aoConfirmar).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Não deu para publicar. Nada foi enviado.')).toBeOnTheScreen()
    expect(screen.queryByText(/ s$/)).toBeNull()
    // A faixa de falha NÃO some sozinha: segue ali depois de muito tempo.
    await passar(60_000)
    expect(screen.getByText('Não deu para publicar. Nada foi enviado.')).toBeOnTheScreen()

    aoConfirmar.mockResolvedValue(undefined)
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(aoConfirmar).toHaveBeenCalledTimes(4)
    expect(haDesfazerPendente()).toBe(false)
  })

  test('recusa do servidor (4xx) não repete sozinha: vai direto para "Tentar de novo"', async () => {
    const aoConfirmar = jest
      .fn()
      .mockRejectedValue(new ErroDaApi(409, 'encontro_fora_do_ar', 'Não está no ar.'))
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Lembrando.', aoConfirmar })
    })
    await act(async () => confirmarAgora())
    await passar(20_000)
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })

  test('uma falha que chega com outro pedido em curso espera a vez: o outro não é enviado antes da hora', async () => {
    const falha = jest.fn().mockRejectedValue(new ErroDaApi(500, 'erro_interno', 'Falhou.'))
    const outro = jest.fn()
    await render(<HospedeiroDeToast />)
    await act(async () => {
      mostrarDesfazer({ texto: 'Primeiro.', aoConfirmar: falha })
    })
    await act(async () => confirmarAgora())
    await act(async () => {
      mostrarDesfazer({ texto: 'Segundo.', aoConfirmar: outro })
    })
    await passar(esperasTodas)
    // O segundo segue na contagem dele, intacto.
    expect(outro).not.toHaveBeenCalled()
    expect(screen.getByText('Segundo.')).toBeOnTheScreen()
    await act(async () => confirmarAgora())
    expect(outro).toHaveBeenCalledTimes(1)
    // Só então a faixa da falha do primeiro aparece.
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeOnTheScreen()
  })
})

describe('o número de segundos é um só', () => {
  /** O texto de uma folha ou de um botão: usa o mesmo número que a faixa conta. */
  function TextoDaFolha() {
    return <Text>{frasePraDesfazer(useSegundosDoDesfazer())}</Text>
  }

  async function leitor(ligado: boolean) {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(ligado)
    await act(async () => conhecerOLeitorDeTela())
  }
  afterEach(async () => {
    await leitor(false)
    jest.restoreAllMocks()
  })

  test('sem leitor de tela: a folha e a faixa dizem 10', async () => {
    await leitor(false)
    await render(
      <>
        <TextoDaFolha />
        <HospedeiroDeToast />
      </>,
    )
    expect(segundosDaEsperaAgora()).toBe(10)
    expect(screen.getByText('Você tem 10 segundos para desfazer.')).toBeOnTheScreen()
    await act(async () => {
      mostrarDesfazer({ texto: 'Convocado.', aoConfirmar: jest.fn() })
    })
    expect(screen.getByText('10 s')).toBeOnTheScreen()
  })

  test('com leitor de tela: a folha, a faixa e o anúncio dizem 20, e mudam juntos ao ligar', async () => {
    await leitor(false)
    await render(
      <>
        <TextoDaFolha />
        <HospedeiroDeToast />
      </>,
    )
    expect(screen.getByText('Você tem 10 segundos para desfazer.')).toBeOnTheScreen()
    await leitor(true)
    expect(segundosDaEsperaAgora()).toBe(20)
    expect(screen.getByText('Você tem 20 segundos para desfazer.')).toBeOnTheScreen()
    await act(async () => {
      mostrarDesfazer({ texto: 'Convocado.', aoConfirmar: jest.fn() })
    })
    expect(screen.getByText('20 s')).toBeOnTheScreen()
    expect(anunciar).toHaveBeenCalledWith(`Convocado. ${DESFAZER.anuncio(20)}`)
  })
})
