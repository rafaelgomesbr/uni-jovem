/**
 * D56: tela com botões no rodapé (`BarraDeAcao`) e a barra de abas
 * flutuante embaixo. Os botões ficam logo acima da barra flutuante, a área
 * segura não entra duas vezes, o fim da rolagem reserva as duas mais o
 * respiro e o toast fica acima de tudo.
 */
import { ALTURA, ESPACO, RITMO } from '@uj/tokens'
import { act, render, screen } from '@testing-library/react-native'
import { DeviceEventEmitter, StyleSheet, Text } from 'react-native'

import { alturaDaBarraDeAcao, BarraDeAcao, ContextoDaBarraFlutuanteEmbaixo } from '../BarraDeAcao'
import { Botao } from '../Botao'
import { ContextoDaBarraDeAbas, fimDaTela, Tela } from '../Tela'
import { registrarRodape, rodapeDoToast } from '../Toast'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))

/** Espaço da barra flutuante num iPhone com Face ID: 24 do fim e 66 de barra. */
const BARRA = 90
/** Área segura de baixo do mesmo iPhone. */
const AREA_SEGURA = 34

/** Um nó da árvore de teste (o tipo não é exportado pela biblioteca). */
type No = ReturnType<typeof screen.getByText>

/** O primeiro ancestral com `paddingBottom` no estilo. */
function paddingDeBaixoAcima(no: No): number | undefined {
  let atual: No | null = no.parent
  while (atual) {
    const estilo = StyleSheet.flatten(atual.props.style) as { paddingBottom?: number } | undefined
    if (estilo?.paddingBottom !== undefined) return estilo.paddingBottom
    atual = atual.parent
  }
  return undefined
}

/** O `paddingBottom` do conteúdo da rolagem em volta do nó. */
function fimDaRolagemEmVolta(no: No): number | undefined {
  let atual: No | null = no.parent
  while (atual) {
    if (atual.props.contentContainerStyle !== undefined) {
      const estilo = StyleSheet.flatten(atual.props.contentContainerStyle) as {
        paddingBottom?: number
      }
      return estilo.paddingBottom
    }
    atual = atual.parent
  }
  return undefined
}

describe('fim da tela (D56)', () => {
  test('com barra de ação sobre a barra flutuante: a soma das duas mais 16, sem a área segura', () => {
    // Antes de medir, o mínimo calculado: botão de 48, 24 de padding, a barra flutuante e 16.
    expect(fimDaTela({ margemDeBaixo: AREA_SEGURA, barraFlutuante: BARRA, barraDeAcao: 0 })).toBe(
      ALTURA.controle + ESPACO.e24 + BARRA + ESPACO.e16,
    )
    // Medida (fonte grande, botão maior): a altura real dela, que já inclui a barra flutuante, mais 16.
    const medida = 120 + BARRA
    expect(
      fimDaTela({ margemDeBaixo: AREA_SEGURA, barraFlutuante: BARRA, barraDeAcao: medida }),
    ).toBe(medida + ESPACO.e16)
  })

  test('sem a barra flutuante, a barra de ação volta a se apoiar na área segura', () => {
    expect(fimDaTela({ margemDeBaixo: AREA_SEGURA, barraFlutuante: 0, barraDeAcao: 0 })).toBe(
      ALTURA.controle + ESPACO.e24 + AREA_SEGURA + ESPACO.e16,
    )
  })

  test('só a barra flutuante: 120, ou a barra mais 16; sem nada, a área segura mais 24', () => {
    expect(
      fimDaTela({ margemDeBaixo: AREA_SEGURA, barraFlutuante: BARRA, barraDeAcao: null }),
    ).toBe(Math.max(RITMO.fimDasAbas, BARRA + ESPACO.e16))
    expect(fimDaTela({ margemDeBaixo: AREA_SEGURA, barraFlutuante: 0, barraDeAcao: null })).toBe(
      AREA_SEGURA + ESPACO.e24,
    )
  })

  test('Tela com barra flutuante e barra de ação: botões acima dela e o fim reservando as duas', async () => {
    await render(
      <ContextoDaBarraDeAbas.Provider value={BARRA}>
        <Tela
          pilha
          titulo="Sábado Jovem"
          barraDeAcao={
            <BarraDeAcao>
              <Botao titulo="Editar" aoPressionar={() => undefined} />
            </BarraDeAcao>
          }
        >
          <Text>Último bloco</Text>
        </Tela>
      </ContextoDaBarraDeAbas.Provider>,
    )
    // Os botões terminam 12 acima da barra flutuante (o fundo da barra de ação desce por trás dela).
    expect(paddingDeBaixoAcima(screen.getByText('Editar'))).toBe(BARRA + ESPACO.e12)
    // O último bloco rola até 16 acima da barra de ação, que está acima da flutuante.
    expect(fimDaRolagemEmVolta(screen.getByText('Último bloco'))).toBe(
      ALTURA.controle + ESPACO.e24 + BARRA + ESPACO.e16,
    )
    // O toast fica acima das duas.
    expect(rodapeDoToast()).toBe(alturaDaBarraDeAcao(BARRA))

    // Teclado aberto: a barra flutuante some e a barra de ação volta ao fim (área segura do dublê: 0).
    await act(async () => DeviceEventEmitter.emit('keyboardWillShow', {}))
    expect(paddingDeBaixoAcima(screen.getByText('Editar'))).toBe(ESPACO.e12)
    await act(async () => DeviceEventEmitter.emit('keyboardWillHide', {}))
    expect(paddingDeBaixoAcima(screen.getByText('Editar'))).toBe(BARRA + ESPACO.e12)
  })

  test('barra de ação fora da barra flutuante: área segura embaixo, como antes', async () => {
    await render(
      <ContextoDaBarraFlutuanteEmbaixo.Provider value={0}>
        <BarraDeAcao>
          <Botao titulo="Salvar" aoPressionar={() => undefined} />
        </BarraDeAcao>
      </ContextoDaBarraFlutuanteEmbaixo.Provider>,
    )
    expect(paddingDeBaixoAcima(screen.getByText('Salvar'))).toBe(ESPACO.e12)
  })
})

describe('rodapé do toast (D56)', () => {
  test('vale o maior registrado, em qualquer ordem; ao sair, volta ao que ficou', () => {
    const tirarAbas = registrarRodape(BARRA)
    const tirarAcao = registrarRodape(alturaDaBarraDeAcao(BARRA))
    // A barra da pilha registra depois da barra de ação (efeito do layout roda por último).
    const tirarPilha = registrarRodape(BARRA)
    expect(rodapeDoToast()).toBe(alturaDaBarraDeAcao(BARRA))
    tirarAcao()
    expect(rodapeDoToast()).toBe(BARRA)
    tirarPilha()
    tirarAbas()
    expect(rodapeDoToast()).toBe(0)
  })
})
