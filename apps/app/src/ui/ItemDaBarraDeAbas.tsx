import { ALTURA, BARRA_DE_ABAS, CURVAS, ESPACO, MOVIMENTO_DAS_TELAS, RAIO, TIPO } from '@uj/tokens'
import { useEffect } from 'react'
import { Platform, Pressable, View, type GestureResponderEvent } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'

import { Avatar, type DadosDoAvatar } from './Avatar'
import { IconeDeTraco, type NomeDoTraco } from './IconeDeTraco'
import { ALVO } from './medidas'
import { larguraEstimada } from './Segmentos'
import { Texto } from './Texto'
import { useTema } from './tema'
import { soNaWeb } from './web'

/** Até aqui (o teto antigo do rótulo), os rótulos cabem em qualquer tela de 360 ou mais. */
const ESCALA_QUE_SEMPRE_CABE = 1.3

/**
 * Os rótulos cabem nos itens com esta fonte? Até 1,3, sempre (a barra foi
 * medida em 360). Acima, a estimativa do rótulo mais longo (por excesso)
 * contra a largura de um item; o rótulo cresce até o teto de 1,6. Não cabe:
 * todos os itens ficam só com o ícone, nunca um rótulo cortado.
 */
export function rotulosCabemNaBarra(
  rotulos: readonly string[],
  itens: number,
  larguraDaTela: number,
  fontScale: number,
): boolean {
  if (fontScale <= ESCALA_QUE_SEMPRE_CABE) return true
  const escala = Math.min(fontScale, TIPO.aba.teto ?? fontScale)
  const util =
    larguraDaTela - 2 * BARRA_DE_ABAS.margemLateral - 2 * (BARRA_DE_ABAS.preenchimento + 1)
  const maior = Math.max(...rotulos.map((r) => larguraEstimada(r, TIPO.aba.tamanho * escala)))
  // O item tem 2 de cada lado (o `paddingHorizontal` dele).
  return maior + 2 * ESPACO.e2 <= util / itens
}

export interface PropsDoItemDaBarra {
  rotulo: string
  /** Ícone de traço do mockup; sem ele, o avatar da pessoa (aba Perfil). */
  icone: NomeDoTraco | null
  avatar?: { nome: string; dados?: DadosDoAvatar | null } | null
  ativo: boolean
  /** O que o leitor de tela ouve ("Perfil de Ana Lima"). */
  nomeAcessivel?: string
  /**
   * Com fonte grande, quando o rótulo não cabe no item: só o ícone. O rótulo
   * continua no leitor de tela e no visualizador de conteúdo grande do iOS
   * (tocar e segurar).
   */
  semRotulo?: boolean
  onPress?: ((e: GestureResponderEvent) => void) | undefined
  onLongPress?: ((e: GestureResponderEvent) => void) | undefined
}

/**
 * Item da barra de abas (2.12.17, M): mínimo de 58×48, raio 20, ícone de 22
 * numa vaga de 24, 2 e o rótulo 11/14. O ativo ganha a pílula coral, o
 * rótulo em 600 e o traço em 2,4 (no Perfil, o anel do avatar): peso e forma
 * além da cor. Celular: papel `tab` com estado selecionado; web: link com
 * `aria-current="page"`.
 *
 * Perfil: só o avatar, maior (32, o da pílula) e centrado na altura dos
 * outros itens, sem a legenda embaixo. O leitor de tela continua ouvindo
 * "Perfil de {nome}" e o estado selecionado; o anel muda de forma no ativo.
 *
 * O rótulo cresce com a fonte do sistema até 1,6. Se não couber, a barra
 * passa `semRotulo`: o item fica só com o ícone, nunca com o texto cortado.
 */
export function ItemDaBarraDeAbas({
  rotulo,
  icone,
  avatar,
  ativo,
  nomeAcessivel,
  semRotulo = false,
  onPress,
  onLongPress,
}: PropsDoItemDaBarra) {
  const { cores } = useTema()
  const cor = ativo ? cores.destaque : cores.textoSuave
  const web = Platform.OS === 'web'
  return (
    <Pressable
      accessibilityRole={web ? 'link' : 'tab'}
      accessibilityLabel={nomeAcessivel ?? rotulo}
      {...(web
        ? soNaWeb({ 'aria-current': ativo ? 'page' : undefined })
        : { 'aria-selected': ativo })}
      // Rótulo com teto de 1,6, ou só o ícone: o iOS mostra o visualizador de conteúdo grande.
      accessibilityShowsLargeContentViewer
      accessibilityLargeContentTitle={rotulo}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        // Itens de largura igual: a pílula luminosa da barra desliza de um para o outro.
        flex: 1,
        minWidth: 0,
        minHeight: Math.max(ALVO, ALTURA.aba),
        paddingHorizontal: ESPACO.e2,
        alignItems: 'center',
        justifyContent: 'center',
        gap: ESPACO.e2,
        borderRadius: RAIO.barra,
        // A pílula do ativo é da barra (`PilulaDaAba`); aqui só a camada do toque.
        backgroundColor: pressed ? cores.botaoTonal : 'transparent',
      })}
    >
      {!icone && avatar ? (
        <Avatar
          nome={avatar.nome}
          avatar={avatar.dados ?? null}
          proprio
          tamanho="pilula"
          anel={ativo ? 'ativo' : 'inativo'}
          decorativo
        />
      ) : (
        <>
          <ItemComIcone icone={icone} cor={cor} ativo={ativo} />
          {semRotulo ? null : (
            <Texto
              variante="aba"
              peso={ativo ? 'forte' : 'medio'}
              numberOfLines={1}
              style={{ color: cor }}
            >
              {rotulo}
            </Texto>
          )}
        </>
      )}
    </Pressable>
  )
}

/** A vaga de 24 com o ícone de traço (o da pessoa enquanto a conta não chega). */
function ItemComIcone({
  icone,
  cor,
  ativo,
}: {
  icone: NomeDoTraco | null
  cor: string
  ativo: boolean
}) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const progresso = useSharedValue(ativo ? 1 : 0)
  // O ícone ativo sobe 1 pt e cresce 6% em 260 ms; com Reduzir movimento, sem escala.
  useEffect(() => {
    progresso.set(
      withTiming(ativo ? 1 : 0, {
        duration: reduzirMovimento ? 0 : MOVIMENTO_DAS_TELAS.pilulaDaAba,
        easing: Easing.bezier(...CURVAS.pilula),
        reduceMotion: ReduceMotion.Never,
      }),
    )
    return () => cancelAnimation(progresso)
  }, [ativo, reduzirMovimento, progresso])
  const estilo = useAnimatedStyle(() => ({
    transform: reduzirMovimento
      ? []
      : [{ translateY: -1 * progresso.value }, { scale: 1 + 0.06 * progresso.value }],
  }))
  return (
    <View style={{ height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={estilo}>
        <IconeDeTraco
          nome={icone ?? 'pessoa'}
          cor={cor}
          tamanho={BARRA_DE_ABAS.tamanhoDoIcone}
          traco={ativo && icone ? 2.4 : 2}
        />
      </Animated.View>
    </View>
  )
}
