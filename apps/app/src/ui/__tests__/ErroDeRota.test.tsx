import { Stack } from 'expo-router'
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library'
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui'
import { Text } from 'react-native'

import * as LayoutRaiz from '@/app/_layout'
import NaoEncontrado from '@/app/+not-found'

import { ErroDeRota } from '../ErroDeRota'

/** Tela que quebra ao renderizar enquanto `quebrar` estiver ligado. */
let quebrar = true
function TelaQuebrada() {
  if (quebrar) throw new TypeError("Cannot read properties of undefined (reading 'length')")
  return <Text>Tela de pé</Text>
}

const raiz = {
  default: () => <Stack screenOptions={{ headerShown: false }} />,
  unstable_settings: { screenErrorBoundary: ErroDeRota },
}

function AbasDeTeste() {
  return (
    <Tabs>
      <TabSlot />
      <TabList>
        <TabTrigger name="inicio" href="/">
          <Text>Início</Text>
        </TabTrigger>
        <TabTrigger name="agenda" href="/agenda">
          <Text>Agenda</Text>
        </TabTrigger>
      </TabList>
    </Tabs>
  )
}

describe('limite de erro por tela', () => {
  beforeEach(() => {
    quebrar = true
    // O React registra o erro capturado; aqui ele é esperado.
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  test('o layout raiz do app liga o limite em toda tela e nos layouts', () => {
    expect(LayoutRaiz.unstable_settings.screenErrorBoundary).toBe(ErroDeRota)
    expect(LayoutRaiz.ErrorBoundary).toBe(ErroDeRota)
  })

  test('erro ao renderizar uma tela da pilha: ErroDaTela com voltar e "Tentar de novo"', async () => {
    await renderRouter(
      {
        _layout: raiz,
        index: () => <Text>Início</Text>,
        'evento/novo': TelaQuebrada,
      },
      { initialUrl: '/evento/novo' },
    )

    expect(await screen.findByText('Esta tela não abriu')).toBeOnTheScreen()
    // Linguagem humana, sem o texto técnico do erro.
    expect(screen.getByText('Algo deu errado. Tente de novo em instantes.')).toBeOnTheScreen()
    expect(screen.queryByText(/Cannot read properties/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen()

    quebrar = false
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Tela de pé')).toBeOnTheScreen()
  })

  test('erro que persiste: "Voltar ao início" é a saída que não depende da tela quebrada', async () => {
    await renderRouter(
      {
        _layout: raiz,
        index: () => <Text>Início</Text>,
        'evento/novo': TelaQuebrada,
      },
      { initialUrl: '/evento/novo' },
    )
    // "Tentar de novo" falha outra vez: continua no erro, mas a saída funciona.
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Esta tela não abriu')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao início' }))
    expect(await screen.findByText('Início')).toBeOnTheScreen()
    expect(screen.queryByText('Esta tela não abriu')).toBeNull()
  })

  test('endereço que não existe: "Voltar ao início" leva ao Início, sem laço', async () => {
    await renderRouter(
      {
        _layout: raiz,
        index: () => <Text>Início</Text>,
        '+not-found': NaoEncontrado,
      },
      { initialUrl: '/endereco/que/nao/existe' },
    )
    expect(await screen.findByText('Página não encontrada')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao início' }))
    expect(await screen.findByText('Início')).toBeOnTheScreen()
    expect(screen.queryByText('Página não encontrada')).toBeNull()
  })

  test('erro numa aba: só a aba cai, a barra de abas continua', async () => {
    await renderRouter(
      {
        _layout: raiz,
        '(abas)/_layout': AbasDeTeste,
        '(abas)/index': () => <Text>Conteúdo do Início</Text>,
        '(abas)/agenda': TelaQuebrada,
      },
      { initialUrl: '/agenda' },
    )

    expect(await screen.findByText('Esta tela não abriu')).toBeOnTheScreen()
    // Raiz de aba: sem voltar, e as abas seguem tocáveis.
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull()
    await fireEvent.press(screen.getByText('Início'))
    expect(await screen.findByText('Conteúdo do Início')).toBeOnTheScreen()
  })
})
