import { simbolosDeAcidente } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { Texto } from '@/ui/Texto'

import { BotoesDoTom } from './ControlesDaCifra'

export const MOTIVO_PDF_NAO_TRANSPOE =
  'O PDF não muda de tom: ele abre do jeito que foi anexado. Para transpor, peça à organização a cifra em texto.'

/** O tom em texto: "Tom A (original G)", "Tom G" ou "Sem tom informado". */
export function textoDoTom(tomDoDia: string | null, tomOriginal: string | null): string {
  const dia = tomDoDia ? simbolosDeAcidente(tomDoDia) : null
  const original = tomOriginal ? simbolosDeAcidente(tomOriginal) : null
  if (dia && original && dia !== original) return `Tom ${dia} (original ${original})`
  const tom = dia ?? original
  return tom ? `Tom ${tom}` : 'Sem tom informado'
}

/**
 * Música só com PDF (D76): o tom do dia em texto e os botões "Descer tom" e "Subir tom"
 * DESABILITADOS, com o motivo escrito logo abaixo (a razão de o botão não funcionar nunca fica só
 * no leitor de tela).
 */
export function TomDoPdf({
  tomDoDia,
  tomOriginal,
}: {
  tomDoDia: string | null
  tomOriginal: string | null
}) {
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Texto variante="tituloItem">{textoDoTom(tomDoDia, tomOriginal)}</Texto>
      <BotoesDoTom
        desabilitado
        dica={MOTIVO_PDF_NAO_TRANSPOE}
        aoDescer={() => undefined}
        aoSubir={() => undefined}
      />
      <Texto variante="legenda" cor="textoSuave">
        {MOTIVO_PDF_NAO_TRANSPOE}
      </Texto>
    </View>
  )
}
