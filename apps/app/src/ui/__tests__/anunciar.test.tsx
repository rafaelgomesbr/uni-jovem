/**
 * A4 e A1 da revisão: um só caminho de anúncio para iOS (fila do VoiceOver),
 * Android (TalkBack) e web (região `aria-live` oculta).
 */
import { render } from '@testing-library/react-native'
import { AccessibilityInfo, Platform, Text } from 'react-native'

import { anunciar } from '../anunciar'
import { anunciar as anunciarNaWeb } from '../anunciar.web'
import { useAnunciar } from '../useAnunciar'

function Anunciante({ texto, soMudancas }: { texto: string | null; soMudancas?: boolean }) {
  useAnunciar(texto, { soMudancas: !!soMudancas })
  return <Text>{texto}</Text>
}

describe('anunciar', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('iOS: entra na fila do VoiceOver (não corta o que está sendo lido)', () => {
    const fila = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
      .mockImplementation(() => {})
    anunciar('  Presença registrada.  ')
    expect(fila).toHaveBeenCalledWith('Presença registrada.', { queue: true })
  })

  test('Android: anúncio do TalkBack; texto vazio não anuncia', () => {
    const original = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    const simples = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {})
    anunciar('Sem conexão')
    anunciar('   ')
    expect(simples).toHaveBeenCalledTimes(1)
    expect(simples).toHaveBeenCalledWith('Sem conexão')
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true })
  })

  test('hook: anuncia quando aparece e quando muda; com soMudancas, ignora o valor inicial', async () => {
    const fila = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
      .mockImplementation(() => {})
    fila.mockClear()
    const { rerender } = await render(<Anunciante texto="Erro: informe o nome" />)
    expect(fila).toHaveBeenLastCalledWith('Erro: informe o nome', { queue: true })

    fila.mockClear()
    const contagem = await render(<Anunciante texto="2 presenças" soMudancas />)
    expect(fila).not.toHaveBeenCalled()
    await contagem.rerender(<Anunciante texto="3 presenças" soMudancas />)
    expect(fila).toHaveBeenCalledWith('3 presenças', { queue: true })

    fila.mockClear()
    await rerender(<Anunciante texto={null} />)
    expect(fila).not.toHaveBeenCalled()
  })

  test('web: escreve numa região aria-live polite oculta, esvaziando antes de repetir', () => {
    jest.useFakeTimers()
    const regiao = {
      id: '',
      textContent: '',
      atributos: {} as Record<string, string>,
      setAttribute(nome: string, valor: string) {
        this.atributos[nome] = valor
      },
    }
    const documento = {
      getElementById: jest.fn(() => (regiao.id ? regiao : null)),
      createElement: jest.fn(() => regiao),
      body: { appendChild: jest.fn() },
    }
    const global_ = globalThis as unknown as { document?: unknown }
    const anterior = global_.document
    global_.document = documento
    try {
      anunciarNaWeb('Conexão de volta.')
      expect(regiao.atributos['aria-live']).toBe('polite')
      expect(regiao.atributos['aria-atomic']).toBe('true')
      expect(regiao.textContent).toBe('')
      jest.advanceTimersByTime(100)
      expect(regiao.textContent).toBe('Conexão de volta.')
      expect(documento.body.appendChild).toHaveBeenCalledTimes(1)
    } finally {
      global_.document = anterior
      jest.useRealTimers()
    }
  })
})
