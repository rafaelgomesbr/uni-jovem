import { Stack } from 'expo-router'

import { TelaTransferencia } from '@/funcionalidades/plataforma/TelaTransferencia'

/** Cabeçalho próprio e transparente (linguagem Aurora): a pilha não desenha o dela. */
export default function Rota() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Transferir propriedade' }} />
      <TelaTransferencia />
    </>
  )
}
