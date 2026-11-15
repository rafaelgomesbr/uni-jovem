import type { StatusDoEvento } from '@uj/dominio'
import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Chip } from '@/ui/Chip'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista } from '@/ui/LinhaDeLista'
import { ALVO } from '@/ui/medidas'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import {
  dataDoInstante,
  DIAS_CURTOS,
  diaDaSemana,
  falarQuando,
  formatarDuracao,
  formatarHora,
  formatarQuando,
} from '@/utilidades/datas'

import { NOME_DO_STATUS, TOM_DO_STATUS } from './nomes'

export interface EventoDaLinha {
  id: string
  titulo: string
  inicio: string
  duracaoMin: number
  status: StatusDoEvento
  categoria?: string
  localNome?: string | null
  serieId?: string | null
}

interface PropsDaLinha {
  evento: EventoDaLinha
  fuso: string
  aoPressionar: () => void
  /** No layout lado a lado, marca o evento aberto à direita. */
  selecionado?: boolean
  /** Esconde a data (quando a lista já está agrupada por dia). */
  soHora?: boolean
}

/** O que o leitor de tela diz de um evento (lista, cartão de destaque do Início). */
export function rotuloFaladoDoEvento(evento: EventoDaLinha, fuso: string): string {
  return [
    evento.titulo,
    NOME_DO_STATUS[evento.status],
    falarQuando(evento.inicio, fuso),
    `duração de ${formatarDuracao(evento.duracaoMin)}`,
    evento.localNome ? `local: ${evento.localNome}` : null,
    evento.serieId ? 'faz parte de uma série' : null,
  ]
    .filter(Boolean)
    .join(', ')
}

/** Situação em chip, só quando não está publicado (2.12.12). */
export function ChipDoStatus({ status }: { status: StatusDoEvento }) {
  const tom = TOM_DO_STATUS[status]
  return tom ? <Chip texto={NOME_DO_STATUS[status]} tom={tom} /> : null
}

/** À direita da linha: o chip da situação e o ícone de repetir (série). */
function ExtraDoEvento({ status, serie }: { status: StatusDoEvento; serie: boolean }) {
  const { cores } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e8 }}>
      <ChipDoStatus status={status} />
      {serie ? <Icone nome="repetir" cor={cores.textoSuave} tamanho={14} /> : null}
    </View>
  )
}

/**
 * Evento numa linha de cartão lista (3.4.1 e quadro 01c): bloco de data (dia
 * e dia da semana), título, "16:00 · 60 min · Salão", chip quando não está
 * publicado, ícone de repetir quando é de série e o chevron. Devolve a
 * própria `LinhaDeLista` (com a chave), para a `Lista` recuar o separador.
 */
export function linhaDoEventoNaLista({
  evento,
  fuso,
  aoPressionar,
  selecionado,
}: Omit<PropsDaLinha, 'soHora'>) {
  const dia = dataDoInstante(evento.inicio, fuso)
  const descricao = [
    formatarHora(evento.inicio, fuso),
    formatarDuracao(evento.duracaoMin),
    evento.localNome ?? null,
  ]
    .filter(Boolean)
    .join(' · ')
  const falado = [rotuloFaladoDoEvento(evento, fuso), selecionado ? 'aberto ao lado' : null]
    .filter(Boolean)
    .join(', ')
  const temChip = TOM_DO_STATUS[evento.status] !== null
  return (
    <LinhaDeLista
      key={evento.id}
      data={{ dia: String(Number(dia.slice(8, 10))), mes: DIAS_CURTOS[diaDaSemana(dia)] ?? '' }}
      titulo={evento.titulo}
      descricao={descricao}
      rotuloAcessivel={falado}
      {...(selecionado !== undefined ? { selecionado } : {})}
      {...(temChip || evento.serieId
        ? { extra: <ExtraDoEvento status={evento.status} serie={!!evento.serieId} /> }
        : {})}
      aoPressionar={aoPressionar}
    />
  )
}

/**
 * Evento solto, fora de cartão lista (Agenda). As listas novas usam
 * `LinhaDoEventoNaLista` dentro de um `CartaoDeVidro lista`.
 */
export function LinhaDoEvento({ evento, fuso, aoPressionar, selecionado, soHora }: PropsDaLinha) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const quando = soHora ? formatarHora(evento.inicio, fuso) : formatarQuando(evento.inicio, fuso)
  const detalhes = [
    quando,
    formatarDuracao(evento.duracaoMin),
    evento.localNome ?? null,
    evento.serieId ? 'Repete' : null,
  ].filter(Boolean)
  const falado = [rotuloFaladoDoEvento(evento, fuso), selecionado ? 'aberto ao lado' : null]
    .filter(Boolean)
    .join(', ')

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={falado}
      aria-selected={!!selecionado}
      onPress={aoPressionar}
      style={({ pressed }) => ({
        minHeight: ALVO,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        padding: ESPACO.e16,
        borderRadius: RAIO.cartao,
        borderWidth: selecionado || aumentarContraste ? 2 : 1,
        borderColor: selecionado
          ? cores.destaque
          : aumentarContraste
            ? cores.texto
            : cores.superficieBorda,
        backgroundColor: selecionado || pressed ? cores.pressionado : cores.superficieTranslucida,
      })}
    >
      <View style={{ flex: 1, gap: ESPACO.e4 }}>
        <Texto variante="tituloItem">{evento.titulo}</Texto>
        <Texto variante="meta" cor="textoSuave">
          {detalhes.join(' · ')}
        </Texto>
        <ChipDoStatus status={evento.status} />
      </View>
      {evento.serieId ? <Icone nome="repetir" cor={cores.textoSuave} tamanho={18} /> : null}
      <Icone nome="avancar" cor={cores.textoSuave} tamanho={14} peso="semibold" />
    </Pressable>
  )
}
