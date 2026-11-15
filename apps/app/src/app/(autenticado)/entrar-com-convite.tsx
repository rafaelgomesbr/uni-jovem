import { Stack } from 'expo-router'

import { TelaEntrarComConvite } from '@/funcionalidades/comunidade/TelaEntrarComConvite'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Entrar com um convite' }} />
      <TelaEntrarComConvite />
    </>
  )
}
