import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { ResumoDoPdf } from '@/servicos/contratoDoPdf'
import { Botao } from '@/ui/Botao'
import { Texto } from '@/ui/Texto'

import { AvisoDoPdf } from './CartaoDoPdf'
import { formatarTamanho } from './formatos'
import { useAbrirPdf } from './useAbrirPdf'

export interface PdfDoPalco {
  comunidadeId: string | null
  musicaId: string
  resumo: ResumoDoPdf
}

export const TEXTO_DO_PDF_NO_PALCO =
  'O PDF abre em tela cheia, sem barra, e a tela continua acesa. Ele não muda de tom nem de tamanho de letra.'

/**
 * O PDF dentro do Modo palco (D76): o botão grande "Abrir PDF" (o alvo é de 56, para a mão no
 * instrumento), o nome e o tamanho, e a nota de que o PDF abre em tela cheia. O palco já mantém a
 * tela acesa; o PDF aberto pelo visualizador do sistema (Quick Look no iPhone) abre por cima dele.
 */
export function PdfNoPalco({ pdf, titulo }: { pdf: PdfDoPalco; titulo: string }) {
  const { estado, abrir } = useAbrirPdf({
    comunidadeId: pdf.comunidadeId,
    musicaId: pdf.musicaId,
    pdf: pdf.resumo,
  })
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Botao
        titulo="Abrir PDF"
        icone="externo"
        tamanho="alto"
        larguraTotal
        rotuloAcessivel={`Abrir o PDF de ${titulo}`}
        carregando={estado.fase === 'abrindo'}
        tituloCarregando="Abrindo o PDF..."
        aoPressionar={() => void abrir()}
      />
      <Texto variante="legenda" cor="textoSuave">
        {`${pdf.resumo.nome} · ${formatarTamanho(pdf.resumo.tamanho)}. ${TEXTO_DO_PDF_NO_PALCO}`}
      </Texto>
      <AvisoDoPdf estado={estado} aoTentarDeNovo={() => void abrir()} />
    </View>
  )
}
