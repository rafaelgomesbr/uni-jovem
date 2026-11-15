import { ESPACO } from '@uj/tokens'
import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LARGURA_MAXIMA_DO_CONTEUDO, LARGURA_MAXIMA_LARGA } from '@/constantes'

import { Texto } from './Texto'
import { useTema } from './tema'

interface PropsDaTela {
  children: ReactNode
  /** Título principal da tela (anunciado como cabeçalho). */
  titulo?: string
  descricao?: string
  /** Faixa flutuante no topo (ex.: comunidade ativa). Ela cuida da área segura de cima. */
  cabecalho?: ReactNode
  rolar?: boolean
  /** A tela está sob o cabeçalho da pilha de navegação (que já cuida da área segura de cima). */
  cabecalhoNativo?: boolean
  /** Usa a largura de tela larga (lista e detalhe lado a lado na web). */
  larga?: boolean
}

/**
 * Esqueleto de toda tela: fundo do tema, área segura, rolagem, teclado que
 * não cobre o campo e largura máxima de leitura na web.
 */
export function Tela({
  children,
  titulo,
  descricao,
  cabecalho,
  rolar = true,
  cabecalhoNativo = false,
  larga = false,
}: PropsDaTela) {
  const { cores } = useTema()
  const margens = useSafeAreaInsets()
  // No iOS a rolagem ajusta sozinha a área segura e a barra de abas
  // (`contentInsetAdjustmentBehavior`); no Android e na web, à mão.
  const ajusteManual = Platform.OS !== 'ios'
  const topo = cabecalho || cabecalhoNativo || !ajusteManual ? 0 : margens.top

  const conteudo = (
    <View
      style={{
        width: '100%',
        maxWidth: larga ? LARGURA_MAXIMA_LARGA : LARGURA_MAXIMA_DO_CONTEUDO,
        alignSelf: 'center',
        gap: ESPACO.x4,
        // Sem rolagem da tela, o conteúdo ocupa a altura (cada painel rola sozinho).
        ...(rolar ? {} : { flex: 1 }),
      }}
    >
      {titulo ? (
        <View style={{ gap: ESPACO.x1 }}>
          <Texto variante="titulo">{titulo}</Texto>
          {descricao ? <Texto cor="textoSuave">{descricao}</Texto> : null}
        </View>
      ) : null}
      {children}
    </View>
  )

  const preenchimento = {
    paddingHorizontal: ESPACO.x4,
    paddingTop: topo + ESPACO.x4,
    paddingBottom: (ajusteManual ? margens.bottom : 0) + ESPACO.x8,
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
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={preenchimento}
          >
            {conteudo}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, preenchimento]}>{conteudo}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  )
}
