import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type { TipoDeNotificacao } from '@uj/dominio'
import type { Href } from 'expo-router'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { NomeDoIcone } from '@/ui/Icone'

/**
 * Caixa de entrada do sino (D42): `GET /api/v1/eu/notificacoes/caixa`, da
 * conta, com as notificações de todas as comunidades em que ela tem vínculo
 * ativo. Título e texto são os mesmos do aviso no aparelho: genéricos, sem
 * conteúdo de aviso, evento ou pedido de oração.
 */

const CAIXA = '/api/v1/eu/notificacoes/caixa'

/** O contador do sino se atualiza sozinho a cada minuto com o app aberto. */
export const INTERVALO_DO_CONTADOR = 60_000

export type DestinoDaNotificacao =
  | { tela: 'aviso'; avisoId: string }
  | { tela: 'avisos' }
  | { tela: 'evento'; eventoId: string }
  | { tela: 'escalas' }
  /** ADR 0007: novo pedido de entrada (admin e organizadores). */
  | { tela: 'pedidos_de_entrada'; comunidadeId?: string }
  /** ADR 0007: decisão do próprio pedido (quem pediu ainda não é da comunidade). */
  | { tela: 'meus_pedidos' }
  | null

/**
 * Tipos da ADR 0007 que chegam pela caixa antes de entrar na lista de
 * preferências de `@uj/dominio` (não têm interruptor próprio).
 */
export type TipoDeNotificacaoDeEntrada = 'pedido_de_entrada' | 'pedido_decidido'

export interface NotificacaoDaCaixa {
  id: string
  tipo: TipoDeNotificacao | TipoDeNotificacaoDeEntrada
  titulo: string
  texto: string
  comunidade: { id: string; nome: string }
  destino: DestinoDaNotificacao
  lida: boolean
  lidaEm: string | null
  criadoEm: string
}

export interface PaginaDaCaixa {
  notificacoes: NotificacaoDaCaixa[]
  proximoCursor: string | null
}

export const ICONE_DO_TIPO: Readonly<
  Record<TipoDeNotificacao | TipoDeNotificacaoDeEntrada, NomeDoIcone>
> = {
  eventos: 'eventos',
  escalas: 'escalas',
  inscricoes: 'inscricoes',
  tarefas: 'tarefas',
  substituicoes: 'trocar',
  alteracoes_importantes: 'avisoAlerta',
  avisos: 'aviso',
  pedido_de_entrada: 'convidar',
  pedido_decidido: 'convidar',
}

/** A lista de pedidos da Equipe (segmento "Pedidos"). */
export const ROTA_DOS_PEDIDOS: Href = { pathname: '/comunidade', params: { segmento: 'pedidos' } }

/** A rota do app que a notificação abre; `null` quando o alvo não existe mais. */
export function rotaDoDestino(destino: DestinoDaNotificacao): Href | null {
  if (!destino) return null
  switch (destino.tela) {
    case 'pedidos_de_entrada':
      return ROTA_DOS_PEDIDOS
    case 'meus_pedidos':
      return '/comece-por-aqui'
    case 'aviso':
      return { pathname: '/avisos/[avisoId]', params: { avisoId: destino.avisoId } }
    case 'avisos':
      return '/avisos'
    case 'evento':
      return { pathname: '/evento/[eventoId]', params: { eventoId: destino.eventoId } }
    case 'escalas':
      return '/escalas'
  }
}

/**
 * O destino da notificação, com o padrão dos pedidos de entrada: o pedido
 * novo abre a lista da Equipe e a decisão abre "Meus pedidos", mesmo que a
 * API mande sem destino.
 */
export function destinoDaNotificacao(
  n: Pick<NotificacaoDaCaixa, 'tipo' | 'destino'>,
): DestinoDaNotificacao {
  if (n.destino) return n.destino
  if (n.tipo === 'pedido_de_entrada') return { tela: 'pedidos_de_entrada' }
  if (n.tipo === 'pedido_decidido') return { tela: 'meus_pedidos' }
  return null
}

/** "3 não lidas", "1 não lida". */
export function textoDeNaoLidas(n: number): string {
  return n === 1 ? '1 não lida' : `${n} não lidas`
}

/**
 * Contador do sino. Atualiza ao abrir o app (montagem), ao voltar ao primeiro
 * plano (o `focusManager` do React Query, ligado ao AppState no celular e à
 * visibilidade da aba na web) e a cada 60 s enquanto o app está aberto.
 */
export function useNaoLidas(ligado = true) {
  const { estado } = useSessao()
  return useQuery({
    queryKey: CHAVES.notificacoesNaoLidas,
    queryFn: () => api.get<{ naoLidas: number }>(`${CAIXA}/nao-lidas`),
    select: (r) => r.naoLidas,
    enabled: ligado && estado === 'autenticado',
    staleTime: 30_000,
    refetchInterval: INTERVALO_DO_CONTADOR,
    refetchOnWindowFocus: true,
  })
}

/** Lista paginada (20 por página), da mais nova para a mais antiga. */
export function useCaixaDeNotificacoes() {
  return useInfiniteQuery({
    queryKey: CHAVES.paginasDaCaixa,
    queryFn: ({ pageParam }) =>
      api.get<PaginaDaCaixa>(
        pageParam ? `${CAIXA}?cursor=${encodeURIComponent(pageParam)}` : CAIXA,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.proximoCursor,
    staleTime: 15_000,
  })
}

type Paginas = InfiniteData<PaginaDaCaixa, string | null>

function marcarNasPaginas(
  paginas: Paginas | undefined,
  marcar: (n: NotificacaoDaCaixa) => boolean,
): Paginas | undefined {
  if (!paginas) return paginas
  const agora = new Date().toISOString()
  return {
    ...paginas,
    pages: paginas.pages.map((p) => ({
      ...p,
      notificacoes: p.notificacoes.map((n) =>
        !n.lida && marcar(n) ? { ...n, lida: true, lidaEm: agora } : n,
      ),
    })),
  }
}

/** Marca uma como lida: a lista e o contador mudam na hora; o servidor confirma depois. */
export function useMarcarComoLida() {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(`${CAIXA}/${id}/lida`),
    onMutate: (id) => {
      const paginas = consultas.getQueryData<Paginas>(CHAVES.paginasDaCaixa)
      const jaLida = paginas?.pages.some((p) => p.notificacoes.some((n) => n.id === id && n.lida))
      consultas.setQueryData<Paginas>(CHAVES.paginasDaCaixa, (atual) =>
        marcarNasPaginas(atual, (n) => n.id === id),
      )
      if (!jaLida) {
        consultas.setQueryData<{ naoLidas: number }>(CHAVES.notificacoesNaoLidas, (atual) =>
          atual ? { naoLidas: Math.max(0, atual.naoLidas - 1) } : atual,
        )
      }
    },
    onSettled: () => consultas.invalidateQueries({ queryKey: CHAVES.notificacoesNaoLidas }),
  })
}

export function useMarcarTodasComoLidas() {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ marcadas: number }>(`${CAIXA}/lidas`),
    onSuccess: () => {
      consultas.setQueryData<Paginas>(CHAVES.paginasDaCaixa, (atual) =>
        marcarNasPaginas(atual, () => true),
      )
      consultas.setQueryData<{ naoLidas: number }>(CHAVES.notificacoesNaoLidas, { naoLidas: 0 })
    },
    onSettled: () => consultas.invalidateQueries({ queryKey: CHAVES.notificacoesNaoLidas }),
  })
}
