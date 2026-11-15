import { ESPACO, RAIO, RITMO } from '@uj/tokens'
import { router } from 'expo-router'
import { createContext, useContext, type ReactNode, type Ref } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LARGURA_MAXIMA_DO_CONTEUDO, LARGURA_MAXIMA_LARGA } from '@/constantes'

import type { NoDeTexto } from './foco'
import { FundoAurora } from './FundoAurora'
import { Icone } from './Icone'
import { ALVO, useMargemDaTela } from './medidas'
import { Texto } from './Texto'
import { useTema } from './tema'
import { soNaWeb } from './web'

/**
 * Altura que a barra de abas flutuante ocupa no fim da tela (0 fora das abas).
 * A barra fica por cima do conteúdo; a tela reserva esse espaço no fim da rolagem.
 */
export const ContextoDaBarraDeAbas = createContext(0)

interface PropsDaTela {
  children: ReactNode
  /** Título da tela em Bricolage 34 (anunciado como cabeçalho de nível 1). */
  titulo?: string
  descricao?: string
  /**
   * Faixa fixa ACIMA da rolagem; ela mesma cuida da área segura de cima
   * (ex.: `CabecalhoProprio` das telas de comunidade).
   */
  cabecalho?: ReactNode
  /** Faixa do topo DENTRO da rolagem, sobre a aurora (pílula da comunidade e sincronização). */
  topo?: ReactNode
  rolar?: boolean
  /**
   * Tela interna (aberta por cima das abas): mostra o botão Voltar em pílula de
   * vidro no topo. Nenhuma tela usa o cabeçalho nativo do sistema.
   */
  cabecalhoNativo?: boolean
  /** Usa a largura de tela larga (lista e detalhe lado a lado na web). */
  larga?: boolean
  /** Para levar o foco ao título quando o conteúdo da tela troca (ver `useFocoAoMudar`). */
  refDoTitulo?: Ref<NoDeTexto>
  /** Elemento à direita do título (ex.: avatar, botão de ação). */
  acaoDoTitulo?: ReactNode
}

/** Botão Voltar das telas internas: pílula de vidro com seta e rótulo. */
export function BotaoVoltar() {
  const { cores } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        minHeight: ALVO,
        minWidth: ALVO,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.x1,
        paddingLeft: ESPACO.x2,
        paddingRight: ESPACO.x4,
        borderRadius: RAIO.pilula,
        borderWidth: 1,
        borderColor: cores.cartaoVidroBorda,
        backgroundColor: pressed ? cores.superficieRealce : cores.cartaoVidro,
      })}
    >
      <Icone nome="voltar" cor={cores.texto} tamanho={20} />
      <Texto variante="corpoForte" style={{ fontSize: 15 }}>
        Voltar
      </Texto>
    </Pressable>
  )
}

/**
 * Esqueleto de toda tela: fundo Aurora, área segura, rolagem, teclado que não
 * cobre o campo, largura máxima de leitura na web e o espaço da barra de abas.
 */
export function Tela({
  children,
  titulo,
  descricao,
  cabecalho,
  topo,
  rolar = true,
  cabecalhoNativo = false,
  larga = false,
  refDoTitulo,
  acaoDoTitulo,
}: PropsDaTela) {
  const { cores } = useTema()
  const margens = useSafeAreaInsets()
  const margemLateral = useMargemDaTela()
  const espacoDaBarra = useContext(ContextoDaBarraDeAbas)

  const conteudo = (
    <View
      style={{
        width: '100%',
        maxWidth: larga ? LARGURA_MAXIMA_LARGA : LARGURA_MAXIMA_DO_CONTEUDO,
        alignSelf: 'center',
        gap: RITMO.entreSecoes,
        // Sem rolagem da tela, o conteúdo ocupa a altura (cada painel rola sozinho).
        ...(rolar ? {} : { flex: 1 }),
      }}
    >
      {topo}
      {cabecalhoNativo ? <BotaoVoltar /> : null}
      {titulo ? (
        <View style={{ gap: RITMO.depoisDoTitulo, marginTop: ESPACO.x1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.x3 }}>
            <Texto
              variante="tituloGrande"
              ref={refDoTitulo}
              style={{ flex: 1 }}
              {...soNaWeb({ tabIndex: -1 })}
            >
              {titulo}
            </Texto>
            {acaoDoTitulo}
          </View>
          {descricao ? <Texto cor="textoSuave">{descricao}</Texto> : null}
        </View>
      ) : null}
      {children}
    </View>
  )

  const preenchimento = {
    paddingHorizontal: margemLateral,
    paddingTop: (cabecalho ? 0 : margens.top) + RITMO.topoDaTela,
    paddingBottom: margens.bottom + espacoDaBarra + ESPACO.x8,
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      {cabecalho}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {rolar ? (
          <ScrollView
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ flexGrow: 1 }, preenchimento]}
          >
            <FundoAurora />
            {conteudo}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, preenchimento]}>
            <FundoAurora />
            {conteudo}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  )
}
