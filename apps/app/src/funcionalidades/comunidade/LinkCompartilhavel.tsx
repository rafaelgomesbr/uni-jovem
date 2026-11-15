import { ESPACO, RAIO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { compartilharTexto, copiarTexto } from '@/utilidades/compartilhar'
import { formatarData } from '@/utilidades/formatos'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { CodigoQR } from '@/ui/CodigoQR'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { useTema } from '@/ui/tema'

import { Chip, Chips, Sobrancelha } from './visual'

interface Props {
  titulo: string
  link: string
  expiraEm: string
  /** Texto que acompanha o link ao compartilhar (WhatsApp e outros apps). */
  mensagem: string
  /** E-mail a que o convite ficou preso, quando houver. */
  emailDestino?: string | null
  /** Papel que a pessoa recebe ao aceitar (aparece num chip). */
  papel?: string
  /** QR do link, para quem está ao lado abrir com a câmera. */
  mostrarQr?: boolean
}

/**
 * Convite pronto: o link aparece uma vez só (a API guarda apenas o HMAC do
 * token), então a tela oferece copiar, compartilhar e o QR na hora.
 */
export function LinkCompartilhavel({
  titulo,
  link,
  expiraEm,
  mensagem,
  emailDestino,
  papel,
  mostrarQr = false,
}: Props) {
  const { cores } = useTema()
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <Cartao>
      <View style={{ gap: ESPACO.e4 }}>
        <Sobrancelha>Link do convite</Sobrancelha>
        <Texto variante="tituloItem" accessibilityRole="header" nivel={2}>
          {titulo}
        </Texto>
      </View>
      <Chips>
        {papel ? <Chip texto={papel} icone="pessoa" tom="destaque" /> : null}
        <Chip texto={`Vale até ${formatarData(expiraEm)}`} icone="relogio" />
        <Chip texto="Uso único" icone="chave" />
      </Chips>
      <Texto variante="legenda" cor="textoSuave">
        {emailDestino
          ? `Só quem entrar com ${emailDestino} consegue usar este convite.`
          : 'Qualquer pessoa com o link entra uma vez. Mande só para quem você quer convidar.'}
      </Texto>
      <View
        style={{
          padding: ESPACO.e12,
          borderRadius: RAIO.controle,
          backgroundColor: cores.pressionado,
        }}
      >
        <Texto selectable variante="corpo" accessibilityLabel={`Link do convite: ${link}`}>
          {link}
        </Texto>
      </View>
      <Botao
        titulo="Copiar link"
        icone="copiar"
        aoPressionar={async () => {
          const ok = await copiarTexto(link)
          setAviso(ok ? 'Link copiado.' : 'Não foi possível copiar. Selecione o link acima.')
        }}
      />
      <Botao
        titulo="Compartilhar"
        icone="compartilhar"
        variante="secundario"
        dica="Abre o compartilhamento do aparelho, com WhatsApp e outros apps."
        aoPressionar={async () => {
          const r = await compartilharTexto(`${mensagem}\n${link}`)
          if (r === 'copiado') {
            setAviso(
              'O compartilhamento não abriu aqui, então o link foi copiado. Cole no WhatsApp.',
            )
          } else if (r === 'falhou') {
            setAviso('Não foi possível compartilhar. Selecione o link acima e copie.')
          }
        }}
      />
      <Texto variante="legenda" cor="textoSuave">
        Para mandar no WhatsApp, toque em Compartilhar e escolha o WhatsApp.
      </Texto>
      {aviso ? <TextoAnunciado variante="corpo">{aviso}</TextoAnunciado> : null}
      {mostrarQr ? (
        <View style={{ gap: ESPACO.e8, alignItems: 'center', marginTop: ESPACO.e8 }}>
          <CodigoQR valor={link} rotulo="QR com o link do convite" />
          <Texto variante="legenda" cor="textoSuave" centralizado>
            Quem estiver ao seu lado pode apontar a câmera para o QR.
          </Texto>
        </View>
      ) : null}
    </Cartao>
  )
}
