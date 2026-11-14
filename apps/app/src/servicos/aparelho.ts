import * as Device from 'expo-device'
import { Platform } from 'react-native'

import type { Plataforma } from './contrato'

export function plataformaAtual(): Plataforma {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS
  return 'web'
}

/**
 * Nome que aparece em "Aparelhos conectados". Usa o modelo (ex.: "iPhone 15"),
 * nunca o nome que a pessoa deu ao aparelho, que costuma trazer o nome dela.
 */
export function nomeDoAparelho(): string {
  if (Platform.OS === 'web') {
    const sistema = Device.osName ? ` (${Device.osName})` : ''
    return `Navegador${sistema}`.slice(0, 80)
  }
  return (Device.modelName ?? (Platform.OS === 'ios' ? 'iPhone' : 'Android')).slice(0, 80)
}
