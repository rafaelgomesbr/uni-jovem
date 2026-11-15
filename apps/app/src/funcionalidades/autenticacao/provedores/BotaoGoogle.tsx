import * as Google from 'expo-auth-session/providers/google'
import { useEffect, useEffectEvent } from 'react'

import { BotaoDeMarca } from '@/ui/BotaoDeMarca'

import { googleConfigurado, idsDoGoogle, retornoDoGoogle } from './configuracao'

interface PropsDoBotaoGoogle {
  titulo?: string
  carregando?: boolean
  desabilitado?: boolean
  /** Por que está desabilitado (lido pelo leitor de tela). */
  motivo?: string
  /** O ID token do Google; quem chama manda para a API. */
  aoObterToken: (idToken: string) => void
  /** O Google não devolveu o token (falha de rede ou configuração). Cancelar não é erro. */
  aoFalhar: (mensagem: string) => void
}

/**
 * "Continuar com o Google" (quadro 05): fundo branco, texto `#1F1F1F`, borda
 * `#747775` e o "G" oficial, como pede a marca do Google sobre fundo escuro.
 * Só existe quando o ID de cliente da plataforma está configurado.
 */
export function BotaoGoogle(props: PropsDoBotaoGoogle) {
  if (!googleConfigurado()) return null
  return <BotaoGoogleConfigurado {...props} />
}

function BotaoGoogleConfigurado({
  titulo = 'Continuar com o Google',
  carregando = false,
  desabilitado = false,
  motivo,
  aoObterToken,
  aoFalhar,
}: PropsDoBotaoGoogle) {
  const [pedido, resposta, pedirAoGoogle] = Google.useIdTokenAuthRequest({
    ...idsDoGoogle(),
    ...(retornoDoGoogle() ? { redirectUri: retornoDoGoogle() } : {}),
    selectAccount: true,
    language: 'pt-BR',
  })

  const aoResponder = useEffectEvent(() => {
    if (!resposta) return
    if (resposta.type === 'success') {
      const token = resposta.params['id_token'] ?? resposta.authentication?.idToken
      if (token) aoObterToken(token)
      else aoFalhar('O Google não confirmou a entrada. Tente de novo.')
    } else if (resposta.type === 'error') {
      aoFalhar('Não foi possível falar com o Google. Tente de novo em instantes.')
    }
  })
  useEffect(() => aoResponder(), [resposta])

  const inativo = desabilitado || !pedido || carregando
  const motivoFinal = !pedido ? 'Preparando a entrada com o Google.' : motivo
  return (
    <BotaoDeMarca
      titulo={titulo}
      carregando={carregando}
      inativo={inativo}
      {...(motivoFinal ? { motivo: motivoFinal } : {})}
      aoPressionar={() => void pedirAoGoogle()}
    />
  )
}
