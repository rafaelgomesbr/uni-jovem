import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { criarClienteDaApi } from '@/servicos/api'
import { BiometriaRecusada } from '@/servicos/armazenamentoDoRefresh'
import { armazenamentoEmMemoria, clienteDeConsultaDeTeste, servidorFalso } from '@/testes/dubles'

import { lerPreferenciaLocal } from '../preferenciaLocal'
import {
  OFERTA_DISPENSADA,
  ProvedorDeSessao,
  useSessao,
  type OperacoesDeBiometria,
} from '../sessao'

const EU = {
  conta: {
    id: 'conta-1',
    nome: 'Ana Souza',
    email: 'ana@exemplo.com',
    whatsapp: null,
    criador: true,
    doisFatores: true,
  },
  comunidades: [],
}
const SESSAO = { segundoFator: false, acesso: 'acesso-1', refresh: 'refresh-1' }

function montar(opcoes: { ligada?: boolean; inicial?: string | null } = {}) {
  let ligada = opcoes.ligada ?? false
  const biometria: OperacoesDeBiometria & Record<string, jest.Mock> = {
    consultar: jest.fn(async () => ({ disponivel: true, nome: 'Face ID' })),
    ligada: jest.fn(async () => ligada),
    ligar: jest.fn(async () => {
      ligada = true
    }),
    desligar: jest.fn(async () => {
      ligada = false
    }),
  }
  const armazenamento = armazenamentoEmMemoria(opcoes.inicial ?? null)
  const servidor = servidorFalso({
    'POST /api/auth/entrar': () => ({ status: 200, corpo: SESSAO }),
    'POST /api/auth/provedor/google': () => ({ status: 200, corpo: SESSAO }),
    'POST /api/auth/renovar': () => ({ status: 200, corpo: SESSAO }),
    'GET /api/v1/eu': () => ({ status: 200, corpo: EU }),
  })
  const cliente = criarClienteDaApi({
    baseUrl: '',
    plataforma: 'ios',
    armazenamento,
    fetch: servidor.fetch,
  })
  const consultas = clienteDeConsultaDeTeste()
  function Envoltorio({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={consultas}>
        <ProvedorDeSessao cliente={cliente} biometria={biometria} aoEncerrarSessao={jest.fn()}>
          {children}
        </ProvedorDeSessao>
      </QueryClientProvider>
    )
  }
  return { armazenamento, biometria, servidor, Envoltorio }
}

describe('sessão e biometria', () => {
  test('o Criador entra só com a senha (sem desafio) e recebe a oferta do Face ID', async () => {
    const { Envoltorio, servidor } = montar()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('anonimo'))

    let resultado: string | undefined
    await act(async () => {
      resultado = await result.current.entrar({ email: 'ana@exemplo.com', senha: 'frase longa' })
    })

    expect(resultado).toBe('pronto')
    expect(result.current.estado).toBe('autenticado')
    expect(result.current.temSegundoFatorPendente).toBe(false)
    expect(result.current.biometria).toMatchObject({ disponivel: true, oferecer: true })
    expect(servidor.pedidos.map((p) => p.url)).not.toContain('/api/auth/segundo-fator')
  })

  test('aceitar a oferta liga a biometria; "Agora não" não pergunta de novo', async () => {
    const { Envoltorio, biometria } = montar()
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })
    await waitFor(() => expect(result.current.estado).toBe('anonimo'))
    await act(async () => {
      await result.current.entrarComProvedor('google', { idToken: 'token-do-google' })
    })
    expect(result.current.biometria.oferecer).toBe(true)

    await act(async () => {
      await result.current.ligarBiometria()
    })
    expect(biometria.ligar).toHaveBeenCalledTimes(1)
    expect(result.current.biometria).toMatchObject({ ligada: true, oferecer: false })

    await act(async () => {
      await result.current.desligarBiometria()
    })
    expect(result.current.biometria.ligada).toBe(false)

    await act(async () => {
      await result.current.dispensarOfertaDeBiometria()
    })
    expect(await lerPreferenciaLocal<boolean>(OFERTA_DISPENSADA)).toBe(true)
  })

  test('na abertura, biometria cancelada deixa a sessão trancada; desbloquear abre', async () => {
    const { Envoltorio, armazenamento } = montar({ ligada: true, inicial: 'refresh-guardado' })
    ;(armazenamento.ler as jest.Mock).mockRejectedValueOnce(new BiometriaRecusada())
    const { result } = await renderHook(() => useSessao(), { wrapper: Envoltorio })

    await waitFor(() => expect(result.current.estado).toBe('anonimo'))
    expect(result.current.biometria).toMatchObject({ travada: true, ligada: true })
    expect(result.current.falhaAoIniciar).toBeNull()

    await act(async () => {
      await result.current.desbloquearComBiometria()
    })
    expect(result.current.estado).toBe('autenticado')
    expect(result.current.biometria.travada).toBe(false)
  })
})
