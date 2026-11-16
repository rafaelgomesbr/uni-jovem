import { fireEvent, render, screen } from '@testing-library/react-native'
import { useState } from 'react'
import { View } from 'react-native'

import { CampoDeData, CampoDeHora } from '../CampoDeMomento'

// No iOS, o seletor nativo só mede a altura: a largura vem do pai. Dentro da
// meia coluna "Data | Hora" o calendário saía cortado e a roda de horas sumia
// (largura 0). Por isso o seletor abre numa folha da largura da tela.
function DataEHora() {
  const [data, setData] = useState<string | null>('2026-11-21')
  const [hora, setHora] = useState<string | null>('16:00')
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ flex: 1.4 }}>
        <CampoDeData rotulo="Data" valor={data} aoMudar={setData} />
      </View>
      <View style={{ flex: 1 }}>
        <CampoDeHora rotulo="Hora" valor={hora} aoMudar={setHora} />
      </View>
    </View>
  )
}

describe('CampoDeMomento no iOS', () => {
  test('a data abre numa folha com o calendário na largura toda e "Pronto" fecha', async () => {
    await render(<DataEHora />)
    expect(screen.queryByTestId('seletor-de-data')).toBeNull()

    await fireEvent.press(screen.getByRole('button', { name: /^Data:/ }))

    const seletor = screen.getByTestId('seletor-de-data')
    expect(seletor.props.display).toBe('inline')
    expect(seletor.props.style).toMatchObject({ alignSelf: 'stretch' })
    expect(screen.getByRole('header', { name: 'Escolher a data' })).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'Pronto' }))
    expect(screen.queryByTestId('seletor-de-data')).toBeNull()
  })

  test('a hora abre a roda numa folha, sem depender da coluna estreita', async () => {
    await render(<DataEHora />)

    await fireEvent.press(screen.getByRole('button', { name: /^Hora:/ }))

    const seletor = screen.getByTestId('seletor-de-data')
    expect(seletor.props.display).toBe('spinner')
    expect(seletor.props.style).toMatchObject({ alignSelf: 'stretch' })
    expect(screen.getByRole('header', { name: 'Escolher o horário' })).toBeOnTheScreen()
  })
})
