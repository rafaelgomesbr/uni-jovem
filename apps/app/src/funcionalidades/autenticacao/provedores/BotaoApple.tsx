import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { useEffect, useState } from 'react'

import { BotaoDeAcessoRapido } from '@/ui/BotaoDeAcessoRapido'

import { appleNaPlataforma } from './configuracao'

export interface CredencialDaApple {
  identityToken: string
  /** O nonce CRU: a Apple recebeu o SHA-256 dele e a API confere o par. */
  nonce: string
  /** O nome, que a Apple entrega só ao app e só na primeira vez; vai junto na entrada, para o cadastro. */
  nome?: string
}

/**
 * Pede a credencial à Apple com um nonce novo. O token traz o SHA-256 do
 * nonce; a API recebe o nonce cru e confere, então um token capturado em
 * outro lugar não serve aqui. `null` quando a pessoa cancela. Com `comNome`
 * (entrar e criar conta), pede também o nome: a Apple só o entrega na primeira
 * autorização do app, e sem ele a conta nova nasceria sem nome.
 */
export async function pedirCredencialDaApple({
  comNome = false,
}: { comNome?: boolean } = {}): Promise<CredencialDaApple | null> {
  const bytes = Crypto.getRandomBytes(32)
  const nonce = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)
  try {
    const credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [
        ...(comNome ? [AppleAuthentication.AppleAuthenticationScope.FULL_NAME] : []),
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hash,
    })
    if (!credencial.identityToken) return null
    const nome = [credencial.fullName?.givenName, credencial.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim()
    return { identityToken: credencial.identityToken, nonce, ...(nome ? { nome } : {}) }
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
  /** `continuar` ("Continuar com a Apple", o padrão) ou `entrar` ("Entrar com a Apple"). */
  tipo?: 'entrar' | 'continuar'
  carregando?: boolean
  desabilitado?: boolean
  aoPressionar: () => void
}

/**
 * "Continuar com a Apple" com o logotipo da Apple, só no iOS com conta Apple
 * no aparelho. O botão nativo da Apple escreve o texto no idioma do sistema
 * (em inglês neste app), então o botão é desenhado aqui, no mesmo formato e
 * com o rótulo em português, que as regras de marca da Apple aceitam com o
 * logotipo e as proporções mantidos. O pedido continua sendo o nativo.
 */
export function BotaoApple({
  tipo = 'continuar',
  carregando = false,
  desabilitado = false,
  aoPressionar,
}: PropsDoBotaoApple) {
  const disponivel = useAppleDisponivel()
  if (!disponivel) return null
  return (
    <BotaoDeAcessoRapido
      marca="apple"
      titulo={tipo === 'continuar' ? 'Continuar com a Apple' : 'Entrar com a Apple'}
      carregando={carregando}
      inativo={desabilitado}
      aoPressionar={aoPressionar}
    />
  )
}
