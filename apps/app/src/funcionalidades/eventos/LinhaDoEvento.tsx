import type { StatusDoEvento } from '@uj/dominio'
import { ESPACO, RAIO } from '@uj/tokens'
import { Pressable, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { Icone } from '@/ui/Icone'
import { ALVO } from '@/ui/medidas'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { falarQuando, formatarDuracao, formatarHora, formatarQuando } from '@/utilidades/datas'

import { COR_DO_STATUS, NOME_DO_STATUS } from './nomes'

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

/** Evento numa lista: título, quando, onde e situação, num só alvo de toque. */
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
        gap: ESPACO.x3,
        padding: ESPACO.x4,
        borderRadius: RAIO.grande - 4,
        borderWidth: selecionado ? 2 : aumentarContraste ? 2 : 1,
        borderColor: selecionado
          ? cores.destaque
          : aumentarContraste
            ? cores.texto
            : cores.cartaoVidroBorda,
        backgroundColor: selecionado || pressed ? cores.superficieRealce : cores.cartaoVidro,
      })}
    >
      <View style={{ flex: 1, gap: ESPACO.x1 }}>
        <Texto variante="corpoForte">{evento.titulo}</Texto>
        <Texto variante="apoio" cor="textoSuave">
          {detalhes.join(' · ')}
        </Texto>
        {evento.status !== 'publicado' ? (
          <Selo texto={NOME_DO_STATUS[evento.status]} cor={COR_DO_STATUS[evento.status]} />
        ) : null}
      </View>
      {evento.serieId ? <Icone nome="repetir" cor={cores.textoSuave} tamanho={18} /> : null}
      <Icone nome="avancar" cor={cores.textoSuave} tamanho={18} />
    </Pressable>
  )
}
