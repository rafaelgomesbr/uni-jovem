import { useMutation } from '@tanstack/react-query'
import { aplicarComando } from '@uj/dominio'

import type { RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { ErroLocal } from '@/servicos/erros'

import type { ControleDoAoVivo } from '../aoVivo/tempo'
import { useOffline, usePacoteDoEvento } from './ProvedorOffline'
import type { ComandoProposto } from './tipos'
import { retratoLocal } from './vistaLocal'

function maisRecente(a: RetratoAoVivo | null, b: RetratoAoVivo | null): RetratoAoVivo | null {
  if (!a) return b
  if (!b) return a
  return b.versao >= a.versao ? b : a
}

/**
 * Ao vivo sem conexão, "só neste aparelho": os comandos vão para a fila como
 * UMA proposta (com a versão de onde partiram). Ao reconectar, o servidor
 * aceita ou devolve conflito com a linha do tempo dele, e a pessoa escolhe.
 */
export function useAoVivoLocal(eventoId: string, retratoOnline: RetratoAoVivo | null) {
  const offline = useOffline()
  const guardado = usePacoteDoEvento(eventoId).data ?? null
  const propostas = offline.operacoes.filter(
    (o) => o.tipo === 'ao_vivo.proposta' && o.estado === 'pendente' && o.eventoId === eventoId,
  )
  const comandos: ComandoProposto[] = propostas.flatMap((o) =>
    o.tipo === 'ao_vivo.proposta' ? o.dados.comandos : [],
  )
  // Com proposta na fila, a base é a dela (as duas linhas do tempo partem do mesmo ponto).
  const base =
    propostas[0]?.contexto.baseAoVivo ?? maisRecente(guardado?.pacote.aoVivo ?? null, retratoOnline)
  const retrato = base
    ? retratoLocal(base, comandos, new Date(comandos.at(-1)?.ocorridoEm ?? base.agora))
    : null

  const comandar = useMutation({
    mutationFn: async (controle: ControleDoAoVivo) => {
      if (!base || !retrato) throw new ErroLocal('Prepare o evento para conduzir sem internet.')
      const agora = new Date()
      // A mesma máquina de estados da API: comando impossível nem entra na fila.
      const teste = aplicarComando(
        retrato,
        { tipo: controle },
        retrato.etapas.map((e) => e.id),
        agora,
      )
      if (!teste.ok) throw new ErroLocal(teste.motivo)
      await offline.registrar(
        {
          tipo: 'ao_vivo.proposta',
          dados: {
            eventoId,
            versaoBase: base.versao,
            comandos: [{ comando: controle, ocorridoEm: agora.toISOString() }],
          },
          eventoId,
          descricao: `Ao vivo de "${base.evento.titulo}" (só neste aparelho)`,
          contexto: { baseAoVivo: base },
        },
        { vinculoId: guardado?.pacote.vinculoId ?? null },
      )
    },
    networkMode: 'always',
  })

  return {
    retrato,
    comandar: (controle: ControleDoAoVivo) => comandar.mutate(controle),
    enviando: comandar.isPending ? (comandar.variables ?? null) : null,
    erro: comandar.error,
  }
}
