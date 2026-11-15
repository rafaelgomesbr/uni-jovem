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
      <Stack.Screen name="evento/novo" options={{ title: 'Nova programação' }} />
      <Stack.Screen name="evento/[eventoId]/index" options={{ title: 'Programação' }} />
      <Stack.Screen name="evento/[eventoId]/editar" options={{ title: 'Editar' }} />
      <Stack.Screen
        name="evento/[eventoId]/status"
        options={{ title: 'Cancelar ou adiar', presentation: 'modal' }}
      />
      <Stack.Screen name="evento/[eventoId]/duplicar" options={{ title: 'Duplicar' }} />
      <Stack.Screen
        name="evento/[eventoId]/etapa/[etapaId]"
        options={{ title: 'Etapa e equipe' }}
      />
      <Stack.Screen name="evento/[eventoId]/ao-vivo" options={{ title: 'Ao vivo' }} />
      <Stack.Screen name="evento/[eventoId]/inscricoes" options={{ title: 'Inscrições' }} />
      <Stack.Screen name="evento/[eventoId]/checkin" options={{ title: 'Check-in' }} />
      <Stack.Screen
        name="evento/[eventoId]/ler-qr"
        options={{ title: 'Ler QR', presentation: 'modal' }}
      />
      <Stack.Screen name="serie/[serieId]" options={{ title: 'Série' }} />
      <Stack.Screen name="agenda/[data]" options={{ title: 'Linha do tempo do dia' }} />
      <Stack.Screen name="escalas/index" options={{ title: 'Escalas' }} />
      <Stack.Screen
        name="escalas/substituicao/[atribuicaoId]"
        options={{ title: 'Substituição', presentation: 'modal' }}
      />
    </Stack>
  )
}
