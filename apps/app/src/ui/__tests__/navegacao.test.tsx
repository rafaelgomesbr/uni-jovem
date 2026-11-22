import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import { router, usePreventRemove } from 'expo-router'
import { Text } from 'react-native'

import { confirmar } from '@/utilidades/confirmar'

import { escalaDoRotuloDaBarra, ItemDaBarraDeAbas, rotulosCabemNaBarra } from '../ItemDaBarraDeAbas'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '../navegacao'
import { DURACAO_COM_ACAO, duracaoDoToast } from '../Toast'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))
jest.mock('@/utilidades/confirmar', () => ({ confirmar: jest.fn(async () => true) }))

const prevenir = usePreventRemove as jest.Mock

describe('voltarOu (A2)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('com histórico, volta', () => {
    voltarOu('/avisos')
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
  })

  test('aberto direto (link, notificação, recarga na web), vai ao destino', () => {
    ;(router.canGoBack as jest.Mock).mockReturnValueOnce(false)
    voltarOu('/avisos')
    expect(router.back).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith('/avisos')
  })
})

describe('confirmação de descarte (A5)', () => {
  beforeEach(() => jest.clearAllMocks())

  test('sem nada digitado, sair não pergunta', async () => {
    await renderHook(() => useConfirmarDescarte(false))
    expect(prevenir).toHaveBeenLastCalledWith(false, expect.any(Function))
  })

  test('com algo digitado, sair pergunta; "Descartar" segue a saída bloqueada', async () => {
    await renderHook(() => useConfirmarDescarte(true))
    expect(prevenir).toHaveBeenLastCalledWith(true, expect.any(Function))

    const repetir = jest.fn()
    const aoBloquear = prevenir.mock.calls.at(-1)![1] as (o: { repeat: () => void }) => void
    await act(async () => aoBloquear({ repeat: repetir }))

    await waitFor(() => expect(repetir).toHaveBeenCalledTimes(1))
    expect(confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Descartar o que você escreveu?',
        confirmar: 'Descartar',
        destrutivo: true,
      }),
    )
  })

  test('"Cancelar" no diálogo fica no formulário', async () => {
    ;(confirmar as jest.Mock).mockResolvedValueOnce(false)
    await renderHook(() => useConfirmarDescarte(true))
    const repetir = jest.fn()
    const aoBloquear = prevenir.mock.calls.at(-1)![1] as (o: { repeat: () => void }) => void
    await act(async () => aoBloquear({ repeat: repetir }))
    await waitFor(() => expect(confirmar).toHaveBeenCalled())
    expect(repetir).not.toHaveBeenCalled()
  })

  test('depois de salvar, `liberar` desliga a pergunta antes de sair', async () => {
    const desligar = jest.fn()
    prevenir.mockReturnValue(desligar)
    const { result } = await renderHook(() => useConfirmarDescarte(true))
    await act(async () => result.current())
    expect(desligar).toHaveBeenCalledTimes(1)
    expect(prevenir).toHaveBeenLastCalledWith(false, expect.any(Function))
    prevenir.mockReturnValue(jest.fn())
  })
})

describe('trava de envio (A2, M2)', () => {
  test('o segundo toque, antes da resposta, não passa; solta e passa de novo', async () => {
    const { result } = await renderHook(() => useTravaDeEnvio())
    expect(result.current.pegar()).toBe(true)
    expect(result.current.pegar()).toBe(false)
    result.current.soltar()
    expect(result.current.pegar()).toBe(true)
  })
})

describe('toast com "Desfazer" (U-13)', () => {
  test('com ação, fica no mínimo 10 s; sem ação, 4 s', () => {
    expect(duracaoDoToast('Presença marcada.')).toBe(4000)
    expect(duracaoDoToast('Presença marcada.', false, true)).toBe(DURACAO_COM_ACAO)
    expect(DURACAO_COM_ACAO).toBe(10_000)
    // Com leitor de tela, o dobro.
    expect(duracaoDoToast('Presença marcada.', true, true)).toBe(20_000)
  })
})

describe('barra de abas com fonte grande (U-09, D75)', () => {
  const rotulos = ['Início', 'Agenda', 'Comunidade', 'Perfil']

  test('o rótulo nunca some: a escala fica entre 1 e o menor de (sistema, teto 2, altura da barra)', () => {
    for (const largura of [360, 375, 390, 430, 1024]) {
      for (const fonte of [1, 1.3, 1.6, 2, 3]) {
        const escala = escalaDoRotuloDaBarra(rotulos, 4, largura, fonte)
        expect(escala).toBeGreaterThanOrEqual(1)
        expect(escala).toBeLessThanOrEqual(Math.max(1, Math.min(fonte, 2, 1.5)))
      }
    }
  })

  test('tela larga: o rótulo acompanha a fonte do sistema até onde a barra comporta (1,5)', () => {
    expect(escalaDoRotuloDaBarra(rotulos, 4, 1024, 1)).toBe(1)
    expect(escalaDoRotuloDaBarra(rotulos, 4, 1024, 1.3)).toBeCloseTo(1.3)
    expect(escalaDoRotuloDaBarra(rotulos, 4, 1024, 2)).toBe(1.5)
  })

  test('celular com fonte a 200%: "Comunidade" não cabe maior, então o rótulo fica em 1, nunca some', () => {
    expect(escalaDoRotuloDaBarra(rotulos, 4, 390, 2)).toBeLessThan(1.05)
    expect(rotulosCabemNaBarra(rotulos, 4, 390, 2)).toBe(false)
    expect(rotulosCabemNaBarra(rotulos, 4, 1024, 1.3)).toBe(true)
  })

  test('o rótulo escrito aparece com o nome para o leitor de tela e se ajusta ao item', async () => {
    await render(
      <>
        <ItemDaBarraDeAbas
          rotulo="Comunidade"
          icone="abaComunidade"
          ativo={false}
          escalaDoRotulo={1}
        />
        <Text>fim</Text>
      </>,
    )
    const rotulo = screen.getByText('Comunidade')
    expect(rotulo).toBeOnTheScreen()
    expect(rotulo).toHaveProp('adjustsFontSizeToFit', true)
    expect(rotulo).toHaveProp('maxFontSizeMultiplier', 1)
    expect(screen.getByLabelText('Comunidade')).toBeOnTheScreen()
  })

  test('sem rótulo (barra sem espaço), o item mantém o nome para o leitor de tela', async () => {
    await render(
      <>
        <ItemDaBarraDeAbas rotulo="Escalas" icone="abaEscalas" ativo={false} semRotulo />
        <Text>fim</Text>
      </>,
    )
    expect(screen.queryByText('Escalas')).toBeNull()
    expect(screen.getByLabelText('Escalas')).toBeOnTheScreen()
  })
})
