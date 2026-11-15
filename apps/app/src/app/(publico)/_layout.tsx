import { Redirect, Stack } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { lerConviteEmEspera } from '@/funcionalidades/convite/conviteEmEspera'
import { useOpcoesDaPilha } from '@/funcionalidades/navegacao/opcoesDaPilha'

/** Guarda do grupo público: quem já entrou vai para o app (ou volta ao convite que abriu). */
export default function LayoutPublico() {
  const { estado, biometria } = useSessao()
  const opcoesDaPilha = useOpcoesDaPilha()
  if (estado === 'autenticado') {
    // Convite aberto antes de entrar vem primeiro; depois, a pergunta sobre o Face ID.
    if (lerConviteEmEspera()) return <Redirect href="/convite" />
    return <Redirect href={biometria.oferecer ? '/biometria' : '/'} />
  }
  return (
    <Stack screenOptions={{ ...opcoesDaPilha, headerShown: false }}>
      <Stack.Screen name="entrar" options={{ headerShown: false, title: 'Entrar' }} />
      <Stack.Screen name="segundo-fator" options={{ title: 'Verificação' }} />
      <Stack.Screen name="recuperar-senha" options={{ title: 'Recuperar senha' }} />
    </Stack>
  )
}
