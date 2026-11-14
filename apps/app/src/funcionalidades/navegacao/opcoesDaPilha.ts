import type { NativeStackNavigationOptions } from 'expo-router'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { FAMILIA } from '@/ui/fontes'
import { useTema } from '@/ui/tema'

/**
 * Opções comuns a todas as pilhas (navegadores aninhados não herdam as do
 * pai). Com "Reduzir movimento", as transições entre telas são cortadas.
 */
export function useOpcoesDaPilha(): NativeStackNavigationOptions {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  return {
    contentStyle: { backgroundColor: cores.fundo },
    headerStyle: { backgroundColor: cores.fundo },
    headerTintColor: cores.destaque,
    headerTitleStyle: { fontFamily: FAMILIA.textoForte, color: cores.texto },
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    animation: reduzirMovimento ? 'none' : 'default',
  }
}
