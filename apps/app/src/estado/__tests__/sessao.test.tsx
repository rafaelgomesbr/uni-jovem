import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { criarClienteDaApi } from '@/servicos/api'
import { armazenamentoEmMemoria, clienteDeConsultaDeTeste, servidorFalso } from '@/testes/dubles'

import { CHAVES } from '../clienteDeConsulta'
import { ProvedorDeSessao, useSessao } from '../sessao'

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
      estado: 'ativa',
      papel: 'admin',
      designacoes: [],
    },
  ],
}

function montar() {
  const armazenamento = armazenamentoEmMemoria()
  const servidor = servidorFalso({
    'POST /api/auth/entrar': () => ({
      status: 200,
      corpo: { segundoFator: false, acesso: 'acesso-1', refresh: 'refresh-1' },
    }),
    'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
    'POST /api/auth/sair': () => ({ status: 200, corpo: { ok: true } }),
  })
  const cliente = criarClienteDaApi({
    baseUrl: '',
    plataforma: 'ios',
    armazenamento,
    fetch: servidor.fetch,
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
  return { armazenamento, servidor, cliente, consultas, aoEncerrarSessao, Envoltorio }
}

describe('estado de sessão', () => {
  test('sem refresh guardado, abre como anônimo sem ir à rede', async () => {
    const { Envoltorio, servidor } = montar()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })

    await waitFor(() => expect(result.current.estado).toBe('anonimo'))
    expect(servidor.pedidos).toHaveLength(0)
  })

  test('entrar guarda o refresh e, com uma só comunidade, ela já é a ativa', async () => {
    const { Envoltorio, armazenamento } = montar()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('anonimo'))

    await act(async () => {
      await result.current.entrar({ email: 'ana@exemplo.com', senha: 'uma frase longa' })
    })

    expect(result.current.estado).toBe('autenticado')
    expect(result.current.conta?.nome).toBe('Ana Souza')
    expect(result.current.comunidadeAtiva?.nome).toBe('Jovens Centro')
    expect(armazenamento.valor()).toBe('refresh-1')
  })

  test('sair apaga o refresh, limpa o cache e chama aoEncerrarSessao', async () => {
    const { Envoltorio, armazenamento, cliente, consultas, aoEncerrarSessao, servidor } = montar()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('anonimo'))
    await act(async () => {
      await result.current.entrar({ email: 'ana@exemplo.com', senha: 'uma frase longa' })
    })
    expect(consultas.getQueryData(CHAVES.eu)).toBeDefined()

    await act(async () => {
      await result.current.sair()
    })

    expect(servidor.chamadas('POST /api/auth/sair')).toBe(1)
    expect(armazenamento.apagar).toHaveBeenCalled()
    expect(armazenamento.valor()).toBeNull()
    expect(cliente.temAcesso()).toBe(false)
    expect(consultas.getQueryData(CHAVES.eu)).toBeUndefined()
    expect(aoEncerrarSessao).toHaveBeenCalledTimes(1)
    expect(aoEncerrarSessao).toHaveBeenCalledWith('conta-1')
    expect(result.current.estado).toBe('anonimo')
    expect(result.current.conta).toBeNull()
  })

  test('sair sem rede ainda encerra a sessão neste aparelho', async () => {
    const { Envoltorio, armazenamento, aoEncerrarSessao, servidor } = montar()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('anonimo'))
    await act(async () => {
      await result.current.entrar({ email: 'ana@exemplo.com', senha: 'uma frase longa' })
    })
    ;(servidor.fetch as unknown as jest.Mock).mockImplementation(async () => {
      throw new TypeError('Network request failed')
    })

    await act(async () => {
      await result.current.sair()
    })

    expect(armazenamento.valor()).toBeNull()
    expect(aoEncerrarSessao).toHaveBeenCalledWith('conta-1')
    expect(result.current.estado).toBe('anonimo')
  })
})
