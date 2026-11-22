import { ESPACO, RAIO } from '@uj/tokens'
import { Fragment } from 'react'
import { Pressable, View } from 'react-native'

import { ALFA_DESABILITADO, comOpacidade } from './cor'
import { CartaoDeVidro } from './CartaoDeVidro'
import { useSetasDoGrupo } from './setasDoGrupo'
import { Texto } from './Texto'
import { useTema } from './tema'

export interface Opcao<T extends string> {
  valor: T
  rotulo: string
  descricao?: string
  /** Desabilitada: texto a 40% e o motivo na descrição. */
  desabilitada?: boolean
}

export interface PropsDaListaDeOpcoes<T extends string> {
  /** Rótulo do grupo: sobrancelha acima do cartão (ou rótulo de campo dentro de um cartão). */
  rotulo: string
  opcoes: readonly Opcao<T>[]
  valor: T | null
  aoMudar: (valor: T) => void
}

/**
 * Lista de opções, escolha única (seção 2.12.6, D64): linhas de 56 (64 com
 * descrição) dentro de um cartão opaco, rádio de 24 à esquerda, separador
 * recuado 54, a linha marcada com fundo quente e nenhum check repetido à direita. Dentro de um cartão que já
 * existe, as linhas entram nele (nada de cartão dentro de cartão).
 */
export function ListaDeOpcoes<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: PropsDaListaDeOpcoes<T>) {
  const { superficie } = useTema()
  const propsDaOpcao = useSetasDoGrupo(opcoes, valor, aoMudar)
  const dentroDeCartao = superficie !== 'fundo'

  const linhas = (
    <View accessibilityRole="radiogroup" aria-label={rotulo}>
      {opcoes.map((opcao, i) => (
        <Fragment key={opcao.valor}>
          {i > 0 ? <Separador recuo={dentroDeCartao ? 36 : 54} /> : null}
          <LinhaDeOpcao
            opcao={opcao}
            marcada={opcao.valor === valor}
            sangrar={dentroDeCartao}
            aoEscolher={() => aoMudar(opcao.valor)}
            extra={propsDaOpcao(opcao.valor)}
          />
        </Fragment>
      ))}
    </View>
  )

  if (dentroDeCartao) {
    return (
      <View style={{ gap: ESPACO.e8 }}>
        <Texto variante="rotulo" cor="textoSuave">
          {rotulo}
        </Texto>
        {linhas}
      </View>
    )
  }
  return (
    <View style={{ gap: ESPACO.e8 }}>
      <Texto variante="sobrancelha">{rotulo}</Texto>
      <CartaoDeVidro lista opaco>
        {linhas}
      </CartaoDeVidro>
    </View>
  )
}

function Separador({ recuo }: { recuo: number }) {
  const { cores } = useTema()
  return <View style={{ height: 1, marginLeft: recuo, backgroundColor: cores.separador }} />
}

function LinhaDeOpcao<T extends string>({
  opcao,
  marcada,
  sangrar,
  aoEscolher,
  extra,
}: {
  opcao: Opcao<T>
  marcada: boolean
  sangrar: boolean
  aoEscolher: () => void
  extra: object
}) {
  const { cores, solido } = useTema()
  const corDoTexto = opcao.desabilitada ? comOpacidade(cores.texto, ALFA_DESABILITADO) : cores.texto
  return (
    <Pressable
      {...extra}
      accessibilityRole="radio"
      accessibilityLabel={opcao.rotulo}
      accessibilityHint={opcao.descricao}
      aria-checked={marcada}
      aria-disabled={!!opcao.desabilitada}
      disabled={opcao.desabilitada}
      onPress={aoEscolher}
      style={({ pressed }) => ({
        minHeight: opcao.descricao ? 64 : 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        paddingHorizontal: ESPACO.e18,
        paddingVertical: ESPACO.e10,
        ...(sangrar ? { marginHorizontal: -ESPACO.e18 } : {}),
        backgroundColor: pressed ? cores.pressionado : 'transparent',
      })}
    >
      {marcada ? (
        // A linha marcada ganha uma faixa quente (a 50%), recuada 8 dos lados e com cantos
        // redondos: a escolha se vê de longe, além do miolo do rádio.
        <View
          pointerEvents="none"
          testID="faixa-da-opcao-marcada"
          style={{
            position: 'absolute',
            top: ESPACO.e4,
            bottom: ESPACO.e4,
            left: ESPACO.e8,
            right: ESPACO.e8,
            borderRadius: RAIO.controle,
            backgroundColor: solido(comOpacidade(cores.quenteFundo, 0.5)),
          }}
        />
      ) : null}
      <Radio marcado={marcada} desabilitado={!!opcao.desabilitada} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="tituloItem" style={{ color: corDoTexto }}>
          {opcao.rotulo}
        </Texto>
        {opcao.descricao ? (
          <Texto variante="legenda" cor="textoSuave">
            {opcao.descricao}
          </Texto>
        ) : null}
      </View>
    </Pressable>
  )
}

/** Rádio de 24 (D64): anel de 2 (`campoBorda`); marcado, anel e miolo de 12 em `primaria`. */
export function Radio({ marcado, desabilitado }: { marcado: boolean; desabilitado?: boolean }) {
  const { cores, semFundo } = useTema()
  const cor = desabilitado ? cores.tonalBorda : marcado ? cores.primaria : cores.campoBorda
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: cor,
        backgroundColor: semFundo,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {marcado ? (
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: cor }} />
      ) : null}
    </View>
  )
}
