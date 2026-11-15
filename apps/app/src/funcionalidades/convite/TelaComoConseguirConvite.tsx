import { router } from 'expo-router'

import { NOME_DO_APP } from '@/constantes'
import { Botao } from '@/ui/Botao'
import { Folha } from '@/ui/Folha'
import { Texto } from '@/ui/Texto'

/** Folha explicativa do Início sem comunidade (3.2.3): como o convite chega e o que fazer com ele. */
export function TelaComoConseguirConvite() {
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
      <Texto variante="corpo">
        Com o link em mãos, abra no celular ou cole aqui. Se ele vencer, é só pedir outro.
      </Texto>
      <Botao
        titulo="Colar link de convite"
        icone="link"
        tamanho="grande"
        larguraTotal
        aoPressionar={() => router.replace('/entrar-com-convite')}
      />
    </Folha>
  )
}
