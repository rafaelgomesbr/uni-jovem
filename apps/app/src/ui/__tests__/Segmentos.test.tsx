import { act, render, screen, userEvent } from '@testing-library/react-native'
import { TEMAS } from '@uj/tokens'
import { useState } from 'react'
import { Dimensions, StyleSheet } from 'react-native'

import { BotoesDeOrdem } from '../BotoesDeOrdem'
import { escolherDisposicao, Segmentos } from '../Segmentos'

function Exemplo() {
  const [valor, setValor] = useState<'mes' | 'semana'>('mes')
  return (
    <Segmentos
      rotulo="Modo de exibição"
      valor={valor}
      aoMudar={setValor}
      segmentos={[
        { valor: 'mes', rotulo: 'Mês' },
        { valor: 'semana', rotulo: 'Semana' },
      ]}
    />
  )
}

describe('Segmentos', () => {
  test('escolha única com papel radio e estado marcado', async () => {
    await render(<Exemplo />)
    expect(screen.getByRole('radio', { name: 'Mês' })).toBeChecked()
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Semana' }))
    expect(screen.getByRole('radio', { name: 'Semana' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Mês' })).not.toBeChecked()
  })
})

describe('disposição dos segmentos (nenhum rótulo cortado)', () => {
  // Trilho de 320: tela de 360 menos as margens de 20.
  test('rótulos curtos cabem em larguras iguais, no tipo normal', () => {
    expect(escolherDisposicao(['Mês', 'Semana', 'Lista'], 320)).toEqual({
      nivel: 'normal',
      proporcional: false,
    })
  })

  test('quatro rótulos curtos em 360: com letra de 16 (D75) não cabem numa linha e vão para a grade', () => {
    expect(escolherDisposicao(['Visão geral', 'Etapas', 'Equipe', 'Preparação'], 320)).toEqual({
      nivel: 'normal',
      proporcional: false,
      grade: true,
    })
  })

  test('as quatro partes do evento em 360: grade de duas linhas, no tipo normal', () => {
    const partes = ['Visão geral', 'Programação', 'Convocados', 'Preparação']
    expect(escolherDisposicao(partes, 320)).toEqual({
      nivel: 'normal',
      proporcional: false,
      grade: true,
    })
  })

  test('fonte grande com quatro opções: a grade, se couber; senão, empilha', () => {
    const partes = ['Visão geral', 'Programação', 'Convocados', 'Preparação']
    expect(escolherDisposicao(partes, 350, 1.35, 0, true)).toEqual({
      nivel: 'normal',
      proporcional: false,
      grade: true,
    })
    expect(escolherDisposicao(partes, 320, 2, 0, true)).toEqual({
      nivel: 'normal',
      proporcional: false,
      pilha: true,
    })
  })

  test('fonte grande com duas ou três opções: empilham, nunca pílulas roláveis', () => {
    const pilha = { nivel: 'normal', proporcional: false, pilha: true }
    expect(escolherDisposicao(['Calendário', 'Lista'], 320, 1.64, 0, true)).toEqual(pilha)
    expect(escolherDisposicao(['Pessoas', 'Pedidos', 'Convites'], 320, 2.35, 0, true)).toEqual(
      pilha,
    )
  })

  test('três rótulos longos que não cabem numa linha empilham, em vez de rolar de lado (D75)', () => {
    expect(escolherDisposicao(['Abertas', 'Procedentes', 'Improcedentes'], 320)).toEqual({
      nivel: 'normal',
      proporcional: false,
      pilha: true,
    })
  })

  test('sem espaço nem no compacto: empilha (até 6 opções nunca rolam de lado)', () => {
    expect(escolherDisposicao(['Disponibilidade', 'Indisponibilidade'], 160)).toEqual({
      nivel: 'normal',
      proporcional: false,
      pilha: true,
    })
  })

  test('mais de 6 opções que não cabem: pílulas roláveis (null)', () => {
    const muitas = ['Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete'].map((r) => r + r)
    expect(escolherDisposicao(muitas, 160)).toBeNull()
  })
})

describe('BotoesDeOrdem', () => {
  test('rótulos dizem o item; nas pontas, o botão inútil fica desabilitado', async () => {
    const aoSubir = jest.fn()
    const aoDescer = jest.fn()
    await render(
      <BotoesDeOrdem nome="Louvor" posicao={0} total={3} aoSubir={aoSubir} aoDescer={aoDescer} />,
    )
    expect(screen.getByRole('button', { name: 'Subir Louvor' })).toBeDisabled()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Descer Louvor' }))
    expect(aoDescer).toHaveBeenCalledTimes(1)
    expect(aoSubir).not.toHaveBeenCalled()
  })
})

describe('Segmentos com fonte grande (D62, auditoria A1)', () => {
  const janelaOriginal = Dimensions.get('window')
  afterEach(async () => {
    await act(async () => Dimensions.set({ window: janelaOriginal, screen: janelaOriginal }))
  })

  function comFonte(fontScale: number) {
    const janela = { width: 390, height: 844, scale: 3, fontScale }
    Dimensions.set({ window: janela, screen: janela })
  }

  function Dois() {
    const [valor, setValor] = useState<'calendario' | 'lista'>('lista')
    return (
      <Segmentos
        rotulo="Como ver a agenda"
        valor={valor}
        aoMudar={setValor}
        segmentos={[
          { valor: 'lista', rotulo: 'Lista' },
          { valor: 'calendario', rotulo: 'Calendário' },
        ]}
      />
    )
  }

  test.each([1.64, 2.35])(
    'com escala %s, duas opções empilham: nada de faixa rolável',
    async (escala) => {
      comFonte(escala)
      await render(<Dois />)
      const grupo = screen.getByLabelText('Como ver a agenda')
      expect(
        [grupo.props.style]
          .flat(3)
          .some((e: { flexDirection?: string } | null) => e?.flexDirection === 'column'),
      ).toBe(true)
      // As duas opções estão no mesmo grupo, ao alcance do toque, e nenhuma está dentro de uma rolagem lateral.
      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(JSON.stringify(screen.toJSON())).not.toContain('RCTScrollView')
      expect(screen.getByRole('radio', { name: 'Lista' })).toBeChecked()
      await userEvent.setup().press(screen.getByRole('radio', { name: 'Calendário' }))
      expect(screen.getByRole('radio', { name: 'Calendário' })).toBeChecked()
    },
  )

  test('cada opção tem pelo menos 44 pt de alvo, empilhada ou em linha', async () => {
    comFonte(1)
    await render(<Dois />)
    const opcao = screen.getByRole('radio', { name: 'Lista' })
    // O polegar tem 40; os 4 de cima e de baixo (hitSlop) completam os 48.
    expect(opcao.props.hitSlop).toEqual({ top: 4, bottom: 4 })
  })

  test('com a fonte normal, duas opções continuam em linha', async () => {
    comFonte(1)
    await render(<Dois />)
    const grupo = screen.getByLabelText('Como ver a agenda')
    expect(
      [grupo.props.style]
        .flat(3)
        .some((e: { flexDirection?: string } | null) => e?.flexDirection === 'row'),
    ).toBe(true)
  })
})

describe('Segmentos: trilho e polegar em cápsula (D64)', () => {
  const janelaOriginal = Dimensions.get('window')
  beforeEach(() => {
    const janela = { width: 390, height: 844, scale: 3, fontScale: 1 }
    Dimensions.set({ window: janela, screen: janela })
  })
  afterEach(async () => {
    await act(async () => Dimensions.set({ window: janelaOriginal, screen: janelaOriginal }))
  })
  const C = TEMAS.claro.base
  const plano = (no: { props: { style?: unknown } }) =>
    StyleSheet.flatten(no.props.style as never) as Record<string, unknown>

  function Dois() {
    const [valor, setValor] = useState<'a' | 'b'>('a')
    return (
      <Segmentos
        rotulo="Escolha"
        valor={valor}
        aoMudar={setValor}
        segmentos={[
          { valor: 'a', rotulo: 'Lista' },
          { valor: 'b', rotulo: 'Mês' },
        ]}
      />
    )
  }

  test('o trilho tem 48 e raio de cápsula; cada polegar tem 40 e também é cápsula', async () => {
    await render(<Dois />)
    expect(plano(screen.getByLabelText('Escolha'))).toMatchObject({
      minHeight: 48,
      borderRadius: 999,
    })
    expect(plano(screen.getByRole('radio', { name: 'Lista' }))).toMatchObject({
      minHeight: 40,
      borderRadius: 999,
    })
  })

  test('o escolhido tem o texto em `destaque` 600 e o inativo, `textoSuave` 500', async () => {
    await render(<Dois />)
    expect(screen.getByText('Lista')).toHaveStyle({ color: C.destaque })
    expect(screen.getByText('Mês')).toHaveStyle({ color: C.textoSuave })
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Mês' }))
    expect(screen.getByText('Mês')).toHaveStyle({ color: C.destaque })
    expect(screen.getByText('Lista')).toHaveStyle({ color: C.textoSuave })
  })
})
