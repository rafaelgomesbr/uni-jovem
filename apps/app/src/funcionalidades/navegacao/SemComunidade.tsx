import { NOME_DO_PAPEL } from '@uj/dominio'
import { router } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import { Botao } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'

/**
 * Sem comunidade, para o Criador (3.2.2 e quadro 10): o destaque é a única
 * coisa a fazer. "Criar comunidade" abre a criação.
 */
export function PrimeirosPassosDoCriador() {
  return (
    <CartaoDeDestaque
      sobrancelha="Primeiros passos"
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

/** A Plataforma a um toque (Criador). */
export function AtalhoDaPlataforma() {
  return (
    <CartaoDeVidro lista>
      <LinhaDeLista
        icone="plataforma"
        titulo="Plataforma"
        descricao="Comunidades, saúde e auditoria"
        aoPressionar={() => router.push('/plataforma')}
      />
    </CartaoDeVidro>
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

/** Várias comunidades e nenhuma escolhida (3.2.4): o toque escolhe direto, sem tela no meio. */
export function EscolherComunidade() {
  const { comunidades, trocarComunidade } = useSessao()
  return (
    <CartaoDeVidro sobrancelha="Suas comunidades" lista>
      <Lista>
        {comunidades.map((c) => (
          <LinhaDeLista
            key={c.id}
            avatar={{ nome: c.nome, cor: c.cor }}
            titulo={c.nome}
            descricao={NOME_DO_PAPEL[c.papel]}
            rotuloAcessivel={`${c.nome}, ${NOME_DO_PAPEL[c.papel]}. Escolher esta comunidade`}
            aoPressionar={() => void trocarComunidade(c.id)}
          />
        ))}
      </Lista>
    </CartaoDeVidro>
  )
}

/**
 * O que as abas mostram enquanto não há comunidade ativa: as mesmas
 * variações do Início (2.12.21), sempre com ação.
 */
export function SemComunidade(_props: { oQue?: string }) {
  const { conta, comunidades } = useSessao()
  if (comunidades.length > 0) return <EscolherComunidade />
  if (conta?.criador) {
    return (
      <>
        <PrimeirosPassosDoCriador />
        <AtalhoDaPlataforma />
      </>
    )
  }
  return <SemComunidadeParaMembro />
}
