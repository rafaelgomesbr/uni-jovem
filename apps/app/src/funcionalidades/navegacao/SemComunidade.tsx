import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { Botao } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { EstadoVazio } from '@/ui/EstadoVazio'

/**
 * Sem comunidade, para o Criador (3.2.2 e quadro 10): o destaque é a única
 * coisa a fazer. "Criar comunidade" abre a criação.
 */
export function PrimeirosPassosDoCriador() {
  return (
    <CartaoDeDestaque
      sobrancelha="Para começar"
      titulo="Crie sua primeira comunidade"
      descricao="Você é o Criador da plataforma. Crie uma comunidade e mande o convite para quem vai administrá-la."
      acoes={
        <Botao
          titulo="Criar comunidade"
          icone="adicionar"
          aoPressionar={() => router.push('/plataforma/nova')}
        />
      }
    />
  )
}

/**
 * Sem comunidade, fora do Início (3.2.3 e ADR 0007): os dois caminhos mais
 * comuns direto daqui; o Início ("Comece por aqui") mostra os três.
 */
export function SemComunidadeParaMembro() {
  return (
    <EstadoVazio
      icone="pessoas"
      titulo="Você ainda não participa de uma comunidade"
      descricao="Entre com o código que a liderança passou ou procure a sua comunidade pelo nome."
      acao={{
        titulo: 'Tenho um código',
        icone: 'qr',
        aoPressionar: () => router.push('/tenho-um-codigo'),
      }}
      acaoSecundaria={{
        titulo: 'Procurar comunidade',
        aoPressionar: () => router.push('/procurar-comunidade'),
      }}
    />
  )
}

/**
 * O que as abas mostram enquanto a conta não participa de nenhuma
 * comunidade: as mesmas variações do Início (2.12.21), sempre com ação. Com
 * alguma comunidade, a sessão já entra na última usada (D57), então não há
 * lista de escolha aqui. A Plataforma fica só no Perfil.
 */
export function SemComunidade(_props: { oQue?: string }) {
  const { conta } = useSessao()
  if (conta?.criador) return <PrimeirosPassosDoCriador />
  return <SemComunidadeParaMembro />
}
