import { router } from 'expo-router'

import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

/**
 * "Pedido enviado" (UX v3, fluxo a): a comunidade aprova cada entrada, então a pessoa espera. O
 * cartão do momento com o sol nascendo diz o que acontece e como ela será avisada (o sino), com a
 * única saída: voltar ao Início, onde "Meus pedidos" mostra a situação e o "Cancelar pedido".
 * Usada pelo código (`Tenho um código`) e pela comunidade encontrada na busca.
 */
export function PedidoEnviado({ comunidade }: { comunidade: string }) {
  return (
    <Tela pilha titulo="Pedido enviado">
      <Cartao
        variante="momento"
        pose="nascendo"
        etiqueta="Aguardando a liderança"
        titulo={comunidade}
        acoes={<Botao titulo="Voltar para o início" aoPressionar={() => router.replace('/')} />}
      >
        <Texto variante="corpo" cor="textoSuave">
          {`Pedido enviado. A liderança de ${comunidade} vai avaliar. Quando decidirem, o sino do app avisa, e a comunidade aparece para você.`}
        </Texto>
      </Cartao>
    </Tela>
  )
}
