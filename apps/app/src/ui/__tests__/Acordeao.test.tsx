import { render, screen, userEvent } from '@testing-library/react-native'
import { Text } from 'react-native'

import { Acordeao, reiniciarAcordeoesDaSessao } from '../Acordeao'

jest.mock('../acessibilidade', () => ({
  ...jest.requireActual('../acessibilidade'),
  usePreferenciasDeAcessibilidade: jest.fn(() => ({
    reduzirMovimento: false,
    reduzirTransparencia: false,
    aumentarContraste: false,
  })),
}))

const { usePreferenciasDeAcessibilidade } = jest.requireMock('../acessibilidade') as {
  usePreferenciasDeAcessibilidade: jest.Mock
}

function Exemplo({ chave }: { chave?: string }) {
  return (
    <Acordeao
      {...(chave ? { chave } : {})}
      rotuloRecolhido="Seu resumo: 2 coisas esperando você. Recolhido, toque para ver."
      rotuloAberto="Seu resumo: 2 coisas esperando você. Aberto, toque para recolher."
      cabecalho={(aberto) => <Text>{aberto ? 'Aberto agora' : '2 coisas esperando você'}</Text>}
    >
      <Text>Responder 2 convocações</Text>
    </Acordeao>
  )
}

const RECOLHIDO = 'Seu resumo: 2 coisas esperando você. Recolhido, toque para ver.'
const ABERTO = 'Seu resumo: 2 coisas esperando você. Aberto, toque para recolher.'

beforeEach(() => {
  reiniciarAcordeoesDaSessao()
  usePreferenciasDeAcessibilidade.mockReturnValue({
    reduzirMovimento: false,
    reduzirTransparencia: false,
    aumentarContraste: false,
  })
})

describe('Acordeao (D62)', () => {
  test('nasce fechado: botão recolhido, com o rótulo que diz o estado, e sem o conteúdo', async () => {
    await render(<Exemplo />)
    const botao = screen.getByRole('button', { name: RECOLHIDO })
    expect(botao).toBeCollapsed()
    expect(screen.getByText('2 coisas esperando você')).toBeOnTheScreen()
    expect(screen.queryByText('Responder 2 convocações')).toBeNull()
  })

  test('tocar abre (aria-expanded e novo rótulo); tocar de novo recolhe', async () => {
    await render(<Exemplo />)
    const usuario = userEvent.setup()
    await usuario.press(screen.getByRole('button', { name: RECOLHIDO }))

    const aberto = screen.getByRole('button', { name: ABERTO })
    expect(aberto).toBeExpanded()
    expect(screen.getByText('Responder 2 convocações')).toBeOnTheScreen()
    // O cabeçalho recebe o estado: a linha pode mudar de texto ao abrir.
    expect(screen.getByText('Aberto agora')).toBeOnTheScreen()

    await usuario.press(aberto)
    expect(screen.getByRole('button', { name: RECOLHIDO })).toBeCollapsed()
    expect(screen.queryByText('Responder 2 convocações')).toBeNull()
  })

  test('a linha tocável tem pelo menos 44 pt de altura', async () => {
    await render(<Exemplo />)
    const botao = screen.getByRole('button', { name: RECOLHIDO })
    const estilo = [botao.props.style]
      .flat(3)
      .reduce(
        (a: Record<string, unknown>, s: Record<string, unknown> | null) => ({ ...a, ...s }),
        {},
      )
    expect(estilo.minHeight).toBeGreaterThanOrEqual(44)
  })

  test('com uma chave, a escolha vale na sessão: voltar à tela mantém aberto', async () => {
    const primeira = await render(<Exemplo chave="resumo" />)
    await userEvent.setup().press(screen.getByRole('button', { name: RECOLHIDO }))
    await primeira.unmount()

    await render(<Exemplo chave="resumo" />)
    expect(screen.getByRole('button', { name: ABERTO })).toBeExpanded()

    // Sessão nova: recolhido de novo.
    reiniciarAcordeoesDaSessao()
    await screen.unmount()
    await render(<Exemplo chave="resumo" />)
    expect(screen.getByRole('button', { name: RECOLHIDO })).toBeCollapsed()
  })

  test('sem chave, cada montagem começa recolhida', async () => {
    const primeira = await render(<Exemplo />)
    await userEvent.setup().press(screen.getByRole('button', { name: RECOLHIDO }))
    await primeira.unmount()
    await render(<Exemplo />)
    expect(screen.getByRole('button', { name: RECOLHIDO })).toBeCollapsed()
  })

  test('abre com a entrada de 200 ms; com "Reduzir movimento", abre sem animação', async () => {
    await render(<Exemplo />)
    await userEvent.setup().press(screen.getByRole('button', { name: RECOLHIDO }))
    // Animado: o conteúdo vem num contêiner com transformação de entrada.
    expect(JSON.stringify(screen.toJSON())).toContain('translateY')
    await screen.unmount()

    usePreferenciasDeAcessibilidade.mockReturnValue({
      reduzirMovimento: true,
      reduzirTransparencia: false,
      aumentarContraste: false,
    })
    await render(<Exemplo />)
    await userEvent.setup().press(screen.getByRole('button', { name: RECOLHIDO }))
    expect(screen.getByText('Responder 2 convocações')).toBeOnTheScreen()
    expect(JSON.stringify(screen.toJSON())).not.toContain('translateY')
  })
})
