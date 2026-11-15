import { Redirect, Stack } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { useOpcoesDaPilha } from '@/funcionalidades/navegacao/opcoesDaPilha'
import { AgendadorDoAparelho } from '@/funcionalidades/notificacoes/AgendadorDoAparelho'
import { Carregando } from '@/ui/Carregando'
import { Tela } from '@/ui/Tela'
import { useTema } from '@/ui/tema'

/** Guarda do app: sem sessão, vai para Entrar. */
export default function LayoutAutenticado() {
  const { estado } = useSessao()
  const opcoesDaPilha = useOpcoesDaPilha()
  const { cores } = useTema()
  if (estado === 'anonimo') return <Redirect href="/entrar" />
  if (estado === 'carregando') {
    return (
      <Tela rolar={false}>
        <Carregando texto="Abrindo o app" />
      </Tela>
    )
  }
  return (
    <>
      {/* Versículo local e token de push, sempre em dia com a conta (sem interface). */}
      <AgendadorDoAparelho />
      {/* Sem cabeçalho nativo: cada tela tem o próprio cabeçalho (2.12.16) sobre a Aurora. */}
      <Stack screenOptions={{ ...opcoesDaPilha, headerShown: false }}>
        <Stack.Screen name="(abas)" options={{ headerShown: false, title: 'Início' }} />
        <Stack.Screen
          name="trocar-comunidade"
          options={{ title: 'Comunidade', presentation: 'modal' }}
        />
        <Stack.Screen
          name="como-conseguir-convite"
          options={{
            title: 'Como conseguir um convite',
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
            contentStyle: { backgroundColor: cores.superficieElevada },
          }}
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
        <Stack.Screen name="conta" options={{ title: 'Perfil' }} />
        <Stack.Screen name="conta/seguranca" options={{ title: 'Segurança' }} />
        <Stack.Screen name="oracao/index" options={{ title: 'Oração' }} />
        <Stack.Screen name="oracao/novo" options={{ title: 'Novo pedido' }} />
        <Stack.Screen name="oracao/[pedidoId]" options={{ title: 'Pedido de oração' }} />
        <Stack.Screen name="sugestoes/index" options={{ title: 'Sugestões' }} />
        <Stack.Screen name="sugestoes/nova" options={{ title: 'Nova sugestão' }} />
        <Stack.Screen name="sugestoes/[sugestaoId]" options={{ title: 'Sugestão' }} />
        <Stack.Screen name="conteudos/index" options={{ title: 'Conteúdos' }} />
        <Stack.Screen name="conteudos/[tipo]/novo" options={{ title: 'Novo conteúdo' }} />
        <Stack.Screen name="conteudos/[tipo]/[itemId]" options={{ title: 'Conteúdo' }} />
        <Stack.Screen name="avisos/index" options={{ title: 'Avisos' }} />
        <Stack.Screen name="avisos/novo" options={{ title: 'Novo aviso' }} />
        <Stack.Screen name="avisos/[avisoId]" options={{ title: 'Aviso' }} />
        <Stack.Screen name="relatorios/index" options={{ title: 'Relatórios' }} />
        <Stack.Screen name="relatorios/exportacoes" options={{ title: 'Exportar CSV' }} />
        <Stack.Screen name="locais/index" options={{ title: 'Locais' }} />
        <Stack.Screen name="locais/[localId]" options={{ title: 'Local' }} />
        <Stack.Screen name="modelos" options={{ title: 'Modelos' }} />
        <Stack.Screen name="denuncias" options={{ title: 'Denúncias' }} />
        <Stack.Screen name="notificacoes" options={{ title: 'Notificações' }} />
        <Stack.Screen name="versiculo/index" options={{ title: 'Versículo do dia' }} />
        <Stack.Screen name="versiculo/traducao" options={{ title: 'Sobre a tradução' }} />
        <Stack.Screen name="missao" options={{ title: 'Mapa da missão' }} />
        <Stack.Screen name="privacidade" options={{ title: 'Privacidade' }} />
        <Stack.Screen name="pendencias" options={{ title: 'Pendências' }} />
        <Stack.Screen name="excluir-conta" options={{ title: 'Excluir conta' }} />
      </Stack>
    </>
  )
}
