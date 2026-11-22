import { ESPACO } from '@uj/tokens'
import { useState } from 'react'
import { View } from 'react-native'

import type { ResumoDoPdf } from '@/servicos/contratoDoPdf'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'

import { SeloDePdf } from '../pdf/CartaoDoPdf'
import { descricaoDoPdf, formatarTamanho } from '../pdf/formatos'
import { AVISO_DE_DIREITOS, TEXTO_DA_CONFIRMACAO_DE_DIREITOS } from './tipos'

export const TEXTO_SEM_PDF =
  'Anexe a cifra ou a partitura que você já tem em PDF. O PDF abre inteiro, do jeito que foi anexado: ele não muda de tom.'

export const MENSAGEM_DE_CONFIRMAR_O_PDF = 'Confirme os direitos de uso para anexar o PDF.'

interface Props {
  /** O PDF já anexado à música (nulo se não há). */
  atual: ResumoDoPdf | null
  /** Na música nova: o arquivo já escolhido, que só vai quando a música for salva. */
  escolhido: { nome: string; tamanho: number } | null
  /** O que está em curso agora, para o botão certo girar. */
  ocupado: 'enviando' | 'removendo' | null
  /** Mensagem humana da última tentativa que não deu certo (arquivo grande, não é PDF, sem internet). */
  erro: string | null
  /** O mesmo aceite de direitos da cifra em texto: sem ele não se anexa. */
  confirmada: boolean
  aoConfirmar: (confirmada: boolean) => void
  erroDaConfirmacao: string | null
  /** Tocou em anexar sem o aceite: o pai marca o erro do aceite (que a tela mostra em texto). */
  aoSemAceite: () => void
  aoEscolher: () => void
  aoRemover: () => void
  /** Música salva: "Abrir" mostra o PDF que está anexado. */
  aoAbrir?: () => void
  /**
   * O campo da cifra já mostra o aviso de direitos (há cifra em texto) e, se a cifra é nova ou
   * mudou, a caixa do aceite: o PDF reaproveita o que já está na tela, em vez de repeti-lo.
   */
  avisoJaNaTela?: boolean
  caixaJaNaTela?: boolean
}

/**
 * "Anexar PDF" da música (D76), na Biblioteca. Mostra o PDF anexado (nome e tamanho) com "Trocar"
 * e "Remover", o progresso do envio e o erro em linguagem humana. Direitos autorais: o MESMO aviso e
 * o MESMO aceite da cifra em texto. Tocar em "Anexar PDF" sem o aceite mostra o aviso e a caixa, com
 * o que falta escrito; com o aceite marcado, abre a escolha do arquivo. Nada fica escondido em
 * gesto: tudo é botão com texto.
 */
export function CampoDePdf({
  atual,
  escolhido,
  ocupado,
  erro,
  confirmada,
  aoConfirmar,
  erroDaConfirmacao,
  aoSemAceite,
  aoEscolher,
  aoRemover,
  aoAbrir,
  avisoJaNaTela = false,
  caixaJaNaTela = false,
}: Props) {
  const [pediuAceite, setPediuAceite] = useState(false)
  const temAlgo = atual !== null || escolhido !== null
  const mostrarCaixa = (pediuAceite || confirmada) && !caixaJaNaTela

  function anexar() {
    if (!confirmada) {
      setPediuAceite(true)
      aoSemAceite()
      return
    }
    aoEscolher()
  }

  return (
    <CartaoDeVidro
      opaco
      sobrancelha="PDF da música"
      intervalo={ESPACO.e12}
      extra={temAlgo ? <SeloDePdf /> : undefined}
    >
      {atual ? (
        <View
          style={{ gap: ESPACO.e4 }}
          accessible
          accessibilityLabel={`PDF anexado: ${descricaoDoPdf(atual)}`}
        >
          <Texto variante="tituloItem">PDF anexado</Texto>
          <Texto variante="meta" cor="textoSuave">
            {descricaoDoPdf(atual)}
          </Texto>
        </View>
      ) : escolhido ? (
        <View
          style={{ gap: ESPACO.e4 }}
          accessible
          accessibilityLabel={`PDF escolhido: ${escolhido.nome}, ${formatarTamanho(escolhido.tamanho)}. Ele será anexado quando você salvar a música.`}
        >
          <Texto variante="tituloItem">PDF escolhido</Texto>
          <Texto variante="meta" cor="textoSuave">
            {`${escolhido.nome} · ${formatarTamanho(escolhido.tamanho)}`}
          </Texto>
          <Texto variante="corpo" cor="textoSuave">
            Ele será anexado quando você salvar a música.
          </Texto>
        </View>
      ) : (
        <Texto variante="corpo" cor="textoSuave">
          {TEXTO_SEM_PDF}
        </Texto>
      )}

      {mostrarCaixa ? (
        <>
          {avisoJaNaTela ? null : (
            <Aviso tipo="info" titulo="Direitos autorais">
              {AVISO_DE_DIREITOS}
            </Aviso>
          )}
          <CaixaDeMarcar
            rotulo={TEXTO_DA_CONFIRMACAO_DE_DIREITOS}
            marcada={confirmada}
            aoMudar={aoConfirmar}
            erro={erroDaConfirmacao}
          />
        </>
      ) : null}

      {erro ? (
        <Aviso tipo="erro" titulo="Não deu para anexar o PDF" anunciar>
          {erro}
        </Aviso>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Botao
          titulo={temAlgo ? 'Trocar o PDF' : 'Anexar PDF'}
          icone={temAlgo ? 'sincronizar' : 'adicionar'}
          variante="secundario"
          tamanho="medio"
          carregando={ocupado === 'enviando'}
          tituloCarregando="Enviando o PDF..."
          desabilitado={ocupado === 'removendo'}
          motivo="Aguarde: o PDF está sendo removido."
          aoPressionar={anexar}
        />
        {atual && aoAbrir ? (
          <Botao
            titulo="Abrir PDF"
            icone="externo"
            variante="secundario"
            tamanho="medio"
            desabilitado={ocupado !== null}
            aoPressionar={aoAbrir}
          />
        ) : null}
        {temAlgo ? (
          <Botao
            titulo="Remover o PDF"
            variante="destrutivo"
            tamanho="medio"
            carregando={ocupado === 'removendo'}
            tituloCarregando="Removendo..."
            desabilitado={ocupado === 'enviando'}
            aoPressionar={aoRemover}
          />
        ) : null}
      </View>
    </CartaoDeVidro>
  )
}
