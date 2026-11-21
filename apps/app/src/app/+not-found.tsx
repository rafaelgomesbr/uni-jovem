import { router } from 'expo-router'

import { EstadoVazio } from '@/ui/EstadoVazio'
import { Tela } from '@/ui/Tela'

/**
 * Não encontrado (3.7.9): estado vazio de tela inteira, alinhado à esquerda,
 * com o primário "Voltar ao início". `replace`, não `push`: não empilha rota
 * nem volta para o endereço que não existe. Sem sessão, o Início leva ao login
 * (o guarda do grupo autenticado), sem laço.
 */
export default function NaoEncontrado() {
  return (
    <Tela pilha titulo="Não encontrado">
      <EstadoVazio
        icone="erro"
        titulo="Página não encontrada"
        descricao="O endereço pode estar incompleto ou a página mudou de lugar."
        acao={{ titulo: 'Voltar ao início', aoPressionar: () => router.replace('/') }}
        telaInteira
      />
    </Tela>
  )
}
