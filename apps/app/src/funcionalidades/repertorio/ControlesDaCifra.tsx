import { Botao, ParDeBotoes } from '@/ui/Botao'

import {
  ROTULO_DESCER_CASA,
  ROTULO_DESCER_TOM,
  ROTULO_LETRA_MAIOR,
  ROTULO_LETRA_MENOR,
  ROTULO_SUBIR_CASA,
  ROTULO_SUBIR_TOM,
} from './rotulosDaCifra'

/**
 * Os pares de botões da cifra (D82), iguais no leitor e no Modo palco: dois botões de MESMA largura
 * e altura (48), ícone e texto juntos, nunca quebrados em duas linhas. O `ParDeBotoes` empilha os
 * dois quando a fonte do sistema está muito grande, em vez de cortar o rótulo. O nome acessível é
 * o próprio texto visível (WCAG 2.5.3).
 */

interface PropsDeUmPar {
  aoDescer: () => void
  aoSubir: () => void
  /** Os dois desligados: a cifra em texto livre não muda de tom. */
  desabilitado?: boolean
  /** Por que estão desligados, para o leitor de tela e para quem não vê o motivo. */
  dica?: string
}

/** "Descer tom" e "Subir tom": cada toque anda meio tom, e o tom escrito ao lado acompanha na hora. */
export function BotoesDoTom({ aoDescer, aoSubir, desabilitado = false, dica }: PropsDeUmPar) {
  return (
    <ParDeBotoes>
      <Botao
        titulo={ROTULO_DESCER_TOM}
        icone="descer"
        variante="secundario"
        tamanho="medio"
        desabilitado={desabilitado}
        {...(dica ? { dica } : {})}
        aoPressionar={aoDescer}
      />
      <Botao
        titulo={ROTULO_SUBIR_TOM}
        icone="subir"
        variante="secundario"
        tamanho="medio"
        desabilitado={desabilitado}
        {...(dica ? { dica } : {})}
        aoPressionar={aoSubir}
      />
    </ParDeBotoes>
  )
}

interface PropsDaCasa extends Omit<PropsDeUmPar, 'dica'> {
  /** Já está na casa 0 (sem capotraste): "Descer casa" não tem para onde ir. */
  noMinimo: boolean
  /** Já está na última casa. */
  noMaximo: boolean
}

/** "Descer casa" e "Subir casa": a casa do capotraste, de 0 (sem) a 11. */
export function BotoesDaCasa({
  aoDescer,
  aoSubir,
  noMinimo,
  noMaximo,
  desabilitado = false,
}: PropsDaCasa) {
  return (
    <ParDeBotoes>
      <Botao
        titulo={ROTULO_DESCER_CASA}
        icone="descer"
        variante="secundario"
        tamanho="medio"
        desabilitado={desabilitado || noMinimo}
        aoPressionar={aoDescer}
      />
      <Botao
        titulo={ROTULO_SUBIR_CASA}
        icone="subir"
        variante="secundario"
        tamanho="medio"
        desabilitado={desabilitado || noMaximo}
        aoPressionar={aoSubir}
      />
    </ParDeBotoes>
  )
}

interface PropsDaLetra {
  aoMenor: () => void
  aoMaior: () => void
  noMinimo: boolean
  noMaximo: boolean
  desabilitado?: boolean
}

/** "Letra menor" e "Letra maior": o tamanho da letra, sem número solto na tela. */
export function BotoesDaLetra({
  aoMenor,
  aoMaior,
  noMinimo,
  noMaximo,
  desabilitado = false,
}: PropsDaLetra) {
  return (
    <ParDeBotoes>
      <Botao
        titulo={ROTULO_LETRA_MENOR}
        variante="secundario"
        tamanho="medio"
        desabilitado={desabilitado || noMinimo}
        aoPressionar={aoMenor}
      />
      <Botao
        titulo={ROTULO_LETRA_MAIOR}
        variante="secundario"
        tamanho="medio"
        desabilitado={desabilitado || noMaximo}
        aoPressionar={aoMaior}
      />
    </ParDeBotoes>
  )
}
