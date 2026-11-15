import { ESPACO, RAIO } from '@uj/tokens'
import { router } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import type { EventoDoInicio } from '@/servicos/contratoDosEventos'
import { formatarDuracao, formatarHora } from '@/utilidades/datas'
import { CartaoDestaque } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'

import { useEvento } from '../eventos/consultas'
import { rotuloFaladoDoEvento } from '../eventos/LinhaDoEvento'

/** Quantas etapas o cartão mostra antes do "+N etapas" (mockup: três). */
const ETAPAS_NO_CARTAO = 3

function diaDaSemana(iso: string, fuso: string): string {
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: fuso }).format(
    new Date(iso),
  )
  return nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1)
}

interface Props {
  evento: EventoDoInicio
  comunidadeId: string
  fuso: string
  /** Títulos das etapas em que a pessoa está escalada neste evento (marca "Você"). */
  minhasEtapas: readonly string[]
}

/**
 * Próximo evento no Início, como no mockup: cartão de destaque (claro no tema
 * escuro), "Sábado · 16:00 · 60 min", chip do local, título em Bricolage e as
 * primeiras etapas com a hora numa coluna e "Você" onde a pessoa está
 * escalada. O cartão inteiro abre a programação.
 */
export function CartaoDoProximoEvento({ evento, comunidadeId, fuso, minhasEtapas }: Props) {
  const detalhe = useEvento(comunidadeId, evento.id)
  const etapas = detalhe.data?.etapas ?? []
  const visiveis = etapas.slice(0, ETAPAS_NO_CARTAO)
  const resto = Math.max(0, etapas.length - visiveis.length)
  const quando = [
    diaDaSemana(evento.inicio, fuso),
    formatarHora(evento.inicio, fuso),
    formatarDuracao(evento.duracaoMin),
  ].join(' · ')

  return (
    <CartaoDestaque style={{ padding: 0 }}>
      <ConteudoPressionavel
        rotulo={rotuloFaladoDoEvento(evento, fuso)}
        aoPressionar={() =>
          router.push({ pathname: '/evento/[eventoId]', params: { eventoId: evento.id } })
        }
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: ESPACO.x2,
          }}
        >
          <Texto variante="corpoForte" cor="textoSuave" tabular style={{ fontSize: 13 }}>
            {quando}
          </Texto>
          {evento.localNome ? <Chip texto={evento.localNome} /> : null}
        </View>
        <Texto
          variante="titulo"
          accessibilityRole="header"
          nivel={2}
          style={{ fontSize: 24, lineHeight: 28, marginTop: 6, marginBottom: ESPACO.x1 }}
        >
          {evento.titulo}
        </Texto>
        {visiveis.length ? (
          <View style={{ gap: ESPACO.x2 }}>
            {visiveis.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', gap: ESPACO.x3 }}>
                <Texto variante="corpoForte" tabular style={{ minWidth: 44, fontSize: 14 }}>
                  {formatarHora(e.inicioPrevisto, fuso)}
                </Texto>
                <Texto variante="apoio" style={{ flex: 1 }}>
                  {e.titulo}
                </Texto>
                {minhasEtapas.includes(e.titulo) ? (
                  <Texto variante="corpoForte" cor="destaque" style={{ fontSize: 14 }}>
                    Você
                  </Texto>
                ) : null}
              </View>
            ))}
            {resto > 0 ? (
              <View style={{ flexDirection: 'row', gap: ESPACO.x3 }}>
                <Texto
                  variante="corpoForte"
                  cor="textoSuave"
                  tabular
                  style={{ minWidth: 44, fontSize: 14 }}
                >
                  +{resto}
                </Texto>
                <Texto variante="apoio" cor="textoSuave">
                  {resto === 1 ? 'etapa' : 'etapas'}
                </Texto>
              </View>
            ) : null}
          </View>
        ) : null}
      </ConteudoPressionavel>
    </CartaoDestaque>
  )
}

function ConteudoPressionavel({
  rotulo,
  aoPressionar,
  children,
}: {
  rotulo: string
  aoPressionar: () => void
  children: ReactNode
}) {
  const { cores } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint="Abre a programação."
      onPress={aoPressionar}
      style={({ pressed }) => ({
        padding: 18,
        gap: ESPACO.x1,
        borderRadius: RAIO.grande,
        backgroundColor: pressed ? cores.superficieRealce : 'transparent',
      })}
    >
      {children}
    </Pressable>
  )
}
