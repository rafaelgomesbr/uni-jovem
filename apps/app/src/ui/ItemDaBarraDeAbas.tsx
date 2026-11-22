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

/**
 * A barra tem 68 de altura (a cápsula da direção A): ícone de 24, 2 de intervalo e o rótulo. Acima
 * de 1,5 vez o rótulo de 16 de linha não cabe mais na altura, então a escala do rótulo para aí
 * mesmo quando a largura sobra (telas largas). O resto do crescimento fica com o visualizador de
 * conteúdo grande do iOS (tocar e segurar) e com o nome falado.
 */
const ESCALA_MAXIMA_PELA_ALTURA = 1.5

/**
 * Quanto o rótulo da barra pode crescer com a fonte do sistema (D75, passada do vovô). Antes, quando
 * a palavra mais longa não cabia no item a 1,3 vez ou mais, o rótulo SUMIA e a barra ficava só com
 * ícones: justamente para quem mais precisa da palavra. Agora o rótulo nunca some: cresce até o
 * maior valor, entre 1 e o menor de (escala do sistema, teto do papel, altura da barra), em que a
 * palavra mais longa ainda cabe no item (estimativa por excesso). Se nem a 1 cabe (telas de 360 com
 * "Comunidade"), devolve 1 e o texto se ajusta sozinho (`adjustsFontSizeToFit`), sem cortar.
 */
export function escalaDoRotuloDaBarra(
  rotulos: readonly string[],
  itens: number,
  larguraDaTela: number,
  fontScale: number,
): number {
  const teto = Math.min(fontScale, TIPO.aba.teto ?? fontScale, ESCALA_MAXIMA_PELA_ALTURA)
  const util =
    larguraDaTela - 2 * BARRA_DE_ABAS.margemLateral - 2 * (BARRA_DE_ABAS.preenchimento + 1)
  // O item tem 2 de cada lado (o `paddingHorizontal` dele).
  const disponivel = util / itens - 2 * ESPACO.e2
  const maiorEm1 = Math.max(...rotulos.map((r) => larguraEstimada(r, TIPO.aba.tamanho)))
  if (maiorEm1 <= 0) return Math.max(1, teto)
  return Math.max(1, Math.min(teto, disponivel / maiorEm1))
}

/** Os rótulos cabem nos itens na escala do sistema (a de `escalaDoRotuloDaBarra` chega a ela)? */
export function rotulosCabemNaBarra(
  rotulos: readonly string[],
  itens: number,
  larguraDaTela: number,
  fontScale: number,
): boolean {
  const pedida = Math.min(fontScale, TIPO.aba.teto ?? fontScale, ESCALA_MAXIMA_PELA_ALTURA)
  return escalaDoRotuloDaBarra(rotulos, itens, larguraDaTela, fontScale) >= Math.max(1, pedida)
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
   * Só o ícone. Desde a D75 a barra não usa mais (o rótulo nunca some com fonte grande); fica para
   * quem monta uma barra sem espaço. O rótulo continua no leitor de tela e no visualizador de
   * conteúdo grande do iOS (tocar e segurar).
   */
  semRotulo?: boolean
  /** Até quanto o rótulo cresce com a fonte do sistema (`escalaDoRotuloDaBarra`). */
  escalaDoRotulo?: number
  onPress?: ((e: GestureResponderEvent) => void) | undefined
  onLongPress?: ((e: GestureResponderEvent) => void) | undefined
}

/**
 * Item da barra de abas (2.12.17, M): mínimo de 58×48, raio 20, ícone de 22
 * numa vaga de 24, 2 e o rótulo 13/16 (D75). O ativo ganha a pílula coral, o
 * rótulo em 600 e o traço em 2,4 (no Perfil, o anel do avatar): peso e forma
 * além da cor. Celular: papel `tab` com estado selecionado; web: link com
 * `aria-current="page"`.
 *
 * Perfil: o avatar (24, na vaga do ícone) mais a palavra "Perfil", como os
 * outros itens (UX 8.1: "avatar mais texto"). O leitor de tela ouve
 * "Perfil de {nome}" e o estado selecionado; o anel muda de forma no ativo.
 *
 * O rótulo cresce com a fonte do sistema até onde a palavra cabe no item
 * (`escalaDoRotulo`, D75) e nunca some nem é cortado: o texto se ajusta ao item.
 */
export function ItemDaBarraDeAbas({
  rotulo,
  icone,
  avatar,
  ativo,
  nomeAcessivel,
  semRotulo = false,
  escalaDoRotulo,
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
      // O iOS mostra o visualizador de conteúdo grande com o rótulo inteiro, qualquer que seja a escala.
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
        <>
          {/* A vaga do ícone (24), como nos outros itens: o rótulo fica na mesma linha de base. */}
          <View
            style={{
              height: semRotulo ? undefined : 24,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 0,
            }}
          >
            <Avatar
              nome={avatar.nome}
              avatar={avatar.dados ?? null}
              proprio
              tamanho={semRotulo ? 'pilula' : 'aba'}
              anel={ativo ? 'ativo' : 'inativo'}
              decorativo
            />
          </View>
          {semRotulo ? null : (
            <RotuloDoItem rotulo={rotulo} ativo={ativo} cor={cor} escala={escalaDoRotulo} />
          )}
        </>
      ) : (
        <>
          <ItemComIcone icone={icone} cor={cor} ativo={ativo} />
          {semRotulo ? null : (
            <RotuloDoItem rotulo={rotulo} ativo={ativo} cor={cor} escala={escalaDoRotulo} />
          )}
        </>
      )}
    </Pressable>
  )
}

/** O rótulo de uma linha só que se ajusta ao item: encolhe até 15% antes de cortar uma palavra. */
function RotuloDoItem({
  rotulo,
  ativo,
  cor,
  escala,
}: {
  rotulo: string
  ativo: boolean
  cor: string
  escala: number | undefined
}) {
  return (
    <Texto
      variante="aba"
      peso={ativo ? 'forte' : 'medio'}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      {...(escala !== undefined ? { maxFontSizeMultiplier: escala } : {})}
      style={{ color: cor }}
    >
      {rotulo}
    </Texto>
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
