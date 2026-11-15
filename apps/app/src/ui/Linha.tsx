import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone, type NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { MolduraDoIcone } from './MolduraDoIcone'
import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDaLinha {
  titulo: string
  descricao?: string
  icone?: NomeDoIcone
  /** Elemento à esquerda no lugar do ícone (ex.: `Avatar`). */
  inicio?: ReactNode
  aoPressionar?: () => void
  /** Conteúdo à direita (selo, botão). Em linha tocável, aparece também a seta. */
  extra?: ReactNode
  rotuloAcessivel?: string
  /** Ação que apaga ou encerra algo: título e ícone na cor de erro (o texto já diz o que faz). */
  destrutivo?: boolean
  /** Linha tocável sem a seta (ação na própria tela, não navegação). */
  semSeta?: boolean
  /** Item escolhido numa lista de navegação (web larga): realce, barra lateral e estado acessível. */
  selecionado?: boolean
  /**
   * Corte da descrição em N linhas. Só para descrição que repete o que já está
   * em outro lugar; o rótulo acessível continua com o texto inteiro.
   */
  linhasDaDescricao?: number
}

const ESTILO: ViewStyle = {
  minHeight: Math.max(ALVO, ALTURA.linha),
  flexDirection: 'row',
  alignItems: 'center',
  gap: ESPACO.x3,
  paddingVertical: ESPACO.x3,
  // A linha "sangra" para os lados: o realce do toque ganha respiro sem desalinhar o texto.
  marginHorizontal: -ESPACO.x3,
  paddingHorizontal: ESPACO.x3,
  borderRadius: RAIO.medio,
}

/** Linha de lista: tocável quando tem `aoPressionar`, com alvo mínimo garantido. */
export function Linha({
  titulo,
  descricao,
  icone,
  inicio,
  aoPressionar,
  extra,
  rotuloAcessivel,
  destrutivo = false,
  semSeta = false,
  selecionado,
  linhasDaDescricao,
}: PropsDaLinha) {
  const { cores } = useTema()
  const corDoTitulo = destrutivo ? 'erro' : selecionado ? 'destaque' : 'texto'
  const conteudo = (
    <>
      {selecionado ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: ESPACO.x3,
            bottom: ESPACO.x3,
            width: 3,
            borderRadius: 2,
            backgroundColor: cores.destaque,
          }}
        />
      ) : null}
      {inicio ??
        (icone ? (
          <MolduraDoIcone
            icone={icone}
            tamanho={ALTURA.molduraDoIcone}
            {...(destrutivo ? { cor: cores.erro } : {})}
          />
        ) : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="corpoForte" cor={corDoTitulo}>
          {titulo}
        </Texto>
        {descricao ? (
          <Texto
            variante="apoio"
            cor="textoSuave"
            {...(linhasDaDescricao ? { numberOfLines: linhasDaDescricao } : {})}
          >
            {descricao}
          </Texto>
        ) : null}
      </View>
      {extra}
      {aoPressionar && !semSeta ? (
        <Icone nome="avancar" cor={cores.textoSuave} tamanho={18} />
      ) : null}
    </>
  )
  if (!aoPressionar) return <View style={ESTILO}>{conteudo}</View>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? (descricao ? `${titulo}. ${descricao}` : titulo)}
      {...(selecionado !== undefined ? { 'aria-selected': selecionado } : {})}
      onPress={aoPressionar}
      style={({ pressed }) => [
        ESTILO,
        {
          backgroundColor: pressed || selecionado ? cores.superficieRealce : 'transparent',
        },
      ]}
    >
      {conteudo}
    </Pressable>
  )
}

interface PropsDaLista {
  children: ReactNode
  /**
   * Recuo do separador à esquerda, para ele começar no texto e não no ícone.
   * Padrão: alinhado ao texto de linhas com ícone.
   */
  recuo?: number
}

/**
 * Grupo de linhas com separadores sutis entre elas (nunca antes da primeira
 * nem depois da última). Com "Aumentar contraste", o separador fica mais forte.
 */
export function Lista({ children, recuo = ALTURA.molduraDoIcone + ESPACO.x3 }: PropsDaLista) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const itens = Children.toArray(children).filter(isValidElement)
  return (
    <View>
      {itens.map((item, i) => (
        <Fragment key={item.key ?? i}>
          {i > 0 ? (
            <View
              style={{
                height: aumentarContraste ? 1 : StyleSheet.hairlineWidth,
                marginLeft: recuo,
                backgroundColor: aumentarContraste ? cores.borda : cores.bordaSuave,
              }}
            />
          ) : null}
          {item}
        </Fragment>
      ))}
    </View>
  )
}
