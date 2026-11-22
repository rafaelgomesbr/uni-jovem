import { router } from 'expo-router'

import { Botao } from '@/ui/Botao'

import { CartaoDoVersiculo } from '../versiculo/CartaoDoVersiculo'
import { MeusPedidos } from './MeusPedidos'
import { VazioComSol } from './VazioComSol'

/**
 * "Comece por aqui" (UX v3, fluxo a): UMA pergunta e UMA ação principal. Quem recebeu um código ou
 * um link é a maioria, então "Tenho um código" é o único botão grande; procurar a comunidade e
 * criar uma são links de texto, com o mesmo alvo de 44 pt mas sem o mesmo peso (criar quase
 * ninguém faz). Antes dela, os pedidos de entrada da própria conta (com "Cancelar pedido"), se
 * houver. O sol atrás do horizonte diz "ainda não" sem ocupar uma linha de texto. O versículo do
 * dia continua por último (o Início sem comunidade o mostrava e não atrapalha a decisão).
 */
export function ComecePorAqui() {
  return (
    <>
      <MeusPedidos />
      <VazioComSol
        titulo="Você recebeu um código ou um link?"
        descricao="Com ele você entra no seu grupo em poucos segundos."
        acao={{ titulo: 'Tenho um código', aoPressionar: () => router.push('/tenho-um-codigo') }}
        rodape={
          <>
            <Botao
              titulo="Procurar minha comunidade"
              variante="terciario"
              aoPressionar={() => router.push('/procurar-comunidade')}
            />
            <Botao
              titulo="Criar uma comunidade"
              variante="terciario"
              aoPressionar={() => router.push('/criar-comunidade')}
            />
          </>
        }
      />
      <CartaoDoVersiculo />
    </>
  )
}
