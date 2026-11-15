import {
  CORES_DO_AVATAR,
  corDoAvatarPeloNome,
  ehCorDoAvatar,
  ehIconeDoAvatar,
  iniciaisDoNome,
  TAMANHO_DO_AVATAR,
  type IconeDoAvatar,
} from '@uj/tokens'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import { Text, View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { FAMILIA } from './fontes'
import { useTema } from './tema'

/** O que a API manda em `conta.avatar` (e nos membros). Nomes fora da lista viram iniciais. */
export interface DadosDoAvatar {
  icone?: string | null
  cor?: string | null
}

export type TamanhoDoAvatar = keyof typeof TAMANHO_DO_AVATAR

/** Símbolo de cada ícone do avatar: SF Symbols no iOS, Material Symbols no Android e na web. */
export const SIMBOLO_DO_AVATAR: Readonly<
  Record<IconeDoAvatar, Exclude<SymbolViewProps['name'], string>>
> = {
  nascer: { ios: 'sunrise.fill', android: 'wb_twilight', web: 'wb_twilight' },
  sol: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' },
  lua: { ios: 'moon.stars.fill', android: 'dark_mode', web: 'dark_mode' },
  estrela: { ios: 'star.fill', android: 'star', web: 'star' },
  coracao: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  chama: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  folha: { ios: 'leaf.fill', android: 'eco', web: 'eco' },
  flor: { ios: 'camera.macro', android: 'local_florist', web: 'local_florist' },
  montanha: { ios: 'mountain.2.fill', android: 'landscape', web: 'landscape' },
  onda: { ios: 'water.waves', android: 'waves', web: 'waves' },
  nuvem: { ios: 'cloud.fill', android: 'cloud', web: 'cloud' },
  raio: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  musica: { ios: 'music.note', android: 'music_note', web: 'music_note' },
  microfone: { ios: 'music.mic', android: 'mic', web: 'mic' },
  livro: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
  cafe: { ios: 'cup.and.saucer.fill', android: 'coffee', web: 'coffee' },
  bola: { ios: 'soccerball', android: 'sports_soccer', web: 'sports_soccer' },
  jogo: { ios: 'gamecontroller.fill', android: 'sports_esports', web: 'sports_esports' },
  paleta: { ios: 'paintpalette.fill', android: 'palette', web: 'palette' },
  camera: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  aviao: { ios: 'airplane', android: 'flight', web: 'flight' },
  bicicleta: { ios: 'bicycle', android: 'directions_bike', web: 'directions_bike' },
  pata: { ios: 'pawprint.fill', android: 'pets', web: 'pets' },
  globo: { ios: 'globe.americas.fill', android: 'public', web: 'public' },
}

interface PropsDoAvatar {
  nome: string
  avatar?: DadosDoAvatar | null
  tamanho?: TamanhoDoAvatar
  /** Lado em pontos, quando nenhum dos três tamanhos serve (ex.: 26 na barra de abas). */
  lado?: number
  /**
   * Quando o nome já está escrito ao lado (linha de lista), o avatar some do
   * leitor de tela para o nome não ser lido duas vezes.
   */
  decorativo?: boolean
}

/** Cor e ícone que valem para este avatar (o escolhido ou o derivado do nome). */
export function aparenciaDoAvatar(nome: string, avatar?: DadosDoAvatar | null) {
  const corEscolhida = avatar?.cor
  const iconeEscolhido = avatar?.icone
  const nomeDaCor = ehCorDoAvatar(corEscolhida) ? corEscolhida : corDoAvatarPeloNome(nome)
  const icone = ehIconeDoAvatar(iconeEscolhido) ? iconeEscolhido : null
  return { cor: CORES_DO_AVATAR[nomeDaCor], icone }
}

/**
 * Avatar da pessoa: o ícone escolhido sobre a cor escolhida ou, sem escolha,
 * as iniciais sobre uma cor estável derivada do nome. Contraste do que vai
 * por cima conferido no teste dos tokens.
 */
export function Avatar({
  nome,
  avatar,
  tamanho = 'M',
  lado: ladoPedido,
  decorativo = false,
}: PropsDoAvatar) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const lado = ladoPedido ?? TAMANHO_DO_AVATAR[tamanho]
  const { cor, icone } = aparenciaDoAvatar(nome, avatar)
  const iniciais = iniciaisDoNome(nome)
  // Iniciais ocupam ~40% do lado; com duas letras largas, um pouco menos.
  const tamanhoDaLetra = Math.round(lado * (iniciais.length > 1 ? 0.38 : 0.44))

  return (
    <View
      {...(decorativo
        ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' }
        : {
            accessible: true,
            accessibilityRole: 'image',
            accessibilityLabel: `Avatar de ${nome}`,
          })}
      style={{
        width: lado,
        height: lado,
        borderRadius: lado / 2,
        backgroundColor: cor.fundo,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: aumentarContraste ? 2 : 1,
        borderColor: aumentarContraste ? cores.texto : cores.bordaSuave,
        overflow: 'hidden',
      }}
    >
      {icone ? (
        <SymbolView
          name={SIMBOLO_DO_AVATAR[icone]}
          tintColor={cor.frente}
          size={Math.round(lado * 0.52)}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : (
        // As iniciais acompanham o círculo, que tem tamanho fixo: o nome por
        // extenso (ao lado ou no rótulo) é que segue a fonte do sistema.
        <Text
          allowFontScaling={false}
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={{
            color: cor.frente,
            fontFamily: tamanho === 'G' ? FAMILIA.tituloForte : FAMILIA.textoForte,
            fontSize: tamanhoDaLetra,
            lineHeight: Math.round(tamanhoDaLetra * 1.2),
          }}
        >
          {iniciais}
        </Text>
      )}
    </View>
  )
}

interface PropsDaPilha {
  nomes: readonly string[]
  /** Quantas mostrar antes do "+N". */
  maximo?: number
}

/**
 * Pilha de avatares pequenos (quem está orando). Decorativa: o texto ao lado
 * diz quantas pessoas são; o "+N" também vai escrito.
 */
export function PilhaDeAvatares({ nomes, maximo = 4 }: PropsDaPilha) {
  const { cores } = useTema()
  if (nomes.length === 0) return null
  const visiveis = nomes.slice(0, maximo)
  const resto = nomes.length - visiveis.length
  const lado = TAMANHO_DO_AVATAR.P
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      {visiveis.map((nome, i) => (
        <View
          key={`${nome}-${i}`}
          style={{
            marginLeft: i === 0 ? 0 : -lado / 4,
            borderRadius: lado / 2,
            borderWidth: 2,
            borderColor: cores.superficie,
          }}
        >
          <Avatar nome={nome} tamanho="P" decorativo />
        </View>
      ))}
      {resto > 0 ? (
        <Text
          style={{
            marginLeft: 6,
            color: cores.textoSuave,
            fontFamily: FAMILIA.textoForte,
            fontSize: 12,
            fontVariant: ['tabular-nums'],
          }}
        >
          +{resto}
        </Text>
      ) : null}
    </View>
  )
}
