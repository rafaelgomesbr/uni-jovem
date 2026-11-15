import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao, type ResultadoDeEntrar } from '@/estado/sessao'
import { AvisoDeFalha } from '@/ui/Falha'

import { BotaoApple, pedirCredencialDaApple, useAppleDisponivel } from './BotaoApple'
import { BotaoGoogle } from './BotaoGoogle'
import { googleConfigurado } from './configuracao'

type Pedido = { tipo: 'google'; idToken: string } | { tipo: 'apple' }

/** Algum provedor existe neste aparelho (Google configurado ou Apple disponível). */
export function useTemProvedor(): boolean {
  const apple = useAppleDisponivel()
  return apple || googleConfigurado()
}

/**
 * Google e Apple fora da tela Entrar (cadastro por e-mail indisponível, ADR
 * 0007): o mesmo caminho da entrada. Conta que já existe entra; e-mail novo
 * vai para "Falta pouco" (idade e aceites); quem tem o código extra vai para
 * a verificação.
 */
export function EntradaComProvedores() {
  const sessao = useSessao()
  const [falhaDoProvedor, setFalhaDoProvedor] = useState<string | null>(null)
  const entrar = useMutation({
    mutationFn: async (pedido: Pedido): Promise<ResultadoDeEntrar | null> => {
      setFalhaDoProvedor(null)
      if (pedido.tipo === 'google') {
        return sessao.entrarComProvedor('google', { idToken: pedido.idToken })
      }
      const credencial = await pedirCredencialDaApple()
      return credencial ? sessao.entrarComProvedor('apple', credencial) : null
    },
    onSuccess: (resultado) => {
      if (resultado === 'segundo_fator') router.push('/segundo-fator')
      if (resultado === 'cadastro_pendente') router.push('/completar-cadastro')
    },
  })
  const emAndamento = entrar.isPending ? entrar.variables.tipo : null

  return (
    <View style={{ gap: ESPACO.e8 }}>
      {entrar.error ? <AvisoDeFalha erro={entrar.error} /> : null}
      {falhaDoProvedor ? <AvisoDeFalha mensagem={falhaDoProvedor} /> : null}
      <BotaoGoogle
        carregando={emAndamento === 'google'}
        desabilitado={emAndamento !== null && emAndamento !== 'google'}
        aoObterToken={(idToken) => entrar.mutate({ tipo: 'google', idToken })}
        aoFalhar={(mensagem) => {
          entrar.reset()
          setFalhaDoProvedor(mensagem)
        }}
      />
      <BotaoApple
        tipo="continuar"
        carregando={emAndamento === 'apple'}
        aoPressionar={() => entrar.mutate({ tipo: 'apple' })}
      />
    </View>
  )
}
