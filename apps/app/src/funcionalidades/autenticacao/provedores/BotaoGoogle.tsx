import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin'
import { useRef, useState } from 'react'
import { Platform } from 'react-native'

import { BotaoDeMarca } from '@/ui/BotaoDeMarca'
import { googleConfigurado, idsDoGoogle } from './configuracao'

interface PropsDoBotaoGoogle {
  titulo?: string
  carregando?: boolean
  desabilitado?: boolean
  motivo?: string
  aoObterToken: (idToken: string) => void
  aoFalhar: (mensagem: string) => void
}

/** No celular, usa o SDK nativo; na web, o módulo .web mantém o fluxo do navegador. */
export function BotaoGoogle({
  titulo = 'Continuar com o Google',
  carregando = false,
  desabilitado = false,
  motivo,
  aoObterToken,
  aoFalhar,
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
      }
    } catch (erro) {
      if (!isErrorWithCode(erro) || erro.code !== statusCodes.SIGN_IN_CANCELLED) {
        aoFalhar('Não foi possível entrar com o Google. Confira sua conexão e tente de novo.')
      }
    } finally {
      ocupado.current = false
      setPedindo(false)
    }
  }

  return (
    <BotaoDeMarca
      titulo={titulo}
      carregando={carregando || pedindo}
      inativo={desabilitado || carregando || pedindo}
      {...(motivo ? { motivo } : {})}
      aoPressionar={() => void entrar()}
    />
  )
}
