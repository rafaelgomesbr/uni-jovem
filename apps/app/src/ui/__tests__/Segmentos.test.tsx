import { render, screen, userEvent } from '@testing-library/react-native'
import { useState } from 'react'

import { BotoesDeOrdem } from '../BotoesDeOrdem'
import { Segmentos } from '../Segmentos'

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
