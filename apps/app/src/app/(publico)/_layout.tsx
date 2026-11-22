import { Redirect, Stack } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { useRedirecionamentoSegurado } from '@/funcionalidades/autenticacao/sucessoDaEntrada'
import { lerConviteEmEspera } from '@/funcionalidades/convite/conviteEmEspera'
import { useOpcoesDaPilha } from '@/funcionalidades/navegacao/opcoesDaPilha'
import { opcoesDaFolhaNativa } from '@/ui/opcoesDaFolha'
import { useTema } from '@/ui/tema'

/**
 * Guarda do grupo público: quem já entrou vai para o app (ou volta ao convite
 * que abriu). Quem acabou de entrar por esta tela espera 200 ms (D63) para o
 * check do botão e o halo do sol aparecerem; quem abre o app já logado nunca
 * espera, porque só o pedido de entrada desta sessão segura o redirecionamento
 * (e ele tem teto próprio, em `sucessoDaEntrada`).
 */
export default function LayoutPublico() {
  const { estado, biometria } = useSessao()
  const segurado = useRedirecionamentoSegurado()
  const opcoesDaPilha = useOpcoesDaPilha()
  const { cores } = useTema()
  if (estado === 'autenticado' && !segurado) {
    // Convite aberto antes de entrar vem primeiro; depois, a pergunta sobre o Face ID.
    if (lerConviteEmEspera()) return <Redirect href="/convite" />
    return <Redirect href={biometria.oferecer ? '/biometria' : '/'} />
  }
  return (
    <Stack screenOptions={{ ...opcoesDaPilha, headerShown: false }}>
      {/* `animation: 'none'`: abrir o e-mail empilha a mesma rota com `?modo=email` e a troca é do próprio painel (280 ms). */}
      <Stack.Screen
        name="entrar"
        options={{ headerShown: false, title: 'Entrar', animation: 'none' }}
      />
      <Stack.Screen name="segundo-fator" options={{ title: 'Verificação' }} />
      <Stack.Screen name="recuperar-senha" options={{ title: 'Recuperar senha' }} />
      <Stack.Screen name="criar-conta" options={{ title: 'Criar conta', animation: 'fade' }} />
      <Stack.Screen
        name="completar-cadastro"
        options={{ title: 'Falta pouco', animation: 'fade' }}
      />
      <Stack.Screen
        name="colar-convite"
        options={{
          title: 'Tenho um convite ou código',
          ...opcoesDaFolhaNativa(cores),
        }}
      />
    </Stack>
  )
}
