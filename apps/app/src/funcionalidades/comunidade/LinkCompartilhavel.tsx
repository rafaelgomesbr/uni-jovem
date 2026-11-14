import { ESPACO, RAIO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import { abrirLink, copiarTexto, linkDoWhatsApp } from '@/utilidades/compartilhar'
import { formatarData } from '@/utilidades/formatos'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

interface Props {
  titulo: string
  link: string
  expiraEm: string
  /** Texto que acompanha o link no WhatsApp. */
  mensagem: string
}

/** Link de convite pronto: copiar e mandar pelo WhatsApp. */
export function LinkCompartilhavel({ titulo, link, expiraEm, mensagem }: Props) {
  const { cores } = useTema()
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <Cartao titulo={titulo} icone="link">
      <Texto variante="apoio" cor="textoSuave">
        O link vale até {formatarData(expiraEm)} e serve para uma pessoa só.
      </Texto>
      <View
        style={{
          padding: ESPACO.x3,
          borderRadius: RAIO.pequeno,
          backgroundColor: cores.superficieElevada,
        }}
      >
        <Texto selectable variante="apoio">
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
        titulo="Mandar pelo WhatsApp"
        icone="compartilhar"
        variante="secundario"
        aoPressionar={async () => {
          const ok = await abrirLink(linkDoWhatsApp(`${mensagem}\n${link}`))
          if (!ok) setAviso('Não foi possível abrir o WhatsApp. Copie o link e envie por lá.')
        }}
      />
      {aviso ? (
        <Texto variante="apoio" accessibilityLiveRegion="polite">
          {aviso}
        </Texto>
      ) : null}
    </Cartao>
  )
}
