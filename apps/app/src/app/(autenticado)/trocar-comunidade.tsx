import { Stack } from 'expo-router'

import { TelaTrocarComunidade } from '@/funcionalidades/comunidade/TelaTrocarComunidade'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Trocar de comunidade' }} />
      <TelaTrocarComunidade />
    </>
  )
}
