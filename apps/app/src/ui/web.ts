import { Platform } from 'react-native'

/**
 * Atributos que só a web entende (`aria-describedby`, `aria-level`,
 * `aria-current`, `aria-invalid`): o react-native-web os passa ao DOM; no
 * celular, nada é repassado. Tipados de forma aberta porque o React Native
 * não os declara.
 */
export function soNaWeb(atributos: Record<string, unknown>): object {
  return Platform.OS === 'web' ? atributos : {}
}
