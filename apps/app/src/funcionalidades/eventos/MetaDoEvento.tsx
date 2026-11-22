import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'
import { falarQuando, formatarDuracao, formatarHora } from '@/utilidades/datas'

import { dataCurtaDoEncontro } from '../agenda/semanas'
import { ChipDoStatus } from './LinhaDoEvento'
import { etiquetaDoEncontro } from './regras'

/** "Sáb., 28 de nov. · 16:00 às 17:00": a meta logo abaixo do título (D69, seção 3.4). */
export function metaDoEvento(evento: Pick<DetalheDoEvento, 'inicio' | 'fuso' | 'duracaoMin'>) {
  const fim = new Date(Date.parse(evento.inicio) + evento.duracaoMin * 60_000).toISOString()
  return `${dataCurtaDoEncontro(evento.inicio, evento.fuso)} · ${formatarHora(evento.inicio, evento.fuso)} às ${formatarHora(fim, evento.fuso)}`
}

/**
 * Logo abaixo do título: a data e o horário e a linha de chips (a situação, se não estiver
 * publicado; "Aberto ao público" ou "Só para a comunidade"; "Em 5 dias"; a repetição).
 */
export function MetaDoEvento({ evento }: { evento: DetalheDoEvento }) {
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Texto
        variante="corpo"
        cor="textoSuave"
        tabular
        accessibilityLabel={`${falarQuando(evento.inicio, evento.fuso)}, duração de ${formatarDuracao(evento.duracaoMin)}`}
      >
        {metaDoEvento(evento)}
      </Texto>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <ChipDoStatus status={evento.status} />
        <Chip
          texto={evento.visibilidade === 'publica' ? 'Aberto ao público' : 'Só para a comunidade'}
          tom={evento.visibilidade === 'publica' ? 'info' : 'neutro'}
        />
        {evento.status === 'publicado' ? (
          <Chip texto={etiquetaDoEncontro(evento)} tom="neutro" />
        ) : null}
        {evento.serieId ? <Chip texto="Repetição" tom="neutro" icone="repetir" /> : null}
      </View>
    </View>
  )
}
