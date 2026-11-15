import { useMutation, useQueryClient } from '@tanstack/react-query'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { SemConexao } from '@/servicos/erros'

import { naComunidade, useInvalidarEventos } from '../eventos/consultas'
import { useOffline } from './ProvedorOffline'
import type { NovaAcao } from './tipos'

export type ItemMarcavel = 'tarefa' | 'checklist'

export interface PedidoDeMarcacao {
  id: string
  valor: boolean
  /** Título ou texto do item, para a descrição na fila. */
  rotulo: string
}

function acaoDe(tipo: ItemMarcavel, eventoId: string, p: PedidoDeMarcacao): NovaAcao {
  return tipo === 'tarefa'
    ? {
        tipo: 'tarefa.concluir',
        dados: { tarefaId: p.id, concluida: p.valor },
        eventoId,
        descricao: `${p.valor ? 'Concluir' : 'Reabrir'} a tarefa "${p.rotulo}"`,
      }
    : {
        tipo: 'checklist.marcar',
        dados: { itemId: p.id, marcado: p.valor },
        eventoId,
        descricao: `${p.valor ? 'Marcar' : 'Desmarcar'} "${p.rotulo}" no checklist`,
      }
}

function marcarNoDetalhe(
  d: DetalheDoEvento,
  tipo: ItemMarcavel,
  { id, valor }: PedidoDeMarcacao,
): DetalheDoEvento {
  const quando = valor ? new Date().toISOString() : null
  return tipo === 'tarefa'
    ? { ...d, tarefas: d.tarefas.map((t) => (t.id === id ? { ...t, concluidaEm: quando } : t)) }
    : { ...d, checklist: d.checklist.map((c) => (c.id === id ? { ...c, marcadoEm: quando } : c)) }
}

/**
 * Concluir/reabrir tarefa e marcar/desmarcar item de checklist. Com rede, vai
 * direto à API; sem rede (ou se a rede cair no meio), entra na fila deste
 * aparelho e a tela já mostra o novo estado como "pendente de envio".
 */
export function useMarcarNoEvento(
  comunidadeId: string,
  eventoId: string,
  tipo: ItemMarcavel,
  opcoes: { local: boolean; eu: string | null },
) {
  const offline = useOffline()
  const consultas = useQueryClient()
  const invalidar = useInvalidarEventos(comunidadeId)
  const caminho = `${naComunidade(comunidadeId)}/eventos/${eventoId}/${tipo === 'tarefa' ? 'tarefas' : 'checklist'}`

  async function guardar(p: PedidoDeMarcacao): Promise<'aparelho'> {
    await offline.registrar(acaoDe(tipo, eventoId, p), { vinculoId: opcoes.eu })
    if (!opcoes.local) {
      consultas.setQueryData<DetalheDoEvento>(CHAVES.evento(comunidadeId, eventoId), (d) =>
        d ? marcarNoDetalhe(d, tipo, p) : d,
      )
    }
    return 'aparelho'
  }

  return useMutation({
    mutationFn: async (p: PedidoDeMarcacao): Promise<'servidor' | 'aparelho'> => {
      if (opcoes.local || (!offline.online && offline.disponivel)) return guardar(p)
      try {
        await api.patch(
          `${caminho}/${p.id}`,
          tipo === 'tarefa' ? { concluida: p.valor } : { marcado: p.valor },
        )
        return 'servidor'
      } catch (erro) {
        if (erro instanceof SemConexao && offline.disponivel) return guardar(p)
        throw erro
      }
    },
    // Sem rede, a mutação precisa rodar mesmo assim (ela mesma decide o caminho).
    networkMode: 'always',
    onSuccess: async (onde) => {
      if (onde === 'servidor') await invalidar(eventoId)
    },
  })
}
