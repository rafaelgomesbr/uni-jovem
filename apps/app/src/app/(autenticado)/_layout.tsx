import { Redirect, Stack } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { useOpcoesDaPilha } from '@/funcionalidades/navegacao/opcoesDaPilha'
import { Carregando } from '@/ui/Carregando'
import { Tela } from '@/ui/Tela'

/** Guarda do app: sem sessão, vai para Entrar. */
export default function LayoutAutenticado() {
  const { estado } = useSessao()
  const opcoesDaPilha = useOpcoesDaPilha()
  if (estado === 'anonimo') return <Redirect href="/entrar" />
  if (estado === 'carregando') {
    return (
      <Tela rolar={false}>
        <Carregando />
      </Tela>
    )
  }
  return (
    <Stack screenOptions={{ ...opcoesDaPilha, headerShown: true }}>
      <Stack.Screen name="(abas)" options={{ headerShown: false, title: 'Início' }} />
      <Stack.Screen
        name="trocar-comunidade"
        options={{ title: 'Comunidade', presentation: 'modal' }}
      />
      <Stack.Screen name="convidar" options={{ title: 'Convidar' }} />
      <Stack.Screen name="membro/[vinculoId]" options={{ title: 'Pessoa' }} />
      <Stack.Screen name="aparelhos" options={{ title: 'Aparelhos' }} />
      <Stack.Screen name="ativar-2fa" options={{ title: 'Segurança' }} />
      <Stack.Screen name="plataforma/index" options={{ title: 'Plataforma' }} />
      <Stack.Screen name="plataforma/nova" options={{ title: 'Nova comunidade' }} />
      <Stack.Screen name="plataforma/[comunidadeId]" options={{ title: 'Comunidade' }} />
    </Stack>
  )
}
