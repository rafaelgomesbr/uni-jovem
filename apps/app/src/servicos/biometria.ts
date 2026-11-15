import * as LocalAuthentication from 'expo-local-authentication'
import { Platform } from 'react-native'

/**
 * Face ID, Touch ID ou a biometria do Android, só no celular (a web não tem).
 * Aqui só a pergunta "dá para usar?" e a confirmação avulsa; quem tranca a
 * sessão é o cofre (`armazenamentoDoRefresh.ts`), com a chave presa à biometria.
 */

export interface Biometria {
  /** Há sensor e a pessoa cadastrou rosto ou digital no aparelho. */
  disponivel: boolean
  /** Como chamar na tela: "Face ID", "Touch ID" ou "biometria". */
  nome: string
}

export const SEM_BIOMETRIA: Biometria = { disponivel: false, nome: 'biometria' }

export async function consultarBiometria(): Promise<Biometria> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return SEM_BIOMETRIA
  try {
    const [hardware, cadastrada, tipos] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ])
    let nome = 'biometria'
    if (Platform.OS === 'ios') {
      if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        nome = 'Face ID'
      } else if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        nome = 'Touch ID'
      }
    }
    return { disponivel: hardware && cadastrada, nome }
  } catch {
    return SEM_BIOMETRIA
  }
}

/**
 * Pede a biometria agora (sem código do aparelho como alternativa: quem não
 * passa usa a senha do Uni Jovem). `true` só se a pessoa confirmou.
 */
export async function confirmarComBiometria(motivo: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: 'Cancelar',
      disableDeviceFallback: true,
    })
    return r.success
  } catch {
    return false
  }
}
