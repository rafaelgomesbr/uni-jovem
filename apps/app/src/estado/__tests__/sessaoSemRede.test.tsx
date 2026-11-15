import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'
import type { ReactNode } from 'react'

import { criarClienteDaApi } from '@/servicos/api'
import { SemConexao } from '@/servicos/erros'
import { armazenamentoEmMemoria, clienteDeConsultaDeTeste } from '@/testes/dubles'

import { gravarContaSalva, VALIDADE_DA_CONTA_SALVA_MS } from '../contaSalva'
import { ProvedorDeSessao, useSessao } from '../sessao'

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
      papel: 'organizador' as const,
      designacoes: [],
    },
  ],
}

/** Aparelho com sessão guardada (refresh no cofre) e sem nenhuma rede. */
function montarSemRede() {
  const armazenamento = armazenamentoEmMemoria('refresh-guardado')
  const semRede = jest.fn(async () => {
    throw new TypeError('Network request failed')
  })
  const cliente = criarClienteDaApi({
    baseUrl: '',
    plataforma: 'ios',
    armazenamento,
    fetch: semRede as unknown as typeof fetch,
  })
  const consultas = clienteDeConsultaDeTeste()
  const aoEncerrarSessao = jest.fn()
  function Envoltorio({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={consultas}>
        <ProvedorDeSessao cliente={cliente} aoEncerrarSessao={aoEncerrarSessao}>
          {children}
        </ProvedorDeSessao>
      </QueryClientProvider>
    )
  }
  return { Envoltorio, aoEncerrarSessao }
}

describe('abrir sem internet (F13)', () => {
  beforeEach(() => cofre.clear())

  test('com a conta salva, abre direto, na comunidade de sempre', async () => {
    await gravarContaSalva(EU)
    const { Envoltorio } = montarSemRede()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('autenticado'))
    expect(result.current.conta?.id).toBe('conta-1')
    expect(result.current.comunidadeAtiva?.id).toBe('com-1')
    expect(result.current.falhaAoIniciar).toBeNull()
  })

  test('sem conta salva, mostra a falha com "tentar de novo"', async () => {
    const { Envoltorio } = montarSemRede()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.falhaAoIniciar).toBeInstanceOf(SemConexao))
    expect(result.current.estado).toBe('carregando')
  })

  test('conta salva há mais tempo que o teto de validade não abre', async () => {
    const salvaEm = new Date(Date.now() - VALIDADE_DA_CONTA_SALVA_MS - 60_000).toISOString()
    cofre.set('uj.eu', JSON.stringify({ eu: EU, salvaEm }))
    const { Envoltorio } = montarSemRede()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.falhaAoIniciar).toBeInstanceOf(SemConexao))
  })

  test('sair apaga a conta salva e chama a limpeza do offline', async () => {
    await gravarContaSalva(EU)
    const { Envoltorio, aoEncerrarSessao } = montarSemRede()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('autenticado'))
    await act(() => result.current.sair())
    expect(result.current.estado).toBe('anonimo')
    expect(cofre.has('uj.eu')).toBe(false)
    expect(aoEncerrarSessao).toHaveBeenCalledWith('conta-1')
  })
})
