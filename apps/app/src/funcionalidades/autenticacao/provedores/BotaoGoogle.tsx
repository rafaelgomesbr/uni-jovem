import * as Google from 'expo-auth-session/providers/google'
import { useEffect, useEffectEvent } from 'react'

import { Botao } from '@/ui/Botao'

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

/** "Continuar com Google". Só existe quando o ID de cliente da plataforma está configurado. */
export function BotaoGoogle(props: PropsDoBotaoGoogle) {
  if (!googleConfigurado()) return null
  return <BotaoGoogleConfigurado {...props} />
}

function BotaoGoogleConfigurado({
  titulo = 'Continuar com Google',
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

  return (
    <Botao
      titulo={titulo}
      variante="secundario"
      carregando={carregando}
      desabilitado={desabilitado || !pedido}
      {...(!pedido ? { motivo: 'Preparando a entrada com o Google.' } : motivo ? { motivo } : {})}
      aoPressionar={() => void pedirAoGoogle()}
    />
  )
}
