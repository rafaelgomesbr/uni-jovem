import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { CodigoQR } from '@/ui/CodigoQR'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { compartilharTexto, copiarTexto } from '@/utilidades/compartilhar'
import { NOMES_DOS_DIAS } from '@/utilidades/datas'
import { formatarDataEHora } from '@/utilidades/formatos'

interface Props {
  /** Usado quando não há papel ("Convite para Jovens Central"). */
  titulo: string
  link: string
  expiraEm: string
  /** Texto que acompanha o link ao compartilhar (WhatsApp e outros apps). */
  mensagem: string
  /** E-mail a que o convite ficou preso, quando houver. */
  emailDestino?: string | null
  /** Papel que a pessoa recebe ao aceitar: é o título do cartão. */
  papel?: string
  /** "Mostrar o QR", para quem está ao lado abrir com a câmera. */
  mostrarQr?: boolean
}

/** "sexta-feira, 21/11/2026 às 18:00" (no relógio do aparelho). */
function validade(expiraEm: string): string {
  const dia = NOMES_DOS_DIAS[new Date(expiraEm).getDay()] ?? ''
  return `${dia}, ${formatarDataEHora(expiraEm)}`
}

/**
 * Convite criado (3.6.2, resultado): o cartão de destaque com "CONVITE
 * CRIADO", o papel, o link (aparece uma vez só: a API guarda apenas o HMAC
 * do token), a validade e os botões Copiar e Compartilhar lado a lado. O QR
 * aparece sob pedido. Confirmações em toast.
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
  const [qrVisivel, setQrVisivel] = useState(false)

  async function copiar() {
    const ok = await copiarTexto(link)
    mostrarToast(
      ok
        ? { texto: 'Link copiado.' }
        : { texto: 'Não foi possível copiar. Selecione o link no cartão.', tipo: 'erro' },
    )
  }

  async function compartilhar() {
    const r = await compartilharTexto(`${mensagem}\n${link}`)
    if (r === 'copiado') {
      mostrarToast({
        texto: 'O compartilhamento não abriu aqui; o link foi copiado. Cole no WhatsApp.',
        tipo: 'info',
      })
    } else if (r === 'falhou') {
      mostrarToast({ texto: 'Não foi possível compartilhar agora.', tipo: 'erro' })
    }
  }

  return (
    <Cartao
      sobrancelha="Convite criado"
      titulo={papel ?? titulo}
      acoes={
        <View style={{ gap: ESPACO.e8 }}>
          <ParDeBotoes>
            <Botao
              titulo="Copiar"
              rotuloAcessivel="Copiar link"
              icone="copiar"
              variante="secundario"
              aoPressionar={() => void copiar()}
            />
            <Botao
              titulo="Compartilhar"
              icone="compartilhar"
              dica="Abre o compartilhamento do aparelho, com WhatsApp e outros apps."
              aoPressionar={() => void compartilhar()}
            />
          </ParDeBotoes>
          {mostrarQr ? (
            <Botao
              titulo={qrVisivel ? 'Esconder o QR' : 'Mostrar o QR'}
              variante="terciario"
              alinhado
              expandido={qrVisivel}
              aoPressionar={() => setQrVisivel((v) => !v)}
            />
          ) : null}
        </View>
      }
    >
      <View style={{ gap: ESPACO.e8 }}>
        <Texto
          variante="legenda"
          selectable
          numberOfLines={1}
          ellipsizeMode="middle"
          accessibilityLabel={`Link do convite: ${link}`}
        >
          {link}
        </Texto>
        <Texto variante="corpo">{`Vale até ${validade(expiraEm)}`}</Texto>
        <Texto variante="legenda" cor="textoSuave">
          {emailDestino
            ? `Só quem entrar com ${emailDestino} consegue usar este convite.`
            : 'Qualquer pessoa com o link entra uma vez. Mande só para quem você quer convidar.'}
        </Texto>
        {qrVisivel ? (
          <View style={{ alignItems: 'center', gap: ESPACO.e8, marginTop: ESPACO.e8 }}>
            <CodigoQR valor={link} rotulo="QR com o link do convite" />
            <Texto variante="legenda" cor="textoSuave" centralizado>
              Quem estiver ao seu lado pode apontar a câmera para o QR.
            </Texto>
          </View>
        ) : null}
      </View>
    </Cartao>
  )
}
