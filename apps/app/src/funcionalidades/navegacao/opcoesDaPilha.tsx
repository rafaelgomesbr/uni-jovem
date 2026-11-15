import type { NativeStackNavigationOptions } from 'expo-router'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { useTema } from '@/ui/tema'

/**
 * Opções comuns a todas as pilhas (navegadores aninhados não herdam as do
 * pai). Nenhuma tela usa o cabeçalho nativo: cada uma desenha o próprio
 * (`CabecalhoDeTela`, seção 2.12.16). Com "Reduzir movimento", as transições
 * entre telas são cortadas.
 */
export function useOpcoesDaPilha(): NativeStackNavigationOptions {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  return {
    headerShown: false,
    contentStyle: { backgroundColor: cores.fundo },
    animation: reduzirMovimento ? 'none' : 'default',
  }
}
