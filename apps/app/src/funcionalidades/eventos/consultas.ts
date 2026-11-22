import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rotuloCurtoDoDia, tituloNaData } from '@uj/dominio'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import { chamadasV3 } from '@/servicos/contratoV3'
import type {
  DetalheDaSerie,
  DetalheDoEvento,
  Local,
  RespostaDeModelos,
  ResumoDoEvento,
} from '@/servicos/contratoDosEventos'
import {
  dataDoInstante,
  formatarHora,
  instanteDeDataEHora,
  somarDias,
  type DataLocal,
} from '@/utilidades/datas'

/** Caminho base das rotas de uma comunidade. */
export const naComunidade = (comunidadeId: string) => `/api/v1/c/${comunidadeId}`

/** Query string sem depender do URLSearchParams (incompleto no React Native). */
export function textoDeConsulta(parametros: Record<string, string | number | null | undefined>) {
  const pares = Object.entries(parametros)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return pares.length ? `?${pares.join('&')}` : ''
}

/**
 * O título que combina com o dia (D78): um encontro que se chama só "Sábado" e cai num domingo (o
 * título padrão antigo, gravado antes de o app derivar o nome do dia) é mostrado como "Domingo".
 * Título que a pessoa escreveu ("Sábado Jovem", "Retiro") nunca muda. Não mexe nos dados: é só a
 * exibição, igual em toda tela que lê encontros daqui.
 */
export function comTituloDoDia<T extends { titulo: string; inicio: string; fuso: string }>(
  e: T,
): T {
  const titulo = tituloNaData(e.titulo, dataDoInstante(e.inicio, e.fuso))
  return titulo === e.titulo ? e : { ...e, titulo }
}

const listaComTituloDoDia = (eventos: ResumoDoEvento[]) => eventos.map(comTituloDoDia)

/** Eventos com início em [de, ate). Passe sempre `de`: sem ele a API começa pelos mais antigos. */
export function useEventosNoPeriodo(
  comunidadeId: string | null,
  de: string | null,
  ate: string | null,
) {
  return useQuery({
    queryKey: CHAVES.eventosNoPeriodo(comunidadeId ?? '', de, ate),
    queryFn: ({ signal }) =>
      api
        .get<{ eventos: ResumoDoEvento[] }>(
          `${naComunidade(comunidadeId!)}/eventos${textoDeConsulta({ de, ate })}`,
          { sinal: signal },
        )
        .then((r) => r.eventos),
    select: listaComTituloDoDia,
    enabled: comunidadeId !== null,
  })
}

/** Um encontro que já existe num dia, para avisar antes de criar outro por cima (D74). */
export interface EncontroDoDia {
  id: string
  titulo: string
  /** "16:00". */
  hora: string
  status: ResumoDoEvento['status']
}

/**
 * Os encontros (menos os cancelados) que já existem num dia. `ignorarId` é o próprio rascunho da
 * tela. Sem data, não pergunta nada.
 */
export function useEncontrosNoDia(
  comunidadeId: string | null,
  data: DataLocal | null,
  fuso: string,
  ignorarId: string | null = null,
): EncontroDoDia[] {
  const de = data ? instanteDeDataEHora(data, '00:00', fuso) : null
  const ate = data ? instanteDeDataEHora(somarDias(data, 1), '00:00', fuso) : null
  const lista = useEventosNoPeriodo(data ? comunidadeId : null, de, ate)
  return (lista.data ?? [])
    .filter(
      (e) =>
        e.status !== 'cancelado' &&
        e.id !== ignorarId &&
        data !== null &&
        dataDoInstante(e.inicio, e.fuso) === data,
    )
    .map((e) => ({
      id: e.id,
      titulo: e.titulo,
      hora: formatarHora(e.inicio, e.fuso),
      status: e.status,
    }))
}

/** Um encontro que já existe num dos dias escolhidos no Novo encontro (D78). */
export interface EncontroDeUmDia extends EncontroDoDia {
  data: DataLocal
}

/**
 * Os encontros (menos os cancelados) que já existem em qualquer um dos dias escolhidos: uma
 * consulta só, do primeiro ao último dia. Sem dias, não pergunta nada.
 */
export function useEncontrosNosDias(
  comunidadeId: string | null,
  dias: readonly DataLocal[],
  fuso: string,
): EncontroDeUmDia[] {
  const ordem = [...dias].sort()
  const primeiro = ordem[0] ?? null
  const ultimo = ordem.at(-1) ?? null
  const de = primeiro ? instanteDeDataEHora(primeiro, '00:00', fuso) : null
  const ate = ultimo ? instanteDeDataEHora(somarDias(ultimo, 1), '00:00', fuso) : null
  const lista = useEventosNoPeriodo(primeiro ? comunidadeId : null, de, ate)
  return (lista.data ?? [])
    .filter((e) => e.status !== 'cancelado' && dias.includes(dataDoInstante(e.inicio, e.fuso)))
    .map((e) => ({
      id: e.id,
      titulo: e.titulo,
      hora: formatarHora(e.inicio, e.fuso),
      status: e.status,
      data: dataDoInstante(e.inicio, e.fuso),
    }))
}

/** "Culto de jovens, 16:00" ou "Culto de jovens, 16:00 (rascunho)". */
function descreverEncontroDoDia(e: EncontroDoDia): string {
  return `${e.titulo}, ${e.hora}${e.status === 'rascunho' ? ' (rascunho)' : ''}`
}

/** O aviso de data ocupada: "Já existe um encontro neste dia: Culto de jovens, 16:00." */
export function avisoDeDataOcupada(encontros: readonly EncontroDoDia[]): string {
  const lista = encontros.map(descreverEncontroDoDia).join('; ')
  return encontros.length === 1
    ? `Já existe um encontro neste dia: ${lista}.`
    : `Já existem ${encontros.length} encontros neste dia: ${lista}.`
}

/** Vários dias: "Já existe encontro em sex 12 (Sexta, 16:00) e sáb 13 (Sábado, 16:00)." */
export function avisoDeDiasOcupados(encontros: readonly EncontroDeUmDia[]): string {
  const partes = encontros.map((e) => `${rotuloCurtoDoDia(e.data)} (${descreverEncontroDoDia(e)})`)
  return `Já existe encontro em ${partes.join(' e ')}.`
}

/** A pergunta antes de criar outro por cima. */
export function perguntaDeDataOcupada(encontros: readonly EncontroDoDia[]): string {
  return `${avisoDeDataOcupada(encontros)} Criar outro mesmo assim?`
}

export function useEvento(comunidadeId: string | null, eventoId: string | null) {
  return useQuery({
    queryKey: CHAVES.evento(comunidadeId ?? '', eventoId ?? ''),
    queryFn: ({ signal }) =>
      api.get<DetalheDoEvento>(`${naComunidade(comunidadeId!)}/eventos/${eventoId}`, {
        sinal: signal,
      }),
    select: comTituloDoDia,
    enabled: comunidadeId !== null && !!eventoId,
  })
}

export function useLocais(comunidadeId: string | null) {
  return useQuery({
    queryKey: CHAVES.locais(comunidadeId ?? ''),
    queryFn: () =>
      api.get<{ locais: Local[] }>(`${naComunidade(comunidadeId!)}/locais`).then((r) => r.locais),
    enabled: comunidadeId !== null,
  })
}

export function useModelos(comunidadeId: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: CHAVES.modelos(comunidadeId ?? ''),
    queryFn: () => api.get<RespostaDeModelos>(`${naComunidade(comunidadeId!)}/modelos`),
    enabled: comunidadeId !== null && habilitado,
  })
}

export function useSerie(comunidadeId: string | null, serieId: string | null, habilitado = true) {
  return useQuery({
    queryKey: CHAVES.serie(comunidadeId ?? '', serieId ?? ''),
    queryFn: () => api.get<DetalheDaSerie>(`${naComunidade(comunidadeId!)}/series/${serieId}`),
    enabled: comunidadeId !== null && !!serieId && habilitado,
  })
}

/**
 * Depois de mudar um evento, tudo que mostra eventos precisa recarregar:
 * o detalhe, as listas (agenda, programações) e o Início.
 */
export function useInvalidarEventos(comunidadeId: string) {
  const consultas = useQueryClient()
  return async (eventoId?: string) => {
    await Promise.all([
      eventoId
        ? consultas.invalidateQueries({ queryKey: CHAVES.evento(comunidadeId, eventoId) })
        : null,
      consultas.invalidateQueries({ queryKey: CHAVES.eventos(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.inicio(comunidadeId) }),
      consultas.invalidateQueries({ queryKey: CHAVES.minhasEscalas(comunidadeId) }),
    ])
  }
}

/**
 * De onde copiar "Igual ao último encontro" (D66): até 3 encontros já realizados, um por título.
 * Sob o prefixo dos eventos: publicar ou copiar recarrega. Só a organização chama (403 para o resto).
 */
export function useAnterioresParaCopiar(comunidadeId: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: ['c', comunidadeId ?? '', 'eventos', 'anteriores-para-copiar'] as const,
    queryFn: () => chamadasV3.anterioresParaCopiar(comunidadeId!),
    enabled: comunidadeId !== null && habilitado,
    retry: false,
  })
}

export interface PedidoDeCopia {
  origem: string
  /** AAAA-MM-DD. Sem ela, vale a sugerida pelo servidor. */
  data?: string
  /** HH:MM. Sem ela, a do encontro de origem. */
  hora?: string
  incluirMusicas?: boolean
  /** O rascunho de uma cópia anterior desta mesma tela: sai antes de nascer o novo (nada fica solto). */
  rascunhoAnterior?: string | null
}

/**
 * "Igual ao último encontro" (D66): cria o rascunho copiado e devolve o resumo da conferência.
 * Trocar a data ou as músicas refaz a cópia: o rascunho anterior desta tela é apagado antes
 * (rascunho nunca avisou ninguém, então apagar não machuca ninguém).
 */
export function useCopiarEncontro(comunidadeId: string) {
  const invalidar = useInvalidarEventos(comunidadeId)
  return useMutation({
    mutationFn: async ({ origem, rascunhoAnterior, ...corpo }: PedidoDeCopia) => {
      if (rascunhoAnterior) {
        // Falhar ao apagar não pode impedir a cópia nova: o pior caso é um rascunho a mais na Agenda.
        await api
          .delete(`${naComunidade(comunidadeId)}/eventos/${rascunhoAnterior}`)
          .catch(() => null)
      }
      return chamadasV3.copiarEncontro(comunidadeId, origem, corpo)
    },
    onSuccess: () => invalidar(),
  })
}
