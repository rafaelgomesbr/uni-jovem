import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ehCodigoDaComunidade,
  LIMITES_DA_BUSCA,
  LIMITES_DE_PEDIDOS,
  normalizarCodigoDaComunidade,
} from '@uj/dominio'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type {
  ComunidadeEncontrada,
  MeuPedidoDeEntrada,
  ModoDeEntrada,
  ResultadoDaEntrada,
} from '@/servicos/contrato'
import { mostrarToast } from '@/ui/Toast'

/**
 * Entrar numa comunidade sem convite (ADR 0007): pelo código da comunidade
 * ou pedindo pela busca. Tudo aqui é da CONTA (fora de `/c/:id`): a conta
 * ainda não tem vínculo com a comunidade.
 */

/** Mínimo de letras para buscar (a API recusa menos). */
export const MINIMO_DA_BUSCA = LIMITES_DA_BUSCA.minimoDeLetras

/** Recado do pedido de entrada (TC-17). */
export const MAXIMO_DA_MENSAGEM = LIMITES_DE_PEDIDOS.caracteresDaMensagem

/**
 * Tira o código do que a pessoa digitou, colou ou leu no QR: o código puro
 * (com ou sem espaço e hífen, maiúsculas ou minúsculas) ou o link
 * `https://<host>/entrar/<codigo>`. `null` se não reconhecer.
 */
export function lerCodigoDaComunidade(texto: string): string | null {
  const limpo = texto.trim()
  if (!limpo) return null
  const doLink = /\/entrar\/([A-Za-z0-9-]+)\/?(?:[?#].*)?$/.exec(limpo)?.[1]
  const candidato = normalizarCodigoDaComunidade(doLink ?? limpo)
  return ehCodigoDaComunidade(candidato) ? candidato : null
}

/** "ABCD 2345": mais fácil de ler em voz alta e de conferir. */
export function formatarCodigoDaComunidade(codigo: string): string {
  return codigo.length === 8 ? `${codigo.slice(0, 4)} ${codigo.slice(4)}` : codigo
}

/** Uma linha que explica cada modo de entrada (Configurações e código da comunidade). */
export const MODOS_DE_ENTRADA: readonly {
  valor: ModoDeEntrada
  rotulo: string
  descricao: string
}[] = [
  {
    valor: 'convite',
    rotulo: 'Só por convite',
    descricao: 'Entra só quem recebe um link de convite. O código não funciona.',
  },
  {
    valor: 'codigo_com_aprovacao',
    rotulo: 'Código com aprovação',
    descricao: 'Quem usa o código manda um pedido, e a liderança aceita ou recusa.',
  },
  {
    valor: 'codigo_direto',
    rotulo: 'Código com entrada direta',
    descricao: 'Quem tem o código entra na hora, como membro.',
  },
]

export function useMeusPedidos(ligado = true) {
  return useQuery({
    queryKey: CHAVES.meusPedidos,
    queryFn: () =>
      api.get<{ pedidos: MeuPedidoDeEntrada[] }>('/api/v1/eu/pedidos').then((r) => r.pedidos),
    enabled: ligado,
  })
}

export function useCancelarPedido() {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: (pedidoId: string) => api.delete(`/api/v1/eu/pedidos/${pedidoId}`),
    onSuccess: () => {
      mostrarToast({ texto: 'Pedido cancelado.' })
      return consultas.invalidateQueries({ queryKey: CHAVES.meusPedidos })
    },
  })
}

/**
 * Depois de entrar ou pedir: entrou como membro, a comunidade chega pela
 * `/eu` e vira a ativa; pedido pendente aparece em "Meus pedidos".
 */
export function useDepoisDaEntrada() {
  const consultas = useQueryClient()
  const { trocarComunidade } = useSessao()
  return async (r: ResultadoDaEntrada) => {
    if (r.resultado === 'membro') {
      await consultas.invalidateQueries({ queryKey: CHAVES.eu })
      if (r.comunidade.id) await trocarComunidade(r.comunidade.id)
      mostrarToast({ texto: `Você entrou em ${r.comunidade.nome}.` })
    }
    await consultas.invalidateQueries({ queryKey: CHAVES.meusPedidos })
  }
}

/** Corpo comum da entrada (TC-03.v3, idade quando a API pede, recado opcional). */
export interface CorpoDaEntrada {
  consentimentoFe: boolean
  responsavelCiente: boolean
  faixaEtaria?: string
  mensagem?: string
}

export function useEntrarComCodigo() {
  const depois = useDepoisDaEntrada()
  return useMutation({
    mutationFn: (pedido: CorpoDaEntrada & { codigo: string }) =>
      api.post<ResultadoDaEntrada>('/api/v1/entrada', pedido),
    onSuccess: depois,
    // A mensagem pode ter nome e telefone: não fica no cache depois do envio.
    gcTime: 0,
  })
}

export function usePedirParaEntrar(idPublico: string) {
  const depois = useDepoisDaEntrada()
  return useMutation({
    mutationFn: (pedido: CorpoDaEntrada) =>
      api.post<ResultadoDaEntrada>(`/api/v1/comunidades/${idPublico}/pedidos`, pedido),
    onSuccess: depois,
    gcTime: 0,
  })
}

/** Logotipo de uma comunidade achada na busca (público só para quem escolheu aparecer). */
export function caminhoDoLogotipoPublico(idPublico: string): string {
  return `/api/v1/comunidades/${idPublico}/logo`
}

export function logoDaEncontrada(c: ComunidadeEncontrada) {
  return c.temLogo && c.logoVersao
    ? { caminho: caminhoDoLogotipoPublico(c.idPublico), versao: c.logoVersao }
    : null
}

/**
 * Busca por nome e cidade, só quando a pessoa pede (botão ou teclado). Cada
 * resultado fica guardado pelo `idPublico`: a tela da comunidade encontrada
 * abre dali, sem outra chamada (a API não tem detalhe público).
 */
export function useBuscaDeComunidades(q: string, cidade: string) {
  const consultas = useQueryClient()
  return useQuery({
    queryKey: CHAVES.buscaDeComunidades(q, cidade),
    queryFn: async () => {
      const parametros = new URLSearchParams({ q })
      if (cidade) parametros.set('cidade', cidade)
      const r = await api.get<ComunidadeEncontrada[] | { comunidades: ComunidadeEncontrada[] }>(
        `/api/v1/comunidades/busca?${parametros.toString()}`,
      )
      const lista = Array.isArray(r) ? r : r.comunidades
      for (const c of lista) consultas.setQueryData(CHAVES.comunidadeEncontrada(c.idPublico), c)
      return lista
    },
    enabled: q.length >= MINIMO_DA_BUSCA,
    staleTime: 60_000,
  })
}

/** A comunidade tocada na busca, lida do cache (nunca da rede); `null` se a busca se perdeu. */
export function useComunidadeEncontrada(idPublico: string): ComunidadeEncontrada | null {
  const encontrada = useQuery<ComunidadeEncontrada | null>({
    queryKey: CHAVES.comunidadeEncontrada(idPublico),
    queryFn: () => null,
    enabled: false,
  })
  return encontrada.data ?? null
}
