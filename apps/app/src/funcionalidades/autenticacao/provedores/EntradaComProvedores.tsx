import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao, type ResultadoDeEntrar } from '@/estado/sessao'
import { AvisoDeFalha } from '@/ui/Falha'
import { SeparadorComTexto } from '@/ui/SeparadorComTexto'

import { AcessosRapidos } from './AcessosRapidos'
import { pedirCredencialDaApple, useAppleDisponivel } from './BotaoApple'
import { googleConfigurado } from './configuracao'

type Pedido = { tipo: 'google'; idToken: string } | { tipo: 'apple' }

/** Algum provedor existe neste aparelho (Google configurado ou Apple disponível). */
export function useTemProvedor(): boolean {
  const apple = useAppleDisponivel()
  return apple || googleConfigurado()
}

/**
 * Google e Apple fora da tela Entrar (cadastro por e-mail e por convite): o
 * mesmo caminho da entrada. Conta que já existe entra; e-mail novo vai para
 * "Falta pouco" (idade e aceites), que cria a conta sem pedir código nem
 * confirmação de e-mail. Com `separador`, desenha a linha "ou com e-mail"
 * logo abaixo dos botões.
 */
export function EntradaComProvedores({
  aoComecar,
  separador,
}: {
  aoComecar?: () => void
  separador?: string
} = {}) {
  const sessao = useSessao()
  const temProvedor = useTemProvedor()
  const [falhaDoProvedor, setFalhaDoProvedor] = useState<string | null>(null)
  const entrar = useMutation({
    mutationFn: async (pedido: Pedido): Promise<ResultadoDeEntrar | null> => {
      setFalhaDoProvedor(null)
      aoComecar?.()
      if (pedido.tipo === 'google') {
        return sessao.entrarComProvedor('google', { idToken: pedido.idToken })
      }
      const credencial = await pedirCredencialDaApple({ comNome: true })
      return credencial ? sessao.entrarComProvedor('apple', credencial) : null
    },
    onSuccess: (resultado) => {
      if (resultado === 'segundo_fator') router.push('/segundo-fator')
      if (resultado === 'cadastro_pendente') router.push('/completar-cadastro')
    },
  })
  const emAndamento = entrar.isPending ? entrar.variables.tipo : null
  if (!temProvedor) return null

  return (
    <View style={{ gap: ESPACO.e16 }}>
      <View style={{ gap: ESPACO.e12 }}>
        {entrar.error ? <AvisoDeFalha erro={entrar.error} /> : null}
        {falhaDoProvedor ? <AvisoDeFalha mensagem={falhaDoProvedor} /> : null}
        <AcessosRapidos
          carregando={emAndamento}
          aoObterTokenDoGoogle={(idToken) => entrar.mutate({ tipo: 'google', idToken })}
          aoPedirApple={() => entrar.mutate({ tipo: 'apple' })}
          aoFalhar={(mensagem) => {
            entrar.reset()
            setFalhaDoProvedor(mensagem)
          }}
        />
      </View>
      {separador ? <SeparadorComTexto texto={separador} /> : null}
    </View>
  )
}
