import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { useEffect, useState } from 'react'

import { BotaoDeAcesso, type NivelDoAcesso } from '@/ui/BotaoDeAcesso'

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

export type EstadoDaApple = 'consultando' | 'sim' | 'nao'

/**
 * A Apple só oferece o pedido no iOS 13+ e com conta Apple no aparelho. A
 * resposta é assíncrona: `consultando` deixa a tela esperar, para não trocar o
 * botão principal (Apple ou Google) depois de desenhado.
 */
export function useEstadoDaApple(): EstadoDaApple {
  const [estado, setEstado] = useState<EstadoDaApple>(appleNaPlataforma() ? 'consultando' : 'nao')
  useEffect(() => {
    if (!appleNaPlataforma()) return
    let vivo = true
    AppleAuthentication.isAvailableAsync()
      .then((sim) => {
        if (vivo) setEstado(sim ? 'sim' : 'nao')
      })
      .catch(() => {
        if (vivo) setEstado('nao')
      })
    return () => {
      vivo = false
    }
  }, [])
  return estado
}

/** A Apple está disponível neste aparelho? */
export function useAppleDisponivel(): boolean {
  return useEstadoDaApple() === 'sim'
}

interface PropsDoBotaoApple {
  /** `continuar` ("Continuar com a Apple", o padrão) ou `entrar` ("Entrar com a Apple"). */
  tipo?: 'entrar' | 'continuar'
  nivel?: NivelDoAcesso
  selo?: string
  carregando?: boolean
  /** Depois de entrar: o indicador vira um check. */
  sucesso?: boolean
  desabilitado?: boolean
  disparoDeErro?: number
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
  nivel = 'primario',
  selo,
  carregando = false,
  sucesso = false,
  desabilitado = false,
  disparoDeErro = 0,
  aoPressionar,
}: PropsDoBotaoApple) {
  const disponivel = useAppleDisponivel()
  if (!disponivel) return null
  return (
    <BotaoDeAcesso
      marca="apple"
      nivel={nivel}
      titulo={tipo === 'continuar' ? 'Continuar com a Apple' : 'Entrar com a Apple'}
      {...(selo ? { selo } : {})}
      carregando={carregando}
      sucesso={sucesso}
      inativo={desabilitado}
      disparoDeErro={disparoDeErro}
      aoPressionar={aoPressionar}
    />
  )
}
