import { ESPACO, RAIO } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { escurecer } from './cor'
import { Texto } from './Texto'
import { ProvedorDeTemaInverso, sombra, useTema } from './tema'

export interface PropsDoCartaoDeDestaque {
  /** Etiqueta acima do título ("PRIMEIROS PASSOS"). */
  sobrancelha?: string
  /** Linha de meta: "Sábado · 16:00 · 60 min" (13/18 600, suave). */
  meta?: string
  /** À direita da meta, alinhado pela linha de base: chip ("Na igreja"). */
  chip?: ReactNode
  /** Título em Bricolage 24/28. */
  titulo?: string
  /** Texto abaixo do título (8 de espaço). */
  descricao?: string
  children?: ReactNode
  /** Ações com a paleta inversa, 14 acima. */
  acoes?: ReactNode
  /** O cartão inteiro abre o detalhe. Pressionado escurece 4%. */
  aoPressionar?: () => void
  rotuloAcessivel?: string
  dica?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Cartão de destaque (seção 2.12.10): "a coisa mais importante agora" (no
 * máximo 1 por tela). Claro `#F5F3FF` no tema escuro e índigo `#1F1B4D` no
 * claro, sem borda; todos os filhos leem a paleta inversa.
 */
export function CartaoDeDestaque(props: PropsDoCartaoDeDestaque) {
  return (
    <ProvedorDeTemaInverso>
      <Caixa {...props} />
    </ProvedorDeTemaInverso>
  )
}

function Caixa({
  sobrancelha,
  meta,
  chip,
  titulo,
  descricao,
  children,
  acoes,
  aoPressionar,
  rotuloAcessivel,
  dica,
  style,
}: PropsDoCartaoDeDestaque) {
  const { cores, elevacao } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const [pressionado, setPressionado] = useState(false)
  const caixa: ViewStyle = {
    alignSelf: 'stretch',
    padding: ESPACO.e18,
    borderRadius: RAIO.cartao,
    backgroundColor: cores.fundo,
    borderWidth: aumentarContraste ? 2 : 0,
    borderColor: aumentarContraste ? cores.texto : 'transparent',
    ...sombra(elevacao.destaque),
  }
  const topo = (
    <>
      {sobrancelha ? <Texto variante="sobrancelha">{sobrancelha}</Texto> : null}
      {meta || chip ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: ESPACO.e8,
            marginTop: sobrancelha ? ESPACO.e6 : 0,
          }}
        >
          {meta ? (
            <Texto variante="rotulo" cor="textoSuave" tabular style={{ flexShrink: 1 }}>
              {meta}
            </Texto>
          ) : (
            <View />
          )}
          {chip}
        </View>
      ) : null}
      {titulo ? (
        <Texto
          variante="tituloCartao"
          style={{ marginTop: meta || chip ? ESPACO.e6 : sobrancelha ? ESPACO.e8 : 0 }}
        >
          {titulo}
        </Texto>
      ) : null}
      {descricao ? (
        <Texto variante="corpo" cor="textoSuave" style={{ marginTop: titulo ? ESPACO.e8 : 0 }}>
          {descricao}
        </Texto>
      ) : null}
      {children ? (
        <View style={{ marginTop: titulo || descricao || meta ? ESPACO.e14 : 0 }}>{children}</View>
      ) : null}
    </>
  )
  // Tocável: o corpo abre o detalhe e as ações ficam fora dele (botão dentro de botão some do leitor de tela).
  return (
    <View
      style={[caixa, pressionado ? { backgroundColor: escurecer(cores.fundo, 0.04) } : null, style]}
    >
      {aoPressionar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rotuloAcessivel ?? [meta, titulo].filter(Boolean).join('. ')}
          accessibilityHint={dica}
          onPress={aoPressionar}
          onPressIn={() => setPressionado(true)}
          onPressOut={() => setPressionado(false)}
        >
          {topo}
        </Pressable>
      ) : (
        topo
      )}
      {acoes ? <View style={{ marginTop: ESPACO.e14 }}>{acoes}</View> : null}
    </View>
  )
}

export interface PropsDaLinhaDeHorario {
  /** "16:05" ou "+4". */
  hora: string
  titulo: string
  /** Marcador à direita, em 600 `destaque` ("Você"). */
  marcador?: string
  /** "+4 etapas": a linha toda em `textoSuave`. */
  suave?: boolean
  /** Etapa atual do ao vivo: título em 600 com um ponto `destaque`. */
  atual?: boolean
}

/**
 * Linha compacta da programação (M): hora em coluna de 44 (cresce com a
 * fonte) em 600 `tabular-nums`, 12 até o título, texto 14/20. Use dentro de
 * `ListaDeHorarios` (intervalo de 8).
 */
export function LinhaDeHorario({ hora, titulo, marcador, suave, atual }: PropsDaLinhaDeHorario) {
  const { cores } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: ESPACO.e12 }}>
      <Texto
        variante="lista"
        peso="forte"
        tabular
        cor={suave ? 'textoSuave' : 'texto'}
        style={{ minWidth: 44 }}
      >
        {hora}
      </Texto>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: ESPACO.e6 }}>
        {atual ? (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cores.destaque }} />
        ) : null}
        <Texto
          variante="lista"
          peso={atual ? 'forte' : 'regular'}
          cor={suave ? 'textoSuave' : 'texto'}
          style={{ flex: 1 }}
        >
          {titulo}
        </Texto>
      </View>
      {marcador ? (
        <Texto variante="lista" peso="forte" cor="destaque">
          {marcador}
        </Texto>
      ) : null}
    </View>
  )
}

export function ListaDeHorarios({ children }: { children: ReactNode }) {
  return <View style={{ gap: ESPACO.e8 }}>{children}</View>
}
