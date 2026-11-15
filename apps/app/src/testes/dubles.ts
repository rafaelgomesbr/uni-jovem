/**
 * Dublês compartilhados pelos testes: resposta HTTP mínima e um servidor
 * falso que responde por rota.
 */
import { QueryClient } from '@tanstack/react-query'

import type { ArmazenamentoDoRefresh } from '@/servicos/api'

export interface PedidoRegistrado {
  url: string
  metodo: string
  cabecalhos: Record<string, string>
  corpo: unknown
  credenciais: RequestCredentials | undefined
}

type Resposta = { status: number; corpo?: unknown }
export type Rota = (pedido: PedidoRegistrado) => Resposta | Promise<Resposta>

export function resposta(status: number, corpo?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)),
  } as Response
}

/** `fetch` falso: cada chave é "MÉTODO /caminho". Registra todos os pedidos. */
export function servidorFalso(rotas: Record<string, Rota>) {
  const pedidos: PedidoRegistrado[] = []
  const executar = jest.fn(async (url: string, init: RequestInit = {}) => {
    const pedido: PedidoRegistrado = {
      url,
      metodo: init.method ?? 'GET',
      cabecalhos: (init.headers ?? {}) as Record<string, string>,
      corpo: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      credenciais: init.credentials,
    }
    pedidos.push(pedido)
    const caminho = url.replace(/^https?:\/\/[^/]+/, '')
    // Rota com a query exata vence; sem ela, vale a rota só pelo caminho.
    const rota =
      rotas[`${pedido.metodo} ${caminho}`] ?? rotas[`${pedido.metodo} ${caminho.split('?')[0]}`]
    if (!rota) return resposta(404, { erro: 'nao_encontrado', mensagem: 'Rota não simulada.' })
    const r = await rota(pedido)
    return resposta(r.status, r.corpo)
  })
  return {
    fetch: executar as unknown as typeof fetch,
    pedidos,
    chamadas: (chave: string) => pedidos.filter((p) => `${p.metodo} ${p.url}` === chave).length,
  }
}

export function armazenamentoEmMemoria(inicial: string | null = null) {
  let valor = inicial
  const armazenamento: ArmazenamentoDoRefresh & { valor: () => string | null } = {
    ler: jest.fn(async () => valor),
    gravar: jest.fn(async (novo: string) => {
      valor = novo
    }),
    apagar: jest.fn(async () => {
      valor = null
    }),
    valor: () => valor,
  }
  return armazenamento
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Sem novas tentativas e sem coleta por tempo: nada de temporizador vivo depois do teste. */
export function clienteDeConsultaDeTeste(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
}
