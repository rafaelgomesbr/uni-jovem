import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { exigeProvaDeSegundoFator } from './ProvaDeSegundoFator'

interface Opcoes<TDados, TVars> {
  mutationFn: (variaveis: TVars) => Promise<TDados>
  onSuccess?: (dados: TDados, variaveis: TVars) => unknown
}

/**
 * Mutação de plataforma com step-up: se a API responder 403
 * `segundo_fator_necessario`, guarda o pedido, expõe `prova` para a tela
 * abrir o pedido do código e, depois de provar, repete o MESMO pedido.
 */
export function useAcaoDePlataforma<TDados, TVars = void>(opcoes: Opcoes<TDados, TVars>) {
  const [pendente, setPendente] = useState<{ variaveis: TVars } | null>(null)
  const mutacao = useMutation<TDados, Error, TVars>({
    mutationFn: opcoes.mutationFn,
    onSuccess: (dados, variaveis) => opcoes.onSuccess?.(dados, variaveis),
    onError: (erro, variaveis) => {
      if (exigeProvaDeSegundoFator(erro)) setPendente({ variaveis })
    },
  })

  const prova = pendente
    ? {
        aoProvar: () => {
          setPendente(null)
          mutacao.mutate(pendente.variaveis)
        },
        aoCancelar: () => {
          setPendente(null)
          mutacao.reset()
        },
      }
    : null

  return {
    executar: (variaveis: TVars) => mutacao.mutate(variaveis),
    dados: mutacao.data,
    variaveis: mutacao.variables,
    executando: mutacao.isPending,
    sucesso: mutacao.isSuccess,
    /** Erro para mostrar na tela (o pedido de código não é erro: vira a folha do código). */
    erro: exigeProvaDeSegundoFator(mutacao.error) ? null : mutacao.error,
    prova,
    reiniciar: () => {
      setPendente(null)
      mutacao.reset()
    },
  }
}
