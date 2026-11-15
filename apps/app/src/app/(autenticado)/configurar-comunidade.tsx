import { Stack } from 'expo-router'

import { TelaConfigurarComunidade } from '@/funcionalidades/comunidade/TelaConfigurarComunidade'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Configurações da comunidade' }} />
      <TelaConfigurarComunidade />
    </>
  )
}
