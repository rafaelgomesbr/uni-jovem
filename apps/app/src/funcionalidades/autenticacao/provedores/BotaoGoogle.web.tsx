import * as Google from 'expo-auth-session/providers/google'
import { useEffect, useEffectEvent } from 'react'

import { BotaoDeAcesso, type NivelDoAcesso } from '@/ui/BotaoDeAcesso'

import { googleConfigurado, idsDoGoogle, retornoDoGoogle } from './configuracao'

interface PropsDoBotaoGoogle {
  titulo?: string
  nivel?: NivelDoAcesso
  selo?: string
  carregando?: boolean
  /** Depois de entrar: o indicador vira um check. */
  sucesso?: boolean
  desabilitado?: boolean
  /** Por que está desabilitado (lido pelo leitor de tela). */
  motivo?: string
  disparoDeErro?: number
  /** O ID token do Google; quem chama manda para a API. */
  aoObterToken: (idToken: string) => void
  /** O Google não devolveu o token (falha de rede ou configuração). Cancelar não é erro. */
  aoFalhar: (mensagem: string) => void
  /** A pessoa fechou a janela do Google. */
  aoCancelar?: () => void
}

/**
 * "Continuar com o Google": as cores da marca do Google (tema claro como
 * primário, tema escuro como secundário no escuro) e o "G" oficial. Só existe
 * quando o ID de cliente da plataforma está configurado.
 */
export function BotaoGoogle(props: PropsDoBotaoGoogle) {
  if (!googleConfigurado()) return null
  return <BotaoGoogleConfigurado {...props} />
}

function BotaoGoogleConfigurado({
  titulo = 'Continuar com o Google',
  nivel = 'secundario',
  selo,
  carregando = false,
  sucesso = false,
  desabilitado = false,
  motivo,
  disparoDeErro = 0,
  aoObterToken,
  aoFalhar,
  aoCancelar,
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
    } else if (resposta.type === 'cancel' || resposta.type === 'dismiss') {
      aoCancelar?.()
    }
  })
  useEffect(() => aoResponder(), [resposta])

  const inativo = desabilitado || !pedido || carregando
  const motivoFinal = !pedido ? 'Preparando a entrada com o Google.' : motivo
  return (
    <BotaoDeAcesso
      marca="google"
      nivel={nivel}
      titulo={titulo}
      {...(selo ? { selo } : {})}
      carregando={carregando}
      sucesso={sucesso}
      inativo={inativo}
      {...(motivoFinal ? { motivo: motivoFinal } : {})}
      disparoDeErro={disparoDeErro}
      aoPressionar={() => void pedirAoGoogle()}
    />
  )
}
