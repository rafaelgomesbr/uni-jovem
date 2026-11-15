import { Platform } from 'react-native'

/**
 * IDs de cliente do Google por plataforma (não são segredo: vão dentro do
 * app). Sem o ID da plataforma atual, o botão "Continuar com Google" não
 * aparece. `process.env.EXPO_PUBLIC_*` precisa ser escrito por extenso para o
 * Expo embutir o valor no pacote.
 */
export function idsDoGoogle(): {
  iosClientId?: string
  androidClientId?: string
  webClientId?: string
} {
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  const android = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  const web = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  return {
    ...(ios ? { iosClientId: ios } : {}),
    ...(android ? { androidClientId: android } : {}),
    ...(web ? { webClientId: web } : {}),
  }
}

export function googleConfigurado(): boolean {
  const ids = idsDoGoogle()
  if (Platform.OS === 'ios') return Boolean(ids.iosClientId)
  if (Platform.OS === 'android') return Boolean(ids.androidClientId)
  return Boolean(ids.webClientId)
}

/** "Entrar com a Apple" só existe no iOS (o botão oficial e o pedido nativo). */
export function appleNaPlataforma(): boolean {
  return Platform.OS === 'ios'
}

/**
 * Esquema de URL do cliente iOS do Google ("com.googleusercontent.apps.<id>"),
 * registrado no app.config.ts: o Google devolve a pessoa ao app por ele.
 */
export function esquemaReversoDoGoogle(clienteIos: string): string {
  return clienteIos.split('.').reverse().join('.')
}

/**
 * Para onde o Google devolve a pessoa. iOS: o esquema reverso do cliente iOS.
 * Web: a raiz do app (`/app`), cadastrada no cliente web do Google. Android:
 * o padrão do expo-auth-session (pacote do app).
 */
export function retornoDoGoogle(): string | undefined {
  const ids = idsDoGoogle()
  if (Platform.OS === 'ios' && ids.iosClientId) {
    return `${esquemaReversoDoGoogle(ids.iosClientId)}:/oauthredirect`
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/app`
  }
  return undefined
}
