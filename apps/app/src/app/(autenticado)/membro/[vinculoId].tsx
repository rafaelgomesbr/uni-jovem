import { Stack } from 'expo-router'

import { TelaMembro } from '@/funcionalidades/comunidade/TelaMembro'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Pessoa' }} />
      <TelaMembro />
    </>
  )
}
