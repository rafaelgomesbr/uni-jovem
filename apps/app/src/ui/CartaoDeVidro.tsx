import { ESPACO, RAIO, RITMO } from '@uj/tokens'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Icone } from './Icone'
import { Texto } from './Texto'
import { ProvedorDeSuperficie, sombra, useTema } from './tema'

/** Dentro de um cartão lista: as linhas têm o próprio padding de 18 e não sangram. */
export const ContextoDoCartaoLista = createContext(false)

export function useNoCartaoLista(): boolean {
  return useContext(ContextoDoCartaoLista)
}

export interface PropsDoCartaoDeVidro {
  /** Etiqueta da seção (13/18 600, maiúsculas por estilo, coral), anunciada como cabeçalho. */
  sobrancelha?: string
  /** Título do item logo abaixo da sobrancelha, com 4 de espaço ("SUA ESCALA" e "Louvor · violão"). */
  titulo?: string
  /** À direita da sobrancelha: chip ("Confirmada") ou terciário curto ("Ver todos"). */
  extra?: ReactNode
  children?: ReactNode
  /** Linha de até 2 botões médios, 14 abaixo do conteúdo (use `ParDeBotoes`). */
  acoes?: ReactNode
  /**
   * O cartão é tocável: camada de pressionado e chevron à direita da
   * sobrancelha. As `acoes` continuam botões próprios, fora da área tocável.
   */
  aoPressionar?: () => void
  rotuloAcessivel?: string
  dica?: string
  /** Variante lista: padding vertical de 6 e horizontal de 0; as linhas têm o padding de 18. */
  lista?: boolean
  /**
   * Superfície opaca. Use em cartão com campo de formulário ou linha
   * destrutiva: o texto em `erro` só passa AA sobre o opaco no pico da Aurora.
   */
  opaco?: boolean
  /** Intervalo entre os filhos do conteúdo (12; 16 entre campos de formulário). */
  intervalo?: number
  /** O conteúdo começa com um `tituloItem`: 4 depois da sobrancelha, em vez de 8 (M). */
  comecaComTitulo?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Cartão de tinta (seção 2.12.9; D32, direção A D65): raio 22, padding 18, tinta
 * violeta translúcida (`superficieTranslucida`, sem desfoque) com borda de 1 a 14% e o
 * fio de luz de 6% no topo (`realceDoCartao`). Com
 * "Reduzir transparência" vira superfície opaca; com "Aumentar contraste",
 * opaca com borda de 2 na cor do texto. Sem ícone no cabeçalho: quem
 * identifica o cartão é a sobrancelha. Nada de cartão dentro de cartão.
 */
export function CartaoDeVidro({
  sobrancelha,
  titulo,
  extra,
  children,
  acoes,
  aoPressionar,
  rotuloAcessivel,
  dica,
  lista = false,
  opaco = false,
  intervalo = ESPACO.e12,
  comecaComTitulo = false,
  style,
}: PropsDoCartaoDeVidro) {
  const { cores, elevacao } = useTema()
  const { reduzirTransparencia, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const [pressionado, setPressionado] = useState(false)
  const opacoDeFato = opaco || reduzirTransparencia || aumentarContraste
  const fundo = opacoDeFato ? cores.superficie : cores.superficieTranslucida
  // No claro o realce é transparente (o cartão usa sombra); com Aumentar contraste, nenhum enfeite.
  const comRealce = !aumentarContraste && !cores.realceDoCartao.endsWith(',0)')

  const cabecalho =
    sobrancelha || extra ? (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e8,
          minHeight: 16,
          ...(lista ? { paddingHorizontal: RITMO.recuoDoCartao, paddingTop: ESPACO.e12 } : {}),
        }}
      >
        {sobrancelha ? (
          <Texto variante="sobrancelha" style={{ flex: 1 }}>
            {sobrancelha}
          </Texto>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {extra}
        {aoPressionar ? (
          <Icone nome="avancar" cor={cores.textoSuave} tamanho={14} peso="semibold" />
        ) : null}
      </View>
    ) : null

  const topo = (
    <>
      {cabecalho}
      {titulo ? (
        <Texto
          variante="tituloItem"
          style={{
            marginTop: cabecalho ? ESPACO.e4 : 0,
            ...(lista ? { paddingHorizontal: RITMO.recuoDoCartao } : {}),
          }}
        >
          {titulo}
        </Texto>
      ) : null}
      {children ? (
        <View
          style={{
            gap: lista ? 0 : intervalo,
            marginTop: titulo
              ? 0
              : cabecalho
                ? lista || comecaComTitulo
                  ? ESPACO.e4
                  : ESPACO.e8
                : 0,
          }}
        >
          {children}
        </View>
      ) : null}
    </>
  )

  // Tocável: o corpo é o botão e as ações ficam fora dele, para cada uma
  // continuar alcançável no leitor de tela (botão dentro de botão some).
  const corpoTocavel = aoPressionar ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? [sobrancelha, titulo].filter(Boolean).join('. ')}
      accessibilityHint={dica}
      onPress={aoPressionar}
      onPressIn={() => setPressionado(true)}
      onPressOut={() => setPressionado(false)}
    >
      {topo}
    </Pressable>
  ) : (
    topo
  )

  const corpo = (
    <>
      {corpoTocavel}
      {acoes ? (
        <View
          style={{
            marginTop: children || titulo ? ESPACO.e16 : ESPACO.e8,
            ...(lista ? { paddingHorizontal: RITMO.recuoDoCartao, paddingBottom: ESPACO.e12 } : {}),
          }}
        >
          {acoes}
        </View>
      ) : null}
    </>
  )

  const caixa: ViewStyle = {
    alignSelf: 'stretch',
    borderRadius: RAIO.cartao,
    backgroundColor: fundo,
    borderWidth: aumentarContraste ? 2 : 1,
    borderColor: aumentarContraste ? cores.texto : cores.superficieBorda,
    ...(lista
      ? { paddingVertical: ESPACO.e6, paddingHorizontal: 0, overflow: 'hidden' }
      : { padding: RITMO.recuoDoCartao }),
    ...sombra(elevacao.cartao),
  }

  const conteudo = (
    <View
      style={[
        caixa,
        pressionado ? { boxShadow: `inset 0px 0px 0px 999px ${cores.pressionado}` } : null,
        style,
      ]}
    >
      {comRealce ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: RAIO.cartao - 1,
            // O fio de luz do topo: 6% de branco que some em 42% da altura (direção A).
            backgroundImage: `linear-gradient(180deg, ${cores.realceDoCartao}, rgba(255,255,255,0) 42%)`,
          }}
        />
      ) : null}
      {corpo}
    </View>
  )

  return (
    <ProvedorDeSuperficie superficie={opacoDeFato ? 'opaca' : 'translucida'}>
      <ContextoDoCartaoLista.Provider value={lista}>{conteudo}</ContextoDoCartaoLista.Provider>
    </ProvedorDeSuperficie>
  )
}
