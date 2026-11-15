/**
 * B1 da revisão de acessibilidade: o estado (marcado, ocupado, desabilitado,
 * valor) vai em props `aria-*`, que o React Native traduz para o leitor de
 * tela nativo e o react-native-web leva ao DOM (o `accessibilityState` some na web).
 * No nativo, o Pressable converte os `aria-*` no estado acessível: o teste
 * confere o estado que o leitor de tela recebe.
 */
import { render, screen } from '@testing-library/react-native'

import { BarraDeProgresso } from '../BarraDeProgresso'
import { Botao } from '../Botao'
import { CaixaDeMarcar } from '../CaixaDeMarcar'
import { GrupoDeOpcoes } from '../GrupoDeOpcoes'
import { Segmentos } from '../Segmentos'

describe('estado acessível em aria-*', () => {
  test('caixa de marcar: aria-checked e aria-disabled', async () => {
    await render(<CaixaDeMarcar rotulo="Testar o som" marcada aoMudar={() => {}} desabilitada />)
    const caixa = screen.getByRole('checkbox', { name: 'Testar o som', checked: true })
    expect(caixa).toBeChecked()
    expect(caixa).toBeDisabled()
  })

  test('grupo de opções e segmentos: aria-checked só na escolhida', async () => {
    await render(
      <>
        <GrupoDeOpcoes
          rotulo="Papel"
          valor="membro"
          aoMudar={() => {}}
          opcoes={[
            { valor: 'membro', rotulo: 'Membro' },
            { valor: 'admin', rotulo: 'Admin' },
          ]}
        />
        <Segmentos
          rotulo="Modo"
          valor="semana"
          aoMudar={() => {}}
          segmentos={[
            { valor: 'mes', rotulo: 'Mês' },
            { valor: 'semana', rotulo: 'Semana' },
          ]}
        />
      </>,
    )
    expect(screen.getByRole('radio', { name: 'Membro' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Admin' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Semana', checked: true })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Mês', checked: false })).toBeOnTheScreen()
  })

  test('botão carregando: aria-busy e aria-disabled', async () => {
    await render(<Botao titulo="Salvar" aoPressionar={() => {}} carregando />)
    const botao = screen.getByRole('button', { name: 'Salvar' })
    expect(botao).toBeBusy()
    expect(botao).toBeDisabled()
  })

  test('barra de progresso: aria-valuenow, mínimo, máximo e texto', async () => {
    await render(<BarraDeProgresso fracao={0.5} rotulo="3 de 6 etapas concluídas" />)
    const barra = screen.getByRole('progressbar', { name: '3 de 6 etapas concluídas' })
    expect(barra.props['aria-valuenow']).toBe(50)
    expect(barra.props['aria-valuemin']).toBe(0)
    expect(barra.props['aria-valuemax']).toBe(100)
    expect(barra.props['aria-valuetext']).toBe('3 de 6 etapas concluídas')
  })
})
