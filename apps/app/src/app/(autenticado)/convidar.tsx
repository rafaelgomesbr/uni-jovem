import { Stack } from 'expo-router'

import { TelaConvidar } from '@/funcionalidades/comunidade/TelaConvidar'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Convidar pessoas' }} />
      <TelaConvidar />
    </>
  )
}
