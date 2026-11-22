import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import { chamadasDoPdf } from '@/servicos/contratoDoPdf'
import type { ItensPorTipo, TipoDeConteudo } from '@/servicos/contratoDosModulos'

import { naComunidade } from '../eventos/consultas'
import type { PdfConferido } from '../pdf/seletorDePdf'

const base = (comunidadeId: string, tipo: TipoDeConteudo) =>
  `${naComunidade(comunidadeId)}/conteudos/${tipo}`

export function useConteudos<T extends TipoDeConteudo>(
  comunidadeId: string,
  tipo: T,
  habilitado = true,
) {
  return useQuery({
    queryKey: [...CHAVES.conteudos(comunidadeId, tipo), 'lista'],
    queryFn: () =>
      api.get<{ itens: ItensPorTipo[T][] }>(base(comunidadeId, tipo)).then((r) => r.itens),
    enabled: habilitado,
  })
}

export function useConteudo<T extends TipoDeConteudo>(
  comunidadeId: string,
  tipo: T,
  itemId: string | null,
) {
  return useQuery({
    queryKey: [...CHAVES.conteudos(comunidadeId, tipo), 'item', itemId],
    queryFn: () => api.get<ItensPorTipo[T]>(`${base(comunidadeId, tipo)}/${itemId}`),
    enabled: itemId !== null,
  })
}

function useMutacaoDeConteudo<V, R>(
  comunidadeId: string,
  tipo: TipoDeConteudo,
  executar: (v: V) => Promise<R>,
) {
  const consultas = useQueryClient()
  return useMutation({
    mutationFn: executar,
    onSuccess: () =>
      Promise.all([
        consultas.invalidateQueries({ queryKey: CHAVES.conteudos(comunidadeId, tipo) }),
        // Músicas mostram os nomes dos músicos: mudar um músico muda a lista de músicas.
        tipo === 'musicos'
          ? consultas.invalidateQueries({ queryKey: CHAVES.conteudos(comunidadeId, 'musicas') })
          : null,
      ]),
  })
}

export function useCriarConteudo(comunidadeId: string, tipo: TipoDeConteudo) {
  return useMutacaoDeConteudo(comunidadeId, tipo, (corpo: Record<string, unknown>) =>
    api.post<{ id: string; versao: number }>(base(comunidadeId, tipo), corpo),
  )
}

export function useEditarConteudo(comunidadeId: string, tipo: TipoDeConteudo) {
  return useMutacaoDeConteudo(
    comunidadeId,
    tipo,
    (v: { id: string; versao: number; corpo: Record<string, unknown> }) =>
      api.patch(`${base(comunidadeId, tipo)}/${v.id}`, { ...v.corpo, versao: v.versao }),
  )
}

export function useExcluirConteudo(comunidadeId: string, tipo: TipoDeConteudo) {
  return useMutacaoDeConteudo(comunidadeId, tipo, (id: string) =>
    api.delete(`${base(comunidadeId, tipo)}/${id}`),
  )
}

export function useDefinirMusicos(comunidadeId: string) {
  return useMutacaoDeConteudo(
    comunidadeId,
    'musicas',
    (v: { musicaId: string; musicoIds: string[] }) =>
      api.put(`${base(comunidadeId, 'musicas')}/${v.musicaId}/musicos`, {
        musicoIds: v.musicoIds,
      }),
  )
}

/**
 * Depois de anexar, trocar ou remover um PDF: a Biblioteca, o repertório dos encontros e o Meu
 * repertório recarregam (o selo "PDF" e a versão mudam). A leitura local do aparelho também: o
 * PDF guardado de uma versão antiga deixa de valer quando o pacote do repertório for baixado.
 */
function useInvalidarPdf(comunidadeId: string) {
  const consultas = useQueryClient()
  return () =>
    Promise.all([
      consultas.invalidateQueries({ queryKey: CHAVES.conteudos(comunidadeId, 'musicas') }),
      // Todas as listas de repertório da comunidade (o prefixo comum das chaves).
      consultas.invalidateQueries({ queryKey: ['c', comunidadeId, 'eventos', 'repertorio'] }),
      consultas.invalidateQueries({ queryKey: CHAVES.meuRepertorio(comunidadeId) }),
    ])
}

/** Anexa (ou troca) o PDF da música. Os bytes já foram conferidos pelo seletor; a API confere de novo. */
export function useAnexarPdf(comunidadeId: string) {
  const invalidar = useInvalidarPdf(comunidadeId)
  return useMutation({
    mutationFn: (v: { musicaId: string; pdf: PdfConferido }) =>
      chamadasDoPdf.enviar(comunidadeId, v.musicaId, v.pdf.bytes, v.pdf.nome),
    onSuccess: invalidar,
  })
}

export function useRemoverPdf(comunidadeId: string) {
  const invalidar = useInvalidarPdf(comunidadeId)
  return useMutation({
    mutationFn: (musicaId: string) => chamadasDoPdf.remover(comunidadeId, musicaId),
    onSuccess: invalidar,
  })
}
