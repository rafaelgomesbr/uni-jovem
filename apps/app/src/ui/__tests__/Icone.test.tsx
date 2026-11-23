import { PixelRatio, Platform } from 'react-native'

import { ajusteDoSimbolo } from '../Icone'

/**
 * No Android o símbolo é texto de fonte e cresce com a fonte do sistema: a 200% o glifo estourava a
 * caixa e saía cortado (emulador, 23/11/2026). O ajuste pede o tamanho já descontado da escala e
 * mantém a caixa no tamanho pedido.
 */
describe('ajusteDoSimbolo', () => {
  const sistema = Platform.OS
  afterEach(() => {
    Platform.OS = sistema
    jest.restoreAllMocks()
  })

  test('Android com fonte a 200%: pede metade do tamanho e mantém a caixa', () => {
    Platform.OS = 'android'
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2)
    expect(ajusteDoSimbolo(20)).toEqual({ size: 10, style: { width: 20, height: 20 } })
  })

  test('Android com fonte normal (ou menor): sem ajuste', () => {
    Platform.OS = 'android'
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1)
    expect(ajusteDoSimbolo(20)).toEqual({ size: 20, style: { width: 20, height: 20 } })
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(0.85)
    expect(ajusteDoSimbolo(20).size).toBe(20)
  })

  test('iOS e web: o símbolo não escala com a fonte, então não se ajusta', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2)
    for (const so of ['ios', 'web'] as const) {
      Platform.OS = so
      expect(ajusteDoSimbolo(20).size).toBe(20)
    }
  })
})
