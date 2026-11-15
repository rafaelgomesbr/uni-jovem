import { Stack } from 'expo-router'

import { TelaComunidadeDaPlataforma } from '@/funcionalidades/plataforma/TelaComunidadeDaPlataforma'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Comunidade' }} />
      <TelaComunidadeDaPlataforma />
    </>
  )
}
