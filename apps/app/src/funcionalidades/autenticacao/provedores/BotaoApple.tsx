import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { RAIO } from '@uj/tokens'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { ALVO } from '@/ui/medidas'
import { useTema } from '@/ui/tema'

import { appleNaPlataforma } from './configuracao'

export interface CredencialDaApple {
  identityToken: string
  /** O nonce CRU: a Apple recebeu o SHA-256 dele e a API confere o par. */
  nonce: string
}

/**
 * Pede a credencial à Apple com um nonce novo. O token traz o SHA-256 do
 * nonce; a API recebe o nonce cru e confere, então um token capturado em
 * outro lugar não serve aqui. `null` quando a pessoa cancela.
 */
export async function pedirCredencialDaApple(): Promise<CredencialDaApple | null> {
  const bytes = Crypto.getRandomBytes(32)
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)
  try {
    const credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hash,
    })
    if (!credencial.identityToken) return null
    return { identityToken: credencial.identityToken, nonce }
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null
    throw e
  }
}

/** A Apple só oferece o pedido no iOS 13+ e com conta Apple no aparelho. */
export function useAppleDisponivel(): boolean {
  const [disponivel, setDisponivel] = useState(false)
  useEffect(() => {
    if (!appleNaPlataforma()) return
    let vivo = true
    AppleAuthentication.isAvailableAsync()
      .then((sim) => {
        if (vivo) setDisponivel(sim)
      })
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [])
  return disponivel
}

interface PropsDoBotaoApple {
  /** `continuar` para entrar; o texto oficial da Apple acompanha. */
  tipo?: 'entrar' | 'continuar'
  carregando?: boolean
  aoPressionar: () => void
}

/**
 * Botão OFICIAL da Apple (exigência da diretriz 4.8 e das regras de marca).
 * Só no iOS; o texto vem do sistema, no idioma do aparelho.
 */
export function BotaoApple({
  tipo = 'entrar',
  carregando = false,
  aoPressionar,
}: PropsDoBotaoApple) {
  const { escuro, cores } = useTema()
  const disponivel = useAppleDisponivel()
  if (!disponivel) return null
  // Altura e raio dos botões do app (48 e 14, linguagem Aurora).
  const altura = Math.max(ALVO, 48)
  if (carregando) {
    return (
      <View
        style={{ height: altura, alignItems: 'center', justifyContent: 'center' }}
        accessibilityRole="progressbar"
        accessibilityLabel="Entrando com a Apple"
      >
        <ActivityIndicator color={cores.texto} />
      </View>
    )
  }
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={
        tipo === 'continuar'
          ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
          : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
      }
      buttonStyle={
        escuro
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={RAIO.medio}
      style={{ height: altura, alignSelf: 'stretch' }}
      onPress={aoPressionar}
    />
  )
}
