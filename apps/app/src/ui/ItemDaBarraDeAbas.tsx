import { ALTURA, BARRA_DE_ABAS, ESPACO, RAIO } from '@uj/tokens'
import { Platform, Pressable, View, type GestureResponderEvent } from 'react-native'

import { Avatar, type DadosDoAvatar } from './Avatar'
import { IconeDeTraco, type NomeDoTraco } from './IconeDeTraco'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { useTema } from './tema'
import { soNaWeb } from './web'

export interface PropsDoItemDaBarra {
  rotulo: string
  /** Ícone de traço do mockup; sem ele, o avatar da pessoa (aba Perfil). */
  icone: NomeDoTraco | null
  avatar?: { nome: string; dados?: DadosDoAvatar | null } | null
  ativo: boolean
  /** O que o leitor de tela ouve ("Perfil de Ana Lima"). */
  nomeAcessivel?: string
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
 */
export function ItemDaBarraDeAbas({
  rotulo,
  icone,
  avatar,
  ativo,
  nomeAcessivel,
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
      // O rótulo tem teto de 1,3: com fonte grande, o iOS mostra o visualizador de conteúdo grande.
      accessibilityShowsLargeContentViewer
      accessibilityLargeContentTitle={rotulo}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        minWidth: BARRA_DE_ABAS.larguraMinimaDoItem,
        minHeight: Math.max(ALVO, ALTURA.aba),
        paddingHorizontal: ESPACO.e2,
        alignItems: 'center',
        justifyContent: 'center',
        gap: ESPACO.e2,
        borderRadius: RAIO.abaAtiva,
        backgroundColor: ativo ? cores.abaAtivaFundo : pressed ? cores.pressionado : 'transparent',
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
          <Texto
            variante="aba"
            peso={ativo ? 'forte' : 'medio'}
            numberOfLines={1}
            style={{ color: cor }}
          >
            {rotulo}
          </Texto>
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
  return (
    <View style={{ height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <IconeDeTraco
        nome={icone ?? 'pessoa'}
        cor={cor}
        tamanho={BARRA_DE_ABAS.tamanhoDoIcone}
        traco={ativo && icone ? 2.4 : 2}
      />
    </View>
  )
}
