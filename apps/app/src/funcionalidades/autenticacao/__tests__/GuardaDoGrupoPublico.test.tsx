/**
 * O guarda do grupo público (D63): segura o redirecionamento por 200 ms só para
 * quem acabou de pedir a entrada (o check do botão aparece), sem criar laço e
 * sem atrasar quem já está logado.
 */
import { act, render, screen } from '@testing-library/react-native'
import { MOVIMENTO_DE_ACESSO } from '@uj/tokens'

import LayoutPublico from '@/app/(publico)/_layout'

import { segurarRedirecionamento, soltarRedirecionamento } from '../sucessoDaEntrada'

const sessao = { estado: 'anonimo', biometria: { oferecer: false } }

jest.mock('@/estado/sessao', () => ({ useSessao: () => sessao }))
jest.mock('@/funcionalidades/navegacao/opcoesDaPilha', () => ({ useOpcoesDaPilha: () => ({}) }))
jest.mock('expo-router', () => {
  const { Text: Texto } = require('react-native')
  const Tela = () => null
  const Pilha = ({ children }: { children?: unknown }) => children ?? null
  Pilha.Screen = Tela
  return {
    Redirect: ({ href }: { href: string }) => <Texto>{`redireciona para ${href}`}</Texto>,
    Stack: Pilha,
  }
})

describe('guarda do grupo público', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    sessao.estado = 'anonimo'
    soltarRedirecionamento(0)
  })
  afterEach(() => {
    soltarRedirecionamento(0)
    jest.useRealTimers()
  })

  test('quem abre o app já logado vai ao Início na hora, sem esperar', async () => {
    sessao.estado = 'autenticado'
    await render(<LayoutPublico />)
    expect(screen.getByText('redireciona para /')).toBeOnTheScreen()
  })

  test('com a pergunta do Face ID pendente, vai a ela', async () => {
    sessao.estado = 'autenticado'
    sessao.biometria.oferecer = true
    await render(<LayoutPublico />)
    expect(screen.getByText('redireciona para /biometria')).toBeOnTheScreen()
    sessao.biometria.oferecer = false
  })

  test('quem acabou de entrar espera 200 ms e depois vai ao Início (nenhum laço)', async () => {
    segurarRedirecionamento()
    sessao.estado = 'autenticado'
    await render(<LayoutPublico />)
    // Durante a espera, a tela de entrada continua (o check aparece) e nada redireciona.
    expect(screen.queryByText(/redireciona para/)).toBeNull()
    soltarRedirecionamento(MOVIMENTO_DE_ACESSO.sucesso)
    await act(async () => {
      jest.advanceTimersByTime(MOVIMENTO_DE_ACESSO.sucesso - 1)
    })
    expect(screen.queryByText(/redireciona para/)).toBeNull()
    await act(async () => {
      jest.advanceTimersByTime(2)
    })
    expect(screen.getByText('redireciona para /')).toBeOnTheScreen()
  })

  test('a entrada que falha solta o guarda na hora: nada fica preso', async () => {
    segurarRedirecionamento()
    soltarRedirecionamento(0)
    sessao.estado = 'autenticado'
    await render(<LayoutPublico />)
    expect(screen.getByText('redireciona para /')).toBeOnTheScreen()
  })

  test('se ninguém soltar, o teto próprio devolve a decisão ao guarda (sem tela presa)', async () => {
    segurarRedirecionamento()
    sessao.estado = 'autenticado'
    await render(<LayoutPublico />)
    expect(screen.queryByText(/redireciona para/)).toBeNull()
    await act(async () => {
      jest.advanceTimersByTime(15_001)
    })
    expect(screen.getByText('redireciona para /')).toBeOnTheScreen()
  })

  test('sem sessão, o guarda mostra as telas do grupo (e não redireciona)', async () => {
    await render(<LayoutPublico />)
    expect(screen.queryByText(/redireciona para/)).toBeNull()
  })
})
