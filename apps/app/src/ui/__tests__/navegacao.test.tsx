import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native'
import { router, usePreventRemove } from 'expo-router'
import { Text } from 'react-native'

import { confirmar } from '@/utilidades/confirmar'

import { ItemDaBarraDeAbas, rotulosCabemNaBarra } from '../ItemDaBarraDeAbas'
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

describe('barra de abas com fonte grande (U-09)', () => {
  test('até 1,3 os rótulos sempre aparecem; acima, só se couberem no item', () => {
    const rotulos = ['Início', 'Agenda', 'Programas', 'Equipe']
    expect(rotulosCabemNaBarra(rotulos, 5, 360, 1)).toBe(true)
    expect(rotulosCabemNaBarra(rotulos, 5, 360, 1.3)).toBe(true)
    // "Programas" a 1,6 não cabe num item de 390: a barra fica só com os ícones.
    expect(rotulosCabemNaBarra(rotulos, 5, 390, 1.6)).toBe(false)
    // Numa tela larga, cabe.
    expect(rotulosCabemNaBarra(rotulos, 5, 1024, 1.6)).toBe(true)
  })

  test('sem rótulo, o item mantém o nome para o leitor de tela', async () => {
    await render(
      <>
        <ItemDaBarraDeAbas rotulo="Programas" icone="abaProgramas" ativo={false} semRotulo />
        <Text>fim</Text>
      </>,
    )
    expect(screen.queryByText('Programas')).toBeNull()
    expect(screen.getByLabelText('Programas')).toBeOnTheScreen()
  })
})
