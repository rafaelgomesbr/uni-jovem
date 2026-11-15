import { Stack } from 'expo-router'

import { TelaNovaComunidade } from '@/funcionalidades/plataforma/TelaNovaComunidade'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Criar comunidade' }} />
      <TelaNovaComunidade />
    </>
  )
}
