import { Texto } from '@/ui/Texto'

/**
 * TC-17.v1 (docs/privacidade/textos-de-consentimento.md), palavra por palavra:
 * a ajuda da "Mensagem para a liderança" e o aviso do que a pessoa vai ver.
 */
export function ajudaDaMensagem(comunidade: string): string {
  return `Conte quem você é, por exemplo "Sou a Ana, do grupo de sábado". A liderança da ${comunidade} vai ver seu nome e esta mensagem. Não escreva dados de saúde, documentos nem detalhes de outras pessoas.`
}

export const AVISO_DO_PEDIDO =
  'Você verá só se o pedido está "Pendente", "Aceito" ou "Não aprovado". Se ninguém responder em 30 dias, o pedido vence. Você pode cancelar quando quiser.'

export function AvisoDoPedido() {
  return (
    <Texto variante="meta" cor="textoSuave">
      {AVISO_DO_PEDIDO}
    </Texto>
  )
}
