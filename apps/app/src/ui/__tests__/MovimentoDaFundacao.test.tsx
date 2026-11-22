/**
 * D65 e D67: as primitivas de movimento (cascata, pressionar, revelar, troca de aba), a pílula
 * luminosa da barra, a luz de fundo que sobe com o relógio e a deriva da Aurora fora do login.
 * Com Reduzir movimento tudo vira dissolução de 120 ms (sem deslocamento, escala, passo nem
 * deriva). O dublê do Reanimated vai ao valor final; o teste confere o que foi PEDIDO.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import {
  AURORA,
  BARRA_DE_ABAS,
  LUZ_POR_MOMENTO,
  MOMENTOS_EM_ORDEM,
  MOVIMENTO_DAS_TELAS,
} from '@uj/tokens'
import { StyleSheet, Text } from 'react-native'
import { withDelay, withRepeat, withTiming } from 'react-native-reanimated'

import { definirAbaAtiva } from '../abaAtiva'
import { FundoAurora } from '../FundoAurora'
import { LuzDeBase } from '../LuzDeBase'
import { PilulaDaAba, RECUO_DA_BARRA } from '../PilulaDaAba'
import {
  EntradaEmCascata,
  TransicaoDeAba,
  usePressionar,
  useEntradaEmCascata,
  useRevelar,
} from '../primitivasDeMovimento'
import { Tela } from '../Tela'
import { ProvedorDeTemaForcado } from '../tema'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  usePreventRemove: jest.fn(() => jest.fn()),
}))
jest.mock('../acessibilidade', () => ({
  usePreferenciasDeAcessibilidade: jest.fn(),
}))
const preferencias = jest.requireMock('../acessibilidade') as {
  usePreferenciasDeAcessibilidade: jest.Mock
}

function definir(
  p: Partial<
    Record<'reduzirMovimento' | 'reduzirTransparencia' | 'aumentarContraste', boolean>
  > = {},
) {
  preferencias.usePreferenciasDeAcessibilidade.mockReturnValue({
    reduzirMovimento: false,
    reduzirTransparencia: false,
    aumentarContraste: false,
    ...p,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  definir()
  definirAbaAtiva(0)
})

const COM_ESCONDIDOS = { includeHiddenElements: true }
const duracoes = () => (withTiming as jest.Mock).mock.calls.map((c) => c[1].duration as number)
const atrasos = () => (withDelay as jest.Mock).mock.calls.map((c) => c[0] as number)
const achatado = (no: { props: { style?: unknown } }) =>
  StyleSheet.flatten(no.props.style as never) as Record<string, unknown>

describe('entrada em cascata: 200 ms por bloco, passo de 30, termina em 350', () => {
  test('o bloco N espera N × 30 ms; do quinto em diante vale 150 (200 + 150 = 350)', async () => {
    for (const ordem of [0, 1, 2, 3, 4, 5, 9]) {
      jest.clearAllMocks()
      await renderHook(() => useEntradaEmCascata(ordem))
      expect(atrasos()).toEqual([Math.min(ordem, 5) * 30])
      expect(duracoes()).toEqual([200])
    }
    expect(Math.min(9, 5) * 30 + 200).toBe(350)
  })

  test('o bloco chega ao lugar: opacidade 1 e deslocamento 0', async () => {
    await render(
      <EntradaEmCascata ordem={2}>
        <Text>Bloco</Text>
      </EntradaEmCascata>,
    )
    expect(screen.getByText('Bloco')).toBeOnTheScreen()
    const pai = screen.getByText('Bloco').parent as never
    expect(achatado(pai)).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] })
  })

  test('Reduzir movimento: dissolve em 120 ms, sem passo e sem deslocamento', async () => {
    definir({ reduzirMovimento: true })
    await renderHook(() => useEntradaEmCascata(4))
    expect(atrasos()).toEqual([0])
    expect(duracoes()).toEqual([MOVIMENTO_DAS_TELAS.dissolver])
    const { result } = await renderHook(() => useEntradaEmCascata(4))
    expect(result.current).toMatchObject({ transform: [{ translateY: 0 }] })
  })

  test('`ativa={false}` não anima (o bloco já está lá)', async () => {
    await renderHook(() => useEntradaEmCascata(1, { ativa: false }))
    expect(withTiming).not.toHaveBeenCalled()
  })
})

describe('pressionar e revelar', () => {
  test('usePressionar devolve os gestos do Pressable e as camadas do toque (a mesma do botão)', async () => {
    const { result } = await renderHook(() => usePressionar())
    expect(Object.keys(result.current.propsDoPressable).sort()).toEqual([
      'onHoverIn',
      'onHoverOut',
      'onPressIn',
      'onPressOut',
    ])
    expect(result.current.estilo).toMatchObject({ transform: [{ scale: 1 }] })
    await act(async () => result.current.propsDoPressable.onPressIn())
    expect(duracoes()).toContain(90)
    expect(result.current.camada).toBeDefined()
  })

  test('Reduzir movimento: pressionar é só a camada, em 80 ms, sem escala', async () => {
    definir({ reduzirMovimento: true })
    const { result } = await renderHook(() => usePressionar())
    await act(async () => result.current.propsDoPressable.onPressIn())
    expect(duracoes()).toEqual([80])
  })

  test('useRevelar: aparece em 200 ms, some em 160; com Reduzir movimento dissolve em 120', async () => {
    const { rerender } = await renderHook((v: boolean) => useRevelar(v), { initialProps: true })
    expect(duracoes()).toEqual([MOVIMENTO_DAS_TELAS.toast.entra])
    jest.clearAllMocks()
    await rerender(false)
    expect(duracoes()).toEqual([MOVIMENTO_DAS_TELAS.toast.sai])
    jest.clearAllMocks()
    definir({ reduzirMovimento: true })
    await rerender(true)
    expect(duracoes()).toEqual([MOVIMENTO_DAS_TELAS.dissolver])
  })
})

describe('transição entre abas: a tela dissolve, nada desliza', () => {
  test('entra em 160 ms e sai em 120 ms; com Reduzir movimento, 120 nos dois', async () => {
    const { rerender } = await render(
      <TransicaoDeAba ativa>
        <Text>Início</Text>
      </TransicaoDeAba>,
    )
    expect(duracoes()).toEqual([MOVIMENTO_DAS_TELAS.abaDissolve])
    jest.clearAllMocks()
    await rerender(
      <TransicaoDeAba ativa={false}>
        <Text>Início</Text>
      </TransicaoDeAba>,
    )
    expect(duracoes()).toEqual([MOVIMENTO_DAS_TELAS.abaDissolveSai])
    jest.clearAllMocks()
    definir({ reduzirMovimento: true })
    await rerender(
      <TransicaoDeAba ativa>
        <Text>Início</Text>
      </TransicaoDeAba>,
    )
    expect(duracoes()).toEqual([MOVIMENTO_DAS_TELAS.dissolver])
  })
})

describe('a pílula luminosa da barra de abas', () => {
  const LARGURA_DA_BARRA = 358
  const ITEM = (LARGURA_DA_BARRA - 2 * RECUO_DA_BARRA) / 4

  async function montar() {
    await render(
      <ProvedorDeTemaForcado nome="escuro">
        <PilulaDaAba quantidade={4} />
      </ProvedorDeTemaForcado>,
    )
  }
  async function medir() {
    await fireEvent(screen.getByTestId('area-da-pilula', COM_ESCONDIDOS), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: LARGURA_DA_BARRA, height: 68 } },
    })
  }
  const translacaoX = () => {
    const t = achatado(screen.getByTestId('pilula-da-aba', COM_ESCONDIDOS)).transform as
      { translateX?: number }[] | undefined
    return t?.find((x) => x.translateX !== undefined)?.translateX
  }

  test('antes de medir a barra não desenha a pílula; o recuo é o preenchimento mais a borda', async () => {
    await montar()
    expect(screen.queryByTestId('pilula-da-aba', COM_ESCONDIDOS)).toBeNull()
    expect(RECUO_DA_BARRA).toBe(BARRA_DE_ABAS.preenchimento + 1)
  })

  test('depois de medir, ocupa um quarto da largura útil, sob a primeira aba, com anel e luz de 22', async () => {
    await montar()
    await medir()
    const pilula = screen.getByTestId('pilula-da-aba', COM_ESCONDIDOS)
    expect(achatado(pilula)).toMatchObject({ width: ITEM, top: 7, bottom: 7, borderRadius: 28 })
    expect(translacaoX()).toBe(RECUO_DA_BARRA)
    const sombra = String(achatado(pilula).boxShadow)
    expect(sombra).toContain('inset 0px 0px 0px 1px rgba(255,138,101,0.45)')
    expect(sombra).toContain('0px 0px 22px -6px rgba(255,138,101,0.45)')
  })

  test('a aba nova leva a pílula por translateX em 260 ms, na curva da pílula', async () => {
    await montar()
    await medir()
    jest.clearAllMocks()
    await act(async () => definirAbaAtiva(2))
    expect(duracoes()).toEqual([MOVIMENTO_DAS_TELAS.pilulaDaAba])
    expect(translacaoX()).toBeCloseTo(RECUO_DA_BARRA + 2 * ITEM)
    await act(async () => definirAbaAtiva(3))
    expect(translacaoX()).toBeCloseTo(RECUO_DA_BARRA + 3 * ITEM)
  })

  test('Reduzir movimento: a pílula troca de lugar sem deslizar', async () => {
    definir({ reduzirMovimento: true })
    await montar()
    await medir()
    jest.clearAllMocks()
    await act(async () => definirAbaAtiva(1))
    expect(withTiming).not.toHaveBeenCalled()
    expect(translacaoX()).toBeCloseTo(RECUO_DA_BARRA + ITEM)
  })

  test('Aumentar contraste: o anel vira uma linha de 2 pt em destaque, sem luz', async () => {
    definir({ aumentarContraste: true })
    await montar()
    await medir()
    const sombra = String(achatado(screen.getByTestId('pilula-da-aba', COM_ESCONDIDOS)).boxShadow)
    expect(sombra).toContain('inset 0px 0px 0px 2px')
    expect(sombra).not.toContain('22px')
  })
})

describe('a luz de base e a deriva da Aurora (D67)', () => {
  test('cada momento leva a luz de base aos valores do protótipo (opacidade e deslocamento)', async () => {
    for (const m of MOMENTOS_EM_ORDEM) {
      const { unmount } = await render(
        <ProvedorDeTemaForcado nome="escuro">
          <LuzDeBase momento={m} />
        </ProvedorDeTemaForcado>,
      )
      const luz = LUZ_POR_MOMENTO[m]
      const horizonte = achatado(screen.getByTestId('luz-horizonte', COM_ESCONDIDOS))
      const poente = achatado(screen.getByTestId('luz-poente', COM_ESCONDIDOS))
      expect(horizonte.opacity).toBe(luz.horizonte.opacidade)
      expect(horizonte.transform).toEqual([{ translateY: luz.horizonte.y }])
      expect(poente.opacity).toBe(luz.poente.opacidade)
      await unmount()
    }
  })

  test('a luz é uma elipse que sai por baixo da tela, em 900 ms; Reduzir movimento dissolve em 120', async () => {
    const { rerender } = await render(<LuzDeBase momento="longe" />)
    const antes = achatado(screen.getByTestId('luz-horizonte', COM_ESCONDIDOS))
    expect(String(antes.backgroundImage)).toContain('radial-gradient(ellipse at 50% 58%')
    expect(antes).toMatchObject({ left: -70, right: -70, bottom: -190, height: 380 })
    jest.clearAllMocks()
    await rerender(<LuzDeBase momento="agora" />)
    expect(duracoes()).toContain(MOVIMENTO_DAS_TELAS.luz)
    jest.clearAllMocks()
    definir({ reduzirMovimento: true })
    await rerender(<LuzDeBase momento="fim" />)
    expect(new Set(duracoes())).toEqual(new Set([MOVIMENTO_DAS_TELAS.dissolver]))
    expect(achatado(screen.getByTestId('luz-horizonte', COM_ESCONDIDOS)).transform).toEqual([
      { translateY: LUZ_POR_MOMENTO.fim.horizonte.y },
    ])
  })

  test('com Aumentar contraste ou Reduzir transparência a luz de base e os brilhos somem (fundo opaco)', async () => {
    for (const preferencia of ['aumentarContraste', 'reduzirTransparencia'] as const) {
      definir({ [preferencia]: true })
      const { unmount } = await render(
        <>
          <LuzDeBase momento="agora" />
          <FundoAurora intensidade={1} movimento="ambiente" momento="agora" />
        </>,
      )
      expect(screen.queryByTestId('luz-horizonte', COM_ESCONDIDOS)).toBeNull()
      expect(withRepeat).not.toHaveBeenCalled()
      await unmount()
    }
  })

  test('o coral acompanha o relógio: o momento "agora" esquenta (escala 1,12) em 900 ms', async () => {
    await render(<FundoAurora intensidade={1} movimento="ambiente" momento="agora" />)
    expect(duracoes()).toContain(MOVIMENTO_DAS_TELAS.luz)
    // A deriva continua valendo junto do relógio (14 s e 18 s, seis meias-voltas).
    expect((withRepeat as jest.Mock).mock.calls.map((c) => c[1])).toEqual([
      AURORA.deriva.coral.meiasVoltas,
      AURORA.deriva.violeta.meiasVoltas,
    ])
  })

  test('Reduzir movimento: sem deriva; o coral só dissolve ao mudar de momento', async () => {
    definir({ reduzirMovimento: true })
    await render(<FundoAurora intensidade={1} movimento="ambiente" momento="fim" />)
    expect(withRepeat).not.toHaveBeenCalled()
    expect(duracoes()).toContain(MOVIMENTO_DAS_TELAS.dissolver)
    expect(duracoes()).not.toContain(MOVIMENTO_DAS_TELAS.luz)
  })

  test('o componente solto continua estático: sem momento e sem movimento, nada anima', async () => {
    await render(<FundoAurora intensidade={1} />)
    expect(withTiming).not.toHaveBeenCalled()
    expect(withRepeat).not.toHaveBeenCalled()
  })
})

describe('a Tela (D67): a deriva vale fora do login e a luz de base acompanha o momento', () => {
  test('toda Tela com Aurora deriva (14 s e 18 s) e traz a luz de base de "longe"', async () => {
    await render(
      <ProvedorDeTemaForcado nome="escuro">
        <Tela pilha titulo="Agenda">
          <Text>Conteúdo</Text>
        </Tela>
      </ProvedorDeTemaForcado>,
    )
    expect((withRepeat as jest.Mock).mock.calls.map((c) => c[1])).toEqual([
      AURORA.deriva.coral.meiasVoltas,
      AURORA.deriva.violeta.meiasVoltas,
    ])
    expect(achatado(screen.getByTestId('luz-horizonte', COM_ESCONDIDOS)).opacity).toBe(
      LUZ_POR_MOMENTO.longe.horizonte.opacidade,
    )
  })

  test('o `momento` da Tela move a luz de base e o coral', async () => {
    await render(
      <Tela pilha titulo="Encontro" momento="agora">
        <Text>Conteúdo</Text>
      </Tela>,
    )
    expect(achatado(screen.getByTestId('luz-horizonte', COM_ESCONDIDOS)).opacity).toBe(
      LUZ_POR_MOMENTO.agora.horizonte.opacidade,
    )
    expect(duracoes()).toContain(MOVIMENTO_DAS_TELAS.luz)
  })

  test('Reduzir movimento: a Tela não deriva (a luz e o coral só dissolvem)', async () => {
    definir({ reduzirMovimento: true })
    await render(
      <Tela pilha titulo="Agenda" momento="dia">
        <Text>Conteúdo</Text>
      </Tela>,
    )
    expect(withRepeat).not.toHaveBeenCalled()
  })

  test('a Aurora some do Ao vivo (intensidade 0): sem deriva e sem luz de base', async () => {
    await render(
      <Tela pilha titulo="Ao vivo" aurora={0}>
        <Text>Conteúdo</Text>
      </Tela>,
    )
    expect(withRepeat).not.toHaveBeenCalled()
    expect(screen.queryByTestId('luz-horizonte', COM_ESCONDIDOS)).toBeNull()
  })
})
