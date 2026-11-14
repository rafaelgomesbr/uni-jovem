import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

/**
 * Links sensíveis (convite, redefinir senha, primeiro acesso) levam o token no
 * FRAGMENTO (`#t=...`): o fragmento não vai para o servidor, para log nem para
 * o Referer. Aqui ele é lido e, na web, apagado da barra de endereço.
 */
export function lerParametroDoFragmento(
  fragmento: string | null | undefined,
  nome = 't',
): string | null {
  if (!fragmento) return null
  const valor = new URLSearchParams(fragmento.replace(/^#/, '')).get(nome)
  return valor ? valor.trim() : null
}

function fragmentoDaWeb(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  return lerParametroDoFragmento(window.location.hash)
}

export function useTokenDoFragmento(): string | null {
  // No celular o Expo Router entrega o fragmento do deep link como o parâmetro '#'.
  const parametros = useLocalSearchParams<{ '#'?: string }>()
  const [daWeb] = useState(fragmentoDaWeb)

  // Sincroniza com o histórico do navegador: o token não fica na barra nem no histórico.
  useEffect(() => {
    if (daWeb && typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [daWeb])

  return daWeb ?? lerParametroDoFragmento(parametros['#'])
}
