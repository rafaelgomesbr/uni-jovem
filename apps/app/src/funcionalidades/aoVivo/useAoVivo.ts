import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { CHAVES } from '@/estado/clienteDeConsulta'
import { api } from '@/servicos/api'
import type { ComandoDoAoVivo, RetratoAoVivo } from '@/servicos/contratoDosEventos'
import { ehCancelamento, ehErroDaApi } from '@/servicos/erros'
import { mostrarToast } from '@/ui/Toast'

import { naComunidade } from '../eventos/consultas'

/** Espera sem prender o fim da tela: o sinal cancela a espera. */
function esperar(ms: number, sinal: AbortSignal): Promise<void> {
  return new Promise((resolver) => {
    const t = setTimeout(resolver, ms)
    sinal.addEventListener('abort', () => {
      clearTimeout(t)
      resolver()
    })
  })
}

export type EstadoDaConexao = 'ao_vivo' | 'reconectando'

/** Retrato com a hora em que chegou ao aparelho (para corrigir o relógio local pelo do servidor). */
export type RetratoRecebido = RetratoAoVivo & { recebidoEm: number }

const carimbar = (r: RetratoAoVivo): RetratoRecebido => ({ ...r, recebidoEm: Date.now() })

/** Intervalo mínimo entre consultas quando o servidor responde sem mudança (evita repetição contínua). */
const INTERVALO_MINIMO_MS = 1_000
const ESPERA_APOS_FALHA_MS = 3_000

/**
 * Andamento ao vivo de um evento. Primeiro lê o retrato; depois acompanha por
 * LONG POLLING (`?depoisDaVersao=N`, a API segura até 25 s ou até mudar).
 * Comandos levam a versão que a tela conhece; se outra pessoa mudou antes, a
 * API responde 409 com o estado atual, a tela se atualiza e avisa num toast
 * anunciado ("O andamento mudou...", 3.5.1).
 */
export function useAoVivo(comunidadeId: string, eventoId: string) {
  const consultas = useQueryClient()
  const chave = CHAVES.aoVivo(comunidadeId, eventoId)
  const caminho = `${naComunidade(comunidadeId)}/eventos/${eventoId}/ao-vivo`
  const [conexao, setConexao] = useState<EstadoDaConexao>('ao_vivo')

  const retrato = useQuery({
    queryKey: chave,
    queryFn: ({ signal }) => api.get<RetratoAoVivo>(caminho, { sinal: signal }).then(carimbar),
  })
  const carregado = retrato.data !== undefined

  // Sincroniza com o servidor enquanto a tela estiver aberta; ao sair, cancela o pedido pendente.
  useEffect(() => {
    if (!carregado) return
    const chave = CHAVES.aoVivo(comunidadeId, eventoId)
    const controle = new AbortController()
    async function acompanhar() {
      while (!controle.signal.aborted) {
        const versao = consultas.getQueryData<RetratoAoVivo>(chave)?.versao ?? 0
        const inicio = Date.now()
        try {
          const novo = await api.get<RetratoAoVivo>(`${caminho}?depoisDaVersao=${versao}`, {
            sinal: controle.signal,
          })
          if (controle.signal.aborted) return
          const atual = consultas.getQueryData<RetratoAoVivo>(chave)
          if (!atual || novo.versao >= atual.versao) consultas.setQueryData(chave, carimbar(novo))
          setConexao('ao_vivo')
          if (novo.versao <= versao && Date.now() - inicio < INTERVALO_MINIMO_MS) {
            await esperar(INTERVALO_MINIMO_MS, controle.signal)
          }
        } catch (erro) {
          if (controle.signal.aborted || ehCancelamento(erro)) return
          setConexao('reconectando')
          await esperar(ESPERA_APOS_FALHA_MS, controle.signal)
        }
      }
    }
    void acompanhar()
    return () => controle.abort()
  }, [carregado, caminho, comunidadeId, eventoId, consultas])

  const comandar = useMutation({
    mutationFn: ({ comando, forcar }: { comando: ComandoDoAoVivo; forcar?: boolean }) => {
      const versao = consultas.getQueryData<RetratoAoVivo>(chave)?.versao ?? 0
      return api.post<RetratoAoVivo>(caminho, {
        comando,
        versao,
        ...(forcar ? { forcar: true } : {}),
      })
    },
    onSuccess: (novo) => consultas.setQueryData(chave, carimbar(novo)),
    onError: (erro) => {
      // Conflito de versão ou de condução: a resposta traz o estado atual.
      if (ehErroDaApi(erro) && erro.status === 409 && erro.atual) {
        consultas.setQueryData(chave, carimbar(erro.atual as RetratoAoVivo))
        mostrarToast({ texto: `O andamento mudou. ${erro.mensagem}`, tipo: 'info' })
      }
    },
  })

  return { retrato, conexao, comandar }
}

/** Relógio que anda de segundo em segundo (para o cronômetro). */
export function useAgora(intervaloMs = 1_000): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])
  return agora
}
