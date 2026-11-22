import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { Botao } from '@/ui/Botao'
import { Folha } from '@/ui/Folha'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { compartilharTexto } from '@/utilidades/compartilhar'

/** A mensagem pronta que a pessoa manda para quem organiza o grupo. */
export const MENSAGEM_DE_PEDIDO_DE_CONVITE = 'Pode me mandar o link de convite?'

/**
 * Folha explicativa de quem ainda não tem código (UX v3, fluxo a): como o convite chega, uma
 * mensagem pronta para mandar à liderança pelo WhatsApp e a saída para quem já tem o link.
 */
export function TelaComoConseguirConvite() {
  async function pedir() {
    const resultado = await compartilharTexto(MENSAGEM_DE_PEDIDO_DE_CONVITE)
    if (resultado === 'copiado') mostrarToast({ texto: 'Mensagem copiada. Cole na conversa.' })
    if (resultado === 'falhou') {
      mostrarToast({
        texto: 'Não deu para abrir o compartilhar. Escreva a mensagem à mão.',
        tipo: 'erro',
      })
    }
  }
  return (
    <Folha titulo="Como conseguir um convite">
      <Texto variante="corpo">
        O {NOME_DO_APP} não tem cadastro aberto: quem entra é convidado pela liderança da sua
        comunidade.
      </Texto>
      <Texto variante="corpo">
        Peça o convite a quem organiza os encontros. Ele chega como um link (por WhatsApp ou e-mail)
        e vale por 7 dias, para uma pessoa.
      </Texto>
      <View
        accessible
        accessibilityLabel={`Mensagem pronta: ${MENSAGEM_DE_PEDIDO_DE_CONVITE}`}
        style={{ gap: ESPACO.e4 }}
      >
        <Texto variante="sobrancelha">Mensagem pronta</Texto>
        <Texto variante="tituloItem">{MENSAGEM_DE_PEDIDO_DE_CONVITE}</Texto>
      </View>
      <Botao
        titulo="Pedir por mensagem"
        icone="compartilhar"
        tamanho="grande"
        larguraTotal
        aoPressionar={() => void pedir()}
      />
      <Botao
        titulo="Já tenho o link ou o código"
        variante="terciario"
        aoPressionar={() => router.replace('/tenho-um-codigo')}
      />
    </Folha>
  )
}
