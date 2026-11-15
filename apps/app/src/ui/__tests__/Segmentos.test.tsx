import { render, screen, userEvent } from '@testing-library/react-native'
import { useState } from 'react'

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
    const partes = ['Visão geral', 'Programação', 'Quem serve', 'Preparação']
    expect(escolherDisposicao(partes, 320)).toEqual({
      nivel: 'normal',
      proporcional: false,
      grade: true,
    })
  })

  test('fonte grande com quatro opções: a grade, se couber; senão, pílulas', () => {
    const partes = ['Visão geral', 'Programação', 'Quem serve', 'Preparação']
    expect(escolherDisposicao(partes, 350, 1.35, 0, true)).toEqual({
      nivel: 'normal',
      proporcional: false,
      grade: true,
    })
    expect(escolherDisposicao(partes, 320, 2, 0, true)).toBeNull()
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
