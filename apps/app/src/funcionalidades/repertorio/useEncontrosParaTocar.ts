import type { EstadoDaAtribuicao } from '@/servicos/contratoDosEventos'
import type { ItemDoMeuRepertorio } from '@/servicos/contratoDoRepertorio'
import { SemConexao } from '@/servicos/erros'

import { repertorioVale } from '../offline/repertorioOffline'
import { useOffline, useRepertoriosGuardados } from '../offline/ProvedorOffline'
import { useMeuRepertorio } from './consultas'

/** Uma música pronta para tocar: o item do repertório com a cifra inteira. */
export type MusicaParaTocar = ItemDoMeuRepertorio

export interface ParteParaTocar {
  funcao: string
  estado: EstadoDaAtribuicao
  /** Só quando os dados vêm da rede: sem ele (cópia do aparelho) não há como responder. */
  atribuicaoId: string | null
}

export interface EncontroParaTocar {
  evento: { id: string; titulo: string; inicio: string; fuso: string }
  partes: ParteParaTocar[]
  itens: MusicaParaTocar[]
  /** Há uma cópia deste repertório guardada neste aparelho (abre sem internet). */
  baixado: boolean
}

export type SituacaoDoRepertorioParaTocar =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown; tentarDeNovo: () => void }
  /** Sem internet e sem cópia guardada: não há o que mostrar. */
  | { tipo: 'sem_copia'; tentarDeNovo: () => void }
  | {
      tipo: 'pronto'
      /** `aparelho`: veio da cópia guardada, sem internet. */
      origem: 'rede' | 'aparelho'
      encontros: EncontroParaTocar[]
    }

/**
 * O que a pessoa toca nos próximos encontros, de onde vier: da rede (`/meu-repertorio`) ou, sem
 * internet, da cópia guardada no aparelho (D71). Com cópia guardada a lista abre sem erro mesmo
 * sem rede. Quem chama não precisa saber de onde veio, só se a cópia existe (`baixado`).
 */
export function useEncontrosParaTocar(comunidadeId: string | null): SituacaoDoRepertorioParaTocar {
  const meu = useMeuRepertorio(comunidadeId)
  const offline = useOffline()
  const guardados = useRepertoriosGuardados()
  const baixados = new Set(offline.repertorios.map((r) => r.eventoId))

  const semRede =
    !offline.online ||
    (meu.isPending && meu.fetchStatus === 'paused') ||
    meu.error instanceof SemConexao
  const tentarDeNovo = () => void meu.refetch()

  const copias = (guardados.data ?? []).filter((r) => repertorioVale(r))
  if (semRede && copias.length > 0) {
    return {
      tipo: 'pronto',
      origem: 'aparelho',
      encontros: copias.map((r) => ({
        evento: {
          id: r.pacote.evento.id,
          titulo: r.pacote.evento.titulo,
          inicio: r.pacote.evento.inicio,
          fuso: r.pacote.evento.fuso,
        },
        partes: r.pacote.minhaParte.map((p) => ({ ...p, atribuicaoId: null })),
        itens: r.pacote.itens,
        baixado: true,
      })),
    }
  }
  if (meu.data) {
    return {
      tipo: 'pronto',
      origem: 'rede',
      encontros: meu.data.map((e) => ({
        evento: e.evento,
        partes: e.convocacoes.map((c) => ({
          funcao: c.funcao,
          estado: c.estado,
          atribuicaoId: c.atribuicaoId,
        })),
        itens: e.itens,
        baixado: baixados.has(e.evento.id),
      })),
    }
  }
  if (semRede) {
    // Sem rede e a leitura local ainda em curso (primeira carga): espera um instante.
    if (guardados.isPending && offline.temParticao) return { tipo: 'carregando' }
    return { tipo: 'sem_copia', tentarDeNovo }
  }
  if (meu.isPending) return { tipo: 'carregando' }
  return { tipo: 'erro', erro: meu.error, tentarDeNovo }
}
