import { Redirect, Stack } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { lerConviteEmEspera } from '@/funcionalidades/convite/conviteEmEspera'
import { useOpcoesDaPilha } from '@/funcionalidades/navegacao/opcoesDaPilha'

/** Guarda do grupo público: quem já entrou vai para o app (ou volta ao convite que abriu). */
export default function LayoutPublico() {
  const { estado } = useSessao()
  const opcoesDaPilha = useOpcoesDaPilha()
  if (estado === 'autenticado') {
    return <Redirect href={lerConviteEmEspera() ? '/convite' : '/'} />
  }
  return (
    <Stack screenOptions={{ ...opcoesDaPilha, headerShown: true }}>
      <Stack.Screen name="entrar" options={{ headerShown: false, title: 'Entrar' }} />
      <Stack.Screen name="segundo-fator" options={{ title: 'Verificação' }} />
      <Stack.Screen name="recuperar-senha" options={{ title: 'Recuperar senha' }} />
    </Stack>
  )
}
