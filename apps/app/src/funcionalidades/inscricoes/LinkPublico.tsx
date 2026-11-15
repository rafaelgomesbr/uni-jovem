import { ESPACO, RAIO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { linkPublicoDoEvento } from '@/servicos/enderecos'
import { compartilharTexto, copiarTexto } from '@/utilidades/compartilhar'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'
import { useTema } from '@/ui/tema'

interface Props {
  idPublico: string
  titulo: string
}

/** Link da página pública de inscrição, para copiar ou mandar (WhatsApp pela folha do sistema). */
export function LinkPublico({ idPublico, titulo }: Props) {
  const { cores } = useTema()
  const [aviso, setAviso] = useState<string | null>(null)
  const link = linkPublicoDoEvento(idPublico)

  return (
    <Cartao titulo="Página pública" icone="link">
      <Texto variante="legenda" cor="textoSuave">
        Quem recebe o link vê as informações do evento e se inscreve com nome e WhatsApp, sem
        precisar de conta. A lista de participantes nunca aparece lá.
      </Texto>
      <View
        style={{
          padding: ESPACO.e12,
          borderRadius: RAIO.celula,
          backgroundColor: cores.superficieElevada,
        }}
      >
        <Texto selectable variante="corpo">
          {link}
        </Texto>
      </View>
      <Botao
        titulo="Compartilhar"
        icone="compartilhar"
        rotuloAcessivel="Compartilhar o link da página pública (WhatsApp e outros apps)"
        aoPressionar={async () => {
          const r = await compartilharTexto(`${titulo}: inscreva-se pelo link\n${link}`)
          setAviso(
            r === 'copiado'
              ? 'Este aparelho não abriu o compartilhamento; o link foi copiado.'
              : r === 'falhou'
                ? 'Não foi possível compartilhar. Selecione o link acima e copie.'
                : null,
          )
        }}
      />
      <Botao
        titulo="Copiar link"
        icone="copiar"
        variante="secundario"
        aoPressionar={async () => {
          const ok = await copiarTexto(link)
          setAviso(ok ? 'Link copiado.' : 'Não foi possível copiar. Selecione o link acima.')
        }}
      />
      {aviso ? <TextoAnunciado variante="corpo">{aviso}</TextoAnunciado> : null}
    </Cartao>
  )
}
