/**
 * D65: deslizar para responder (padrão 5.4 do UX). O gesto é atalho, NUNCA o único caminho:
 * os botões "Aceitar" e "Não posso ir" seguem visíveis, o leitor de tela ganha as ações, e
 * só uma resposta vale por linha. A matemática do gesto é função pura e tem teste de limites.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { DESLIZAR } from '@uj/tokens'
import { createGestureController } from 'react-native-gesture-handler/jest-utils'

import { DeslizarParaResponder } from '../DeslizarParaResponder'
import { decisaoDoDeslize, limitarArrasto, repousoDaDecisao } from '../decisaoDoDeslize'

const LARGURA = 350
const COM_ESCONDIDOS = { includeHiddenElements: true }

/** Espera de verdade (o aceite sai 120 ms depois que a linha vai embora). */
const esperar = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms + 30))
  })

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
beforeEach(() => reduzir(false))

describe('a matemática do deslizar', () => {
  test('além de 40% da largura para a direita: aceita; até lá, volta', () => {
    expect(decisaoDoDeslize(LARGURA * 0.41, LARGURA)).toBe('aceitar')
    expect(decisaoDoDeslize(LARGURA * DESLIZAR.limiarParaAceitar, LARGURA)).toBe('voltar')
    expect(decisaoDoDeslize(LARGURA * 0.1, LARGURA)).toBe('voltar')
    expect(decisaoDoDeslize(0, LARGURA)).toBe('voltar')
  })

  test('para a esquerda: além de 20% REVELA o "Não posso ir" (nunca recusa sozinho)', () => {
    expect(decisaoDoDeslize(-LARGURA * 0.21, LARGURA)).toBe('revelar')
    expect(decisaoDoDeslize(-LARGURA * 0.19, LARGURA)).toBe('voltar')
    // Nenhuma decisão do gesto é "recusar": só o botão tocado recusa.
    const todas = [-350, -200, -75, 0, 70, 140, 200].map((d) => decisaoDoDeslize(d, LARGURA))
    expect(todas).not.toContain('recusar')
  })

  test('o dedo não leva a linha além de 55% para a direita nem de 38% para a esquerda', () => {
    expect(limitarArrasto(999, LARGURA)).toBeCloseTo(LARGURA * 0.55)
    expect(limitarArrasto(-999, LARGURA)).toBeCloseTo(-LARGURA * 0.38)
    expect(limitarArrasto(40, LARGURA)).toBe(40)
  })

  test('onde a linha descansa: aceita sai com 110%, revelada para em 34% à esquerda, voltar é 0', () => {
    expect(repousoDaDecisao('aceitar', LARGURA)).toBeCloseTo(LARGURA * 1.1)
    expect(repousoDaDecisao('revelar', LARGURA)).toBeCloseTo(-LARGURA * 0.34)
    expect(repousoDaDecisao('voltar', LARGURA)).toBe(0)
  })
})

function linha(props: Partial<Parameters<typeof DeslizarParaResponder>[0]> = {}) {
  const aoAceitar = jest.fn()
  const aoRecusar = jest.fn()
  const ui = (
    <DeslizarParaResponder
      titulo="Louvor, sábado 28"
      descricao="Sáb., 28 de nov. · 16:00"
      aoAceitar={aoAceitar}
      aoRecusar={aoRecusar}
      {...props}
    />
  )
  return { aoAceitar, aoRecusar, ui }
}

describe('DeslizarParaResponder: o gesto nunca é o único caminho', () => {
  test('os dois botões estão sempre visíveis, com as palavras certas', async () => {
    const { ui } = linha()
    await render(ui)
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Não posso ir' })).toBeOnTheScreen()
    expect(screen.getByText('Louvor, sábado 28')).toBeOnTheScreen()
  })

  test('o botão Aceitar aceita uma vez só (o segundo toque não soma)', async () => {
    const { ui, aoAceitar, aoRecusar } = linha()
    await render(ui)
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Não posso ir' }))
    expect(aoAceitar).toHaveBeenCalledTimes(1)
    expect(aoRecusar).not.toHaveBeenCalled()
  })

  test('o botão Não posso ir recusa; depois disso os botões ficam desabilitados', async () => {
    const { ui, aoAceitar, aoRecusar } = linha()
    await render(ui)
    await fireEvent.press(screen.getByRole('button', { name: 'Não posso ir' }))
    expect(aoRecusar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeDisabled()
    expect(aoAceitar).not.toHaveBeenCalled()
  })

  test('o leitor de tela ganha as ações "Aceitar" e "Não posso ir" no título', async () => {
    const { ui, aoAceitar, aoRecusar } = linha()
    await render(ui)
    const titulo = screen.getByLabelText('Louvor, sábado 28. Sáb., 28 de nov. · 16:00')
    expect(titulo).toHaveProp('accessibilityActions', [
      { name: 'aceitar', label: 'Aceitar' },
      { name: 'recusar', label: 'Não posso ir' },
    ])
    await act(async () => {
      titulo.props.onAccessibilityAction({ nativeEvent: { actionName: 'aceitar' } })
    })
    expect(aoAceitar).toHaveBeenCalledTimes(1)
    expect(aoRecusar).not.toHaveBeenCalled()
  })

  test('as ações de acessibilidade "recusar" chamam a recusa, uma vez', async () => {
    const { ui, aoAceitar, aoRecusar } = linha()
    await render(ui)
    const titulo = screen.getByLabelText('Louvor, sábado 28. Sáb., 28 de nov. · 16:00')
    await act(async () => {
      titulo.props.onAccessibilityAction({ nativeEvent: { actionName: 'recusar' } })
      titulo.props.onAccessibilityAction({ nativeEvent: { actionName: 'recusar' } })
    })
    expect(aoRecusar).toHaveBeenCalledTimes(1)
    expect(aoAceitar).not.toHaveBeenCalled()
  })

  test('desabilitado (sem internet): botões sem toque, sem ações e com o motivo escrito', async () => {
    const { ui, aoAceitar, aoRecusar } = linha({
      desabilitado: true,
      motivo: 'Precisa de internet para responder.',
    })
    await render(ui)
    expect(screen.getByText('Precisa de internet para responder.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Não posso ir' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Aceitar' }))
    expect(aoAceitar).not.toHaveBeenCalled()
    expect(aoRecusar).not.toHaveBeenCalled()
    const titulo = screen.getByLabelText('Louvor, sábado 28. Sáb., 28 de nov. · 16:00')
    expect(titulo).toHaveProp('accessibilityActions', [])
  })

  test('os fundos revelados trazem a palavra e o ícone (cor nunca é o único sinal) e começam invisíveis', async () => {
    const { ui } = linha()
    await render(ui)
    const aceitar = screen.getByTestId('fundo-de-aceitar', COM_ESCONDIDOS)
    expect(aceitar).toHaveStyle({ opacity: 0 })
    // A palavra "Aceitar" existe no fundo, além do botão.
    expect(screen.getAllByText('Aceitar', COM_ESCONDIDOS).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByTestId('fundo-de-recusar', COM_ESCONDIDOS)).toHaveStyle({ opacity: 0 })
  })

  test('textos próprios: "Aceitar" e "Não posso ir" podem ser trocados', async () => {
    const { ui } = linha({ rotuloDeAceitar: 'Confirmar', rotuloDeRecusar: 'Não consigo' })
    await render(ui)
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Não consigo' })).toBeOnTheScreen()
  })
})

/** Arrasta a linha de verdade: o dublê do gesture handler dispara os mesmos callbacks do dedo. */
async function arrastar(deslocamento: number) {
  await fireEvent(screen.getByTestId('linha-de-resposta'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: LARGURA, height: 150 } },
  })
  const gesto = createGestureController('deslizar-para-responder')
  await act(async () => {
    gesto.begin()
    gesto.activate()
    gesto.update({ translationX: deslocamento })
  })
  const antesDeSoltar = StyleSheetDaFrente()
  await act(async () => {
    gesto.end({ translationX: deslocamento })
  })
  return antesDeSoltar
}

function StyleSheetDaFrente() {
  const frente = screen.getByTestId('frente-da-resposta')
  const estilo = ([] as unknown[]).concat(frente.props.style).flat(3) as {
    transform?: { translateX: number }[]
  }[]
  return estilo.find((e) => e?.transform)?.transform?.[0]?.translateX ?? 0
}

describe('DeslizarParaResponder: o gesto de verdade', () => {
  test('arrastar além de 40% para a direita e soltar aceita (depois de 120 ms), uma vez', async () => {
    const { ui, aoAceitar, aoRecusar } = linha()
    await render(ui)
    const durante = await arrastar(LARGURA * 0.45)
    // Durante o arrasto, o dedo levou a linha (limitada a 55%).
    expect(durante).toBeCloseTo(LARGURA * 0.45)
    expect(aoAceitar).not.toHaveBeenCalled()
    await esperar(DESLIZAR.atrasoDoAceite)
    expect(aoAceitar).toHaveBeenCalledTimes(1)
    expect(aoRecusar).not.toHaveBeenCalled()
    // A linha saiu com 110% da largura e os botões se fecham: não há segunda resposta.
    expect(StyleSheetDaFrente()).toBeCloseTo(LARGURA * 1.1)
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeDisabled()
  })

  test('arrastar pouco (menos de 40%) e soltar volta ao repouso, sem responder', async () => {
    const { ui, aoAceitar, aoRecusar } = linha()
    await render(ui)
    await arrastar(LARGURA * 0.2)
    await esperar(500)
    expect(aoAceitar).not.toHaveBeenCalled()
    expect(aoRecusar).not.toHaveBeenCalled()
    expect(StyleSheetDaFrente()).toBe(0)
  })

  test('arrastar para a esquerda REVELA o "Não posso ir" e não envia nada; tocar nele recusa', async () => {
    const { ui, aoAceitar, aoRecusar } = linha()
    await render(ui)
    await arrastar(-LARGURA * 0.3)
    await esperar(500)
    expect(aoRecusar).not.toHaveBeenCalled()
    expect(aoAceitar).not.toHaveBeenCalled()
    // A linha ficou aberta em 34% e o fundo de recusar apareceu.
    expect(StyleSheetDaFrente()).toBeCloseTo(-LARGURA * DESLIZAR.aberturaDaEsquerda)
    expect(screen.getByTestId('fundo-de-recusar', COM_ESCONDIDOS)).toHaveStyle({ opacity: 1 })
    await fireEvent.press(screen.getByTestId('revelado-recusar', COM_ESCONDIDOS))
    expect(aoRecusar).toHaveBeenCalledTimes(1)
  })

  test('desabilitada, a linha não se mexe com o gesto', async () => {
    const { ui, aoAceitar } = linha({ desabilitado: true, motivo: 'Precisa de internet.' })
    await render(ui)
    await arrastar(LARGURA * 0.5)
    await esperar(500)
    expect(aoAceitar).not.toHaveBeenCalled()
    expect(StyleSheetDaFrente()).toBe(0)
  })

  test('Reduzir movimento: o gesto continua e o aceite não espera os 120 ms', async () => {
    reduzir(true)
    const { ui, aoAceitar } = linha()
    await render(ui)
    await arrastar(LARGURA * 0.5)
    await esperar(0)
    expect(aoAceitar).toHaveBeenCalledTimes(1)
  })
})
