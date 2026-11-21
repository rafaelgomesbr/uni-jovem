import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import { useRef, useState } from 'react'
import { Platform } from 'react-native'

import { BotaoDeAcesso, type NivelDoAcesso } from '@/ui/BotaoDeAcesso'
import { googleConfigurado, idsDoGoogle } from './configuracao'

interface PropsDoBotaoGoogle {
  titulo?: string
  nivel?: NivelDoAcesso
  selo?: string
  carregando?: boolean
  /** Depois de entrar: o indicador vira um check. */
  sucesso?: boolean
  desabilitado?: boolean
  motivo?: string
  disparoDeErro?: number
  aoObterToken: (idToken: string) => void
  aoFalhar: (mensagem: string) => void
  /** A pessoa fechou a folha do Google: não é erro, mas a tela conta (2 vezes seguidas vira dica). */
  aoCancelar?: () => void
}

/** No celular, usa o SDK nativo; na web, o módulo .web mantém o fluxo do navegador. */
export function BotaoGoogle({
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
  const [pedindo, setPedindo] = useState(false)
  const ocupado = useRef(false)
  if (!googleConfigurado()) return null

  async function entrar() {
    if (ocupado.current) return
    ocupado.current = true
    setPedindo(true)
    try {
      const ids = idsDoGoogle()
      GoogleSignin.configure({
        iosClientId: ids.iosClientId,
        webClientId: ids.webClientId,
        offlineAccess: false,
      })
      if (Platform.OS === 'android')
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      const resposta = await GoogleSignin.signIn()
      if (isSuccessResponse(resposta)) {
        if (resposta.data.idToken) aoObterToken(resposta.data.idToken)
        else aoFalhar('O Google não confirmou a entrada. Tente de novo.')
      } else aoCancelar?.()
    } catch (erro) {
      if (!isErrorWithCode(erro) || erro.code !== statusCodes.SIGN_IN_CANCELLED) {
        aoFalhar('Não foi possível entrar com o Google. Confira sua conexão e tente de novo.')
      } else aoCancelar?.()
    } finally {
      ocupado.current = false
      setPedindo(false)
    }
  }

  return (
    <BotaoDeAcesso
      marca="google"
      nivel={nivel}
      titulo={titulo}
      {...(selo ? { selo } : {})}
      carregando={carregando || pedindo}
      sucesso={sucesso}
      inativo={desabilitado || carregando || pedindo}
      {...(motivo ? { motivo } : {})}
      disparoDeErro={disparoDeErro}
      aoPressionar={() => void entrar()}
    />
  )
}
