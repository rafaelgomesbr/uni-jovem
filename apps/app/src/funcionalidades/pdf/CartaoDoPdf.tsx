import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { ResumoDoPdf } from '@/servicos/contratoDoPdf'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'

import { formatarTamanho } from './formatos'
import { useAbrirPdf, type EstadoDoAbrirPdf } from './useAbrirPdf'

export const NOTA_DO_PDF =
  'O PDF abre inteiro, do jeito que foi anexado. Ele não muda de tom nem de tamanho de letra.'

interface Props {
  comunidadeId: string | null
  musicaId: string
  /** Título da música, para o nome acessível do botão. */
  titulo: string
  pdf: ResumoDoPdf
  /** Há uma cópia deste PDF guardada neste aparelho (abre sem internet). */
  guardado?: boolean
  /** Texto no lugar da nota padrão. */
  nota?: string
}

/** "Selo PDF": texto, nunca só cor. Entra nas linhas de música que têm PDF anexado. */
export function SeloDePdf() {
  return <Chip tom="info" texto="PDF" />
}

/** O que aconteceu ao tentar abrir, em palavras (erro, sem internet, cópia antiga, aba barrada). */
export function AvisoDoPdf({
  estado,
  aoTentarDeNovo,
}: {
  estado: EstadoDoAbrirPdf
  aoTentarDeNovo: () => void
}) {
  if (estado.fase === 'erro') {
    return (
      <Aviso
        tipo={estado.semInternet ? 'alerta' : 'erro'}
        titulo={estado.semInternet ? 'Sem internet' : 'Não deu para abrir o PDF'}
        anunciar
        acao={{ titulo: 'Tentar de novo', aoPressionar: aoTentarDeNovo }}
      >
        {estado.mensagem}
      </Aviso>
    )
  }
  if (estado.fase === 'aberto' && estado.desatualizado) {
    return (
      <Aviso tipo="info" titulo="Cópia guardada neste aparelho">
        Sem internet, abrimos a cópia que está aqui. Ela pode não ser a versão mais nova do PDF.
      </Aviso>
    )
  }
  if (estado.fase === 'aberto' && estado.baixado) {
    return (
      <Aviso tipo="info" titulo="O PDF foi baixado">
        O navegador não abriu uma aba nova, então o arquivo foi baixado. Abra o arquivo baixado.
      </Aviso>
    )
  }
  return null
}

/**
 * O PDF da música na leitura (D76): o nome e o tamanho, a nota de que ele não muda de tom e o botão
 * "Abrir PDF", que abre o leitor do sistema (tela cheia). Mostra o erro e a falta de internet em
 * palavras, com "Tentar de novo".
 */
export function CartaoDoPdf({ comunidadeId, musicaId, titulo, pdf, guardado, nota }: Props) {
  const { estado, abrir } = useAbrirPdf({ comunidadeId, musicaId, pdf })
  return (
    <Cartao
      sobrancelha="PDF da música"
      extra={<SeloDePdf />}
      acoes={
        <Botao
          titulo="Abrir PDF"
          icone="externo"
          tamanho="medio"
          rotuloAcessivel={`Abrir o PDF de ${titulo}`}
          carregando={estado.fase === 'abrindo'}
          tituloCarregando="Abrindo o PDF..."
          aoPressionar={() => void abrir()}
        />
      }
    >
      <View style={{ gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">{pdf.nome}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {guardado
            ? `${formatarTamanho(pdf.tamanho)} · Guardado neste aparelho`
            : formatarTamanho(pdf.tamanho)}
        </Texto>
        <Texto variante="corpo" cor="textoSuave">
          {nota ?? NOTA_DO_PDF}
        </Texto>
      </View>
      <AvisoDoPdf estado={estado} aoTentarDeNovo={() => void abrir()} />
    </Cartao>
  )
}
