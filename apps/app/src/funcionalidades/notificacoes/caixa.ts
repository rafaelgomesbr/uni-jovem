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
import type { NaoLidasDoSino } from '@/servicos/contratoV3'
import type { NomeDoIcone } from '@/ui/Icone'
import { formatarData } from '@/utilidades/formatos'

import { DESTINO_DE_ESCALAS } from '../navegacao/Redirecionamentos'

/**
 * Caixa de entrada do sino (D42, D68): `GET /api/v1/eu/notificacoes/caixa`, da
 * conta, com as notificações de todas as comunidades em que ela tem vínculo
 * ativo. Título e texto são os mesmos do aviso no aparelho: genéricos, sem
 * conteúdo de aviso, evento ou pedido de oração. Dentro do app, o `assunto`
 * (D66) traz o título real do aviso ou do encontro; nunca há pedido de oração,
 * música ou pessoa nele.
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
  /** Título real do aviso ou do encontro (D66); nulo quando não há ou saiu do ar. */
  assunto?: string | null
  /** O encontro a que ela se refere (convocação, lembrete): abre "Sua parte". */
  eventoId?: string | null
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
      // A antiga aba Escalas virou a Agenda, "Só o que é meu" (D68).
      return DESTINO_DE_ESCALAS
  }
}

/**
 * O destino da notificação, com o padrão dos pedidos de entrada: o pedido
 * novo abre a lista da Equipe e a decisão abre "Meus pedidos", mesmo que a
 * API mande sem destino. A convocação (e o lembrete) que traz o encontro abre o
 * próprio encontro, na linha "Sua parte", em vez da lista (D66, D68).
 */
export function destinoDaNotificacao(
  n: Pick<NotificacaoDaCaixa, 'tipo' | 'destino'> & { eventoId?: string | null },
): DestinoDaNotificacao {
  if (n.destino?.tela === 'escalas' && n.eventoId) {
    return { tela: 'evento', eventoId: n.eventoId }
  }
  if (n.destino) return n.destino
  if (n.tipo === 'pedido_de_entrada') return { tela: 'pedidos_de_entrada' }
  if (n.tipo === 'pedido_decidido') return { tela: 'meus_pedidos' }
  return null
}

/** "agora", "há 5 min", "há 2 h", "há 3 dias"; passada uma semana, a data. */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const minutos = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
  return formatarData(iso)
}

/** Novas (não lidas) em cima, antes (lidas) embaixo, cada grupo na ordem que a API mandou. */
export function agruparPorLeitura(itens: readonly NotificacaoDaCaixa[]) {
  return {
    novas: itens.filter((n) => !n.lida),
    antes: itens.filter((n) => n.lida),
  }
}

/** "1 aviso novo", "4 avisos novos": o agrupamento por tipo é do app (D66). */
export interface ResumoDoTipo {
  chave: 'avisos' | 'convocacoes' | 'pedidosDeEntrada' | 'outras'
  texto: string
}

/**
 * As contagens do selo por tipo, em palavras: "4 avisos novos", "1 convocação nova", "2 pedidos
 * de entrada novos" e, do que sobra, "3 outras novas". Zero não aparece.
 */
export function resumoPorTipo(q: Partial<NaoLidasDoSino> | undefined): ResumoDoTipo[] {
  if (!q) return []
  const avisos = q.avisos ?? 0
  const convocacoes = q.convocacoes ?? 0
  const pedidos = q.pedidosDeEntrada ?? 0
  const outras = Math.max(0, (q.naoLidas ?? 0) - avisos - convocacoes - pedidos)
  const linhas: ResumoDoTipo[] = []
  if (avisos > 0) {
    linhas.push({
      chave: 'avisos',
      texto: `${avisos} ${avisos === 1 ? 'aviso novo' : 'avisos novos'}`,
    })
  }
  if (convocacoes > 0) {
    linhas.push({
      chave: 'convocacoes',
      texto: `${convocacoes} ${convocacoes === 1 ? 'convocação nova' : 'convocações novas'}`,
    })
  }
  if (pedidos > 0) {
    linhas.push({
      chave: 'pedidosDeEntrada',
      texto: `${pedidos} ${pedidos === 1 ? 'pedido de entrada novo' : 'pedidos de entrada novos'}`,
    })
  }
  if (outras > 0) {
    linhas.push({
      chave: 'outras',
      texto: `${outras} ${outras === 1 ? 'outra nova' : 'outras novas'}`,
    })
  }
  return linhas
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
    queryFn: () => api.get<NaoLidasDoSino>(`${CAIXA}/nao-lidas`),
    select: (r) => r.naoLidas,
    enabled: ligado && estado === 'autenticado',
    staleTime: 30_000,
    refetchInterval: INTERVALO_DO_CONTADOR,
    refetchOnWindowFocus: true,
  })
}

/** A mesma consulta do selo, com a quebra por tipo (`avisos`, `convocacoes`, `pedidosDeEntrada`). */
export function useQuebraDoSino() {
  const { estado } = useSessao()
  return useQuery({
    queryKey: CHAVES.notificacoesNaoLidas,
    queryFn: () => api.get<NaoLidasDoSino>(`${CAIXA}/nao-lidas`),
    enabled: estado === 'autenticado',
    staleTime: 30_000,
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
        const tipo = paginas?.pages.flatMap((p) => p.notificacoes).find((n) => n.id === id)?.tipo
        consultas.setQueryData<NaoLidasDoSino>(CHAVES.notificacoesNaoLidas, (atual) =>
          atual
            ? {
                ...atual,
                naoLidas: Math.max(0, atual.naoLidas - 1),
                ...(tipo === 'avisos' && atual.avisos !== undefined
                  ? { avisos: Math.max(0, atual.avisos - 1) }
                  : {}),
                ...(tipo === 'escalas' && atual.convocacoes !== undefined
                  ? { convocacoes: Math.max(0, atual.convocacoes - 1) }
                  : {}),
                ...(tipo === 'pedido_de_entrada' && atual.pedidosDeEntrada !== undefined
                  ? { pedidosDeEntrada: Math.max(0, atual.pedidosDeEntrada - 1) }
                  : {}),
              }
            : atual,
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
      consultas.setQueryData<NaoLidasDoSino>(CHAVES.notificacoesNaoLidas, {
        naoLidas: 0,
        avisos: 0,
        convocacoes: 0,
        pedidosDeEntrada: 0,
      })
    },
    onSettled: () => consultas.invalidateQueries({ queryKey: CHAVES.notificacoesNaoLidas }),
  })
}
