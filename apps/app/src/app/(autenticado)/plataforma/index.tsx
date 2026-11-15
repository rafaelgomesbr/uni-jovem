import { Stack } from 'expo-router'

import { TelaPlataforma } from '@/funcionalidades/plataforma/TelaPlataforma'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Plataforma' }} />
      <TelaPlataforma />
    </>
  )
}
