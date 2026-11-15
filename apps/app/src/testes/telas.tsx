/**
 * Renderiza uma tela com a sessão de verdade (ProvedorDeSessao) sobre um
 * servidor falso: `GET /api/v1/eu` devolve uma pessoa com o papel pedido na
 * comunidade de teste, e as demais rotas vêm de cada teste.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { configure, render, screen } from '@testing-library/react-native'
import type { Papel } from '@uj/dominio'
import type { ReactElement } from 'react'

import { ProvedorDeSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'

import { clienteDeConsultaDeTeste, servidorFalso, type Rota } from './dubles'

// Telas inteiras numa máquina às vezes carregada: dá folga às esperas assíncronas.
configure({ asyncUtilTimeout: 10_000 })

export const COMUNIDADE = '11111111-1111-4111-8111-111111111111'
export const BASE = `/api/v1/c/${COMUNIDADE}`
export const MEU_VINCULO = '22222222-2222-4222-8222-000000000001'
export const FUSO = 'America/Sao_Paulo'

export const PESSOAS = [
  { vinculoId: MEU_VINCULO, contaId: 'conta-eu', nome: 'Ana Souza' },
  { vinculoId: '22222222-2222-4222-8222-000000000002', contaId: 'conta-2', nome: 'Bruno Lima' },
  { vinculoId: '22222222-2222-4222-8222-000000000003', contaId: 'conta-3', nome: 'Carla Dias' },
]

export function respostaEu(papel: Papel) {
  return {
    conta: {
      id: 'conta-eu',
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      whatsapp: null,
      criador: false,
      doisFatores: false,
    },
    comunidades: [
      {
        id: COMUNIDADE,
        nome: 'Jovens Centro',
        cor: '#5B4BDB',
        estado: 'ativa',
        papel,
        designacoes: [],
      },
    ],
  }
}

interface Opcoes {
  papel?: Papel
  rotas?: Record<string, Rota>
}

export async function renderizarTela(
  ui: ReactElement,
  { papel = 'organizador', rotas = {} }: Opcoes = {},
) {
  const servidor = servidorFalso({
    'GET /api/v1/eu': () => ({ status: 200, corpo: respostaEu(papel) }),
    [`GET ${BASE}`]: () => ({
      status: 200,
      corpo: {
        id: COMUNIDADE,
        nome: 'Jovens Centro',
        cor: '#5B4BDB',
        fuso: FUSO,
        estado: 'ativa',
        validadeOfflineDias: 14,
        retencaoInscricoesDias: 90,
        versao: 1,
        meuPapel: papel,
      },
    }),
    [`GET ${BASE}/membros`]: () => ({
      status: 200,
      corpo: {
        membros: PESSOAS.map((p) => ({
          ...p,
          papel: p.contaId === 'conta-eu' ? papel : 'membro',
          estado: 'ativo',
          designacoes: [],
          email: null,
          whatsapp: null,
          criador: false,
          desde: '2026-01-01T00:00:00.000Z',
        })),
      },
    }),
    ...rotas,
  })
  globalThis.fetch = servidor.fetch
  // Sessão já aberta: o provedor vai direto a `GET /api/v1/eu`.
  api.definirAcesso('acesso-de-teste')
  const consultas = clienteDeConsultaDeTeste()
  const resultado = await render(
    <QueryClientProvider client={consultas}>
      <ProvedorDeSessao>{ui}</ProvedorDeSessao>
    </QueryClientProvider>,
  )
  return { servidor, consultas, ...resultado }
}

/** Pedidos feitos a um caminho (com ou sem query). */
export function pedidosPara(
  servidor: ReturnType<typeof servidorFalso>,
  metodo: string,
  caminho: string,
) {
  return servidor.pedidos.filter((p) => p.metodo === metodo && p.url.split('?')[0] === caminho)
}

export { screen }
