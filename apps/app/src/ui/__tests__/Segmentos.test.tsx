import { act, render, screen, userEvent } from '@testing-library/react-native'
import { useState } from 'react'
import { Dimensions } from 'react-native'

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

  test('quatro rótulos curtos em 360: compacto, com a largura de cada rótulo', () => {
    expect(escolherDisposicao(['Visão geral', 'Etapas', 'Equipe', 'Preparação'], 320)).toEqual({
      nivel: 'compacto',
      proporcional: true,
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

  test('três rótulos longos descem para o compacto antes de virar pílulas', () => {
    expect(escolherDisposicao(['Abertas', 'Procedentes', 'Improcedentes'], 320)).toEqual({
      nivel: 'compacto',
      proporcional: true,
    })
  })

  test('sem espaço nem no compacto: pílulas roláveis (null)', () => {
    expect(escolherDisposicao(['Disponibilidade', 'Indisponibilidade'], 160)).toBeNull()
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
    // O polegar tem 36; os 4 de cima e de baixo (hitSlop) completam os 44.
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
