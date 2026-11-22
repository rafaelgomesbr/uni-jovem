import { Redirect, Stack } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { BarraDaPilha, leiauteDaTelaNaPilha } from '@/funcionalidades/navegacao/BarraDaPilha'
import { useOpcoesDaPilha } from '@/funcionalidades/navegacao/opcoesDaPilha'
import { TermoDoAdminPendente } from '@/funcionalidades/comunidade/TermoDoAdminPendente'
import { AgendadorDoAparelho } from '@/funcionalidades/notificacoes/AgendadorDoAparelho'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { opcoesDaFolhaNativa } from '@/ui/opcoesDaFolha'
import { Tela } from '@/ui/Tela'
import { useTema } from '@/ui/tema'

/** Guarda do app: sem sessão, vai para Entrar. */
export default function LayoutAutenticado() {
  const { estado } = useSessao()
  const opcoesDaPilha = useOpcoesDaPilha()
  const { cores } = useTema()
  // Folha nativa (2.12.19): com a altura do conteúdo, nunca uma lista de alturas (ver `opcoesDaFolha`).
  const folha = opcoesDaFolhaNativa(cores)
  // Formulário longo e câmera (3.4.3 e 3.5.3): tela cheia, com "Fechar" no lugar de "Voltar".
  const telaCheia = { presentation: 'fullScreenModal' } as const
  if (estado === 'anonimo') return <Redirect href="/entrar" />
  if (estado === 'carregando') {
    return (
      <Tela rolar={false}>
        <Esqueleto rotulo="Abrindo o app">
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      </Tela>
    )
  }
  return (
    <>
      {/* Versículo local e token de push, sempre em dia com a conta (sem interface). */}
      <AgendadorDoAparelho />
      {/* Sem cabeçalho nativo: cada tela tem o próprio cabeçalho (2.12.16) sobre a Aurora. */}
      {/* Cada tela recebe o espaço da barra flutuante (0 nas abas e nas exceções, D56). */}
      <Stack
        screenOptions={{ ...opcoesDaPilha, headerShown: false }}
        screenLayout={leiauteDaTelaNaPilha}
      >
        <Stack.Screen name="(abas)" options={{ headerShown: false, title: 'Início' }} />
        <Stack.Screen name="trocar-comunidade" options={{ title: 'Comunidade', ...folha }} />
        <Stack.Screen
          name="como-conseguir-convite"
          options={{ title: 'Como conseguir um convite', ...folha }}
        />
        <Stack.Screen name="convidar" options={{ title: 'Convidar' }} />
        {/* ADR 0007: entrar sem convite, criar comunidade e o código da comunidade. */}
        <Stack.Screen name="comece-por-aqui" options={{ title: 'Outra comunidade' }} />
        {/* Degrau antes do Início, uma vez por entrada: sem gesto de voltar para o código. */}
        <Stack.Screen
          name="boas-vindas"
          options={{ title: 'Boas-vindas', gestureEnabled: false }}
        />
        <Stack.Screen name="tenho-um-codigo" options={{ title: 'Tenho um código' }} />
        <Stack.Screen name="procurar-comunidade" options={{ title: 'Procurar comunidade' }} />
        <Stack.Screen name="comunidade-encontrada/[idPublico]" options={{ title: 'Comunidade' }} />
        <Stack.Screen name="denunciar-comunidade" options={{ title: 'Denunciar comunidade' }} />
        <Stack.Screen
          name="criar-comunidade"
          options={{ title: 'Criar comunidade', ...telaCheia }}
        />
        <Stack.Screen name="codigo-da-comunidade" options={{ title: 'Código da comunidade' }} />
        <Stack.Screen name="membro/[vinculoId]" options={{ title: 'Pessoa' }} />
        <Stack.Screen name="pessoas" options={{ title: 'Pessoas' }} />
        <Stack.Screen name="pedidos-de-entrada" options={{ title: 'Pedidos de entrada' }} />
        <Stack.Screen name="aparelhos" options={{ title: 'Aparelhos' }} />
        <Stack.Screen name="ativar-2fa" options={{ title: 'Segurança' }} />
        <Stack.Screen name="plataforma/index" options={{ title: 'Plataforma' }} />
        <Stack.Screen name="plataforma/nova" options={{ title: 'Nova comunidade' }} />
        <Stack.Screen name="plataforma/[comunidadeId]" options={{ title: 'Comunidade' }} />
        <Stack.Screen name="evento/novo" options={{ title: 'Novo encontro', ...telaCheia }} />
        {/* "Igual ao último sábado" e "Marcar o próximo sábado" (D69): a conferência. */}
        <Stack.Screen
          name="evento/igual-ao-ultimo"
          options={{ title: 'Igual ao último sábado', ...telaCheia }}
        />
        <Stack.Screen name="evento/[eventoId]/index" options={{ title: 'Encontro' }} />
        <Stack.Screen name="evento/[eventoId]/editar" options={{ title: 'Editar', ...telaCheia }} />
        <Stack.Screen
          name="evento/[eventoId]/status"
          options={{ title: 'Cancelar ou adiar', presentation: 'modal' }}
        />
        <Stack.Screen
          name="evento/[eventoId]/duplicar"
          options={{ title: 'Duplicar', ...telaCheia }}
        />
        <Stack.Screen
          name="evento/[eventoId]/etapa/[etapaId]"
          options={{ title: 'Etapa e equipe' }}
        />
        <Stack.Screen name="evento/[eventoId]/ao-vivo" options={{ title: 'Ao vivo' }} />
        {/* Louvor (D61): repertório do encontro, Meu repertório e a cifra grande. */}
        <Stack.Screen name="evento/[eventoId]/repertorio" options={{ title: 'Repertório' }} />
        <Stack.Screen name="louvor" options={{ title: 'Louvor' }} />
        <Stack.Screen name="meu-repertorio/index" options={{ title: 'Meu repertório' }} />
        <Stack.Screen name="meu-repertorio/[eventoId]/[itemId]" options={{ title: 'Cifra' }} />
        <Stack.Screen name="evento/[eventoId]/inscricoes" options={{ title: 'Inscrições' }} />
        <Stack.Screen name="evento/[eventoId]/checkin" options={{ title: 'Marcar quem chegou' }} />
        <Stack.Screen name="evento/[eventoId]/ler-qr" options={{ title: 'Ler QR', ...telaCheia }} />
        <Stack.Screen name="serie/[serieId]" options={{ title: 'Repetição' }} />
        <Stack.Screen name="agenda/[data]" options={{ title: 'Linha do tempo do dia' }} />
        <Stack.Screen
          name="escalas/substituicao/[atribuicaoId]"
          options={{ title: 'Substituição', presentation: 'modal' }}
        />
        <Stack.Screen name="conta" options={{ title: 'Perfil' }} />
        <Stack.Screen name="conta/seguranca" options={{ title: 'Segurança' }} />
        <Stack.Screen name="oracao/index" options={{ title: 'Pedidos de oração' }} />
        <Stack.Screen name="oracao/novo" options={{ title: 'Pedir oração' }} />
        <Stack.Screen name="oracao/[pedidoId]" options={{ title: 'Pedido de oração' }} />
        <Stack.Screen name="sugestoes/index" options={{ title: 'Sugestões' }} />
        <Stack.Screen name="sugestoes/nova" options={{ title: 'Sugerir uma ideia' }} />
        <Stack.Screen name="sugestoes/[sugestaoId]" options={{ title: 'Sugestão' }} />
        <Stack.Screen name="bloqueados" options={{ title: 'Pessoas bloqueadas' }} />
        <Stack.Screen name="conteudos/index" options={{ title: 'Biblioteca' }} />
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
        <Stack.Screen name="notificacoes" options={{ title: 'Quando o app me avisa' }} />
        <Stack.Screen name="caixa-de-notificacoes" options={{ title: 'Notificações' }} />
        <Stack.Screen name="versiculo/index" options={{ title: 'Versículo do dia' }} />
        <Stack.Screen name="versiculo/traducao" options={{ title: 'Sobre a tradução' }} />
        <Stack.Screen name="missao" options={{ title: 'Primeiros passos' }} />
        <Stack.Screen name="privacidade" options={{ title: 'Privacidade' }} />
        <Stack.Screen name="pendencias" options={{ title: 'Uso sem internet' }} />
        {/* Antiga aba Programas (D57): redireciona para a Agenda no modo Lista. */}
        <Stack.Screen name="programacoes" options={{ title: 'Agenda' }} />
        {/* Antiga aba Escalas (D68): redireciona para a Agenda, "Só o que é meu". */}
        <Stack.Screen name="escalas/index" options={{ title: 'Agenda' }} />
        <Stack.Screen name="excluir-conta" options={{ title: 'Excluir conta' }} />
        {/* D77: limpar os próximos encontros e excluir a comunidade (dois passos, sem digitar). */}
        <Stack.Screen
          name="limpar-proximos-encontros"
          options={{ title: 'Limpar próximos encontros' }}
        />
        <Stack.Screen name="excluir-comunidade" options={{ title: 'Excluir comunidade' }} />
      </Stack>
      {/* A barra de abas também nas telas empilhadas de navegação (D56), por cima da pilha. */}
      <BarraDaPilha />
      {/* TC-16 pendente (admin promovido depois ou termo novo): folha antes de administrar. */}
      <TermoDoAdminPendente />
    </>
  )
}
