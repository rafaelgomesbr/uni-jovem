import { CLARO, ESCURO, type Paleta } from '@uj/tokens'
import { useColorScheme } from 'react-native'

export interface Tema {
  cores: Paleta
  escuro: boolean
}

/** Tema claro ou escuro, sempre seguindo o sistema. */
export function useTema(): Tema {
  const escuro = useColorScheme() === 'dark'
  return { cores: escuro ? ESCURO : CLARO, escuro }
}
