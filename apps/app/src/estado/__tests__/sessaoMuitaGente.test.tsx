import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import type { ReactNode } from 'react'

import { criarClienteDaApi } from '@/servicos/api'
import { ErroDaApi, mensagemDoErro, MENSAGEM_MUITA_GENTE } from '@/servicos/erros'
import { armazenamentoEmMemoria, clienteDeConsultaDeTeste, servidorFalso } from '@/testes/dubles'

import { gravarContaSalva } from '../contaSalva'
import { ProvedorDeSessao, useSessao } from '../sessao'

// Plataforma trocável por teste (a web não guarda conta nem sabe se há cookie).
let mockPlataforma: 'ios' | 'web' = 'ios'
jest.mock('@/servicos/aparelho', () => ({
  ...jest.requireActual('@/servicos/aparelho'),
  plataformaAtual: () => mockPlataforma,
}))

const cofre = (SecureStore as unknown as { __cofre: Map<string, string> }).__cofre

const EU = {
  conta: {
    id: 'conta-1',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    whatsapp: null,
    criador: false,
    doisFatores: false,
  },
  comunidades: [
    {
      id: 'com-1',
      nome: 'Jovens Centro',
      cor: '#5B4BDB',
      estado: 'ativa' as const,
      papel: 'membro' as const,
      designacoes: [],
    },
  ],
}

const MUITA_GENTE = {
  status: 429,
  corpo: {
    erro: 'muitas_tentativas',
    mensagem: 'Muita gente entrando agora. Tente de novo em instantes.',
  },
}

/** A4: o encontro de sábado, 80 jovens no Wi-Fi da igreja, e a API responde 429 ao renovar. */
function montar(plataforma: 'ios' | 'web', refresh: string | null) {
  mockPlataforma = plataforma
  let lotado = true
  const servidor = servidorFalso({
    'POST /api/auth/renovar': () =>
      lotado
        ? MUITA_GENTE
        : { status: 200, corpo: { segundoFator: false, acesso: 'acesso-novo', refresh: 'r2' } },
    'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
  })
  const cliente = criarClienteDaApi({
    baseUrl: '',
    plataforma,
    armazenamento: plataforma === 'web' ? null : armazenamentoEmMemoria(refresh),
    fetch: servidor.fetch,
  })
  const consultas = clienteDeConsultaDeTeste()
  function Envoltorio({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={consultas}>
        <ProvedorDeSessao cliente={cliente} aoEncerrarSessao={jest.fn()}>
          {children}
        </ProvedorDeSessao>
      </QueryClientProvider>
    )
  }
  return { Envoltorio, servidor, liberar: () => (lotado = false) }
}

describe('429 na abertura do app (A4)', () => {
  beforeEach(() => cofre.clear())

  test('celular com a conta guardada: abre com ela, como sem rede', async () => {
    await gravarContaSalva(EU)
    const { Envoltorio } = montar('ios', 'refresh-guardado')
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('autenticado'))
    expect(result.current.conta?.id).toBe('conta-1')
    expect(result.current.falhaAoIniciar).toBeNull()
  })

  test('celular com sessão mas sem conta guardada: "Muita gente entrando agora" e Tentar de novo funciona', async () => {
    const { Envoltorio, liberar } = montar('ios', 'refresh-guardado')
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.falhaAoIniciar).toBeInstanceOf(ErroDaApi))
    expect(mensagemDoErro(result.current.falhaAoIniciar)).toBe(MENSAGEM_MUITA_GENTE)
    expect(result.current.estado).toBe('carregando')

    liberar()
    await act(async () => result.current.tentarDeNovo())
    await waitFor(() => expect(result.current.estado).toBe('autenticado'))
    expect(result.current.falhaAoIniciar).toBeNull()
  })

  test('celular sem sessão: nem chama a API, vai para Entrar', async () => {
    const { Envoltorio, servidor } = montar('ios', null)
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('anonimo'))
    expect(servidor.pedidos).toHaveLength(0)
    expect(result.current.falhaAoIniciar).toBeNull()
  })

  test('web: sem como saber se há sessão, vai para Entrar em vez de travar', async () => {
    const { Envoltorio } = montar('web', null)
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('anonimo'))
    expect(result.current.falhaAoIniciar).toBeNull()
  })
})
