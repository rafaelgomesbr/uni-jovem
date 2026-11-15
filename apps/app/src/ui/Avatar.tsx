import {
  CORES_DA_COMUNIDADE,
  CORES_DO_AVATAR,
  corSobre,
  ehCorDoAvatar,
  ehIconeDoAvatar,
  ESPACO,
  INICIAIS_DO_AVATAR,
  INICIAIS_SOBRE_COR,
  iniciaisDoNome,
  TAMANHO_DO_AVATAR,
  type IconeDoAvatar,
} from '@uj/tokens'
import { Image, type ImageSource } from 'expo-image'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'

import { registrarAoEncerrarSessao } from '@/estado/aoEncerrarSessao'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { FAMILIA } from './fontes'
import { Texto } from './Texto'
import { useTema } from './tema'

/**
 * Foto de perfil ou logotipo guardado na API (D33): o caminho protegido e a
 * versão. A versão vai no `?v=` do endereço: trocou a foto, trocou o
 * endereço, e o cache nunca mostra a antiga.
 */
export interface FotoDoAvatar {
  caminho: string
  versao: string
}

/** O que a API manda em `conta.avatar` (e nos membros). Nomes fora da lista viram iniciais. */
export interface DadosDoAvatar {
  icone?: string | null
  cor?: string | null
  /** Foto ou logotipo: tem precedência sobre o ícone e a cor, que ficam como alternativa. */
  foto?: FotoDoAvatar | null
}

export type TamanhoDoAvatar = keyof typeof TAMANHO_DO_AVATAR

/** Endereço completo e cabeçalhos (o de acesso) para baixar uma imagem protegida. */
export interface EnderecoDaImagem {
  url: string
  cabecalhos: Record<string, string>
}

/** Como baixar uma imagem protegida: quem tem a sessão (o cliente da API) responde. */
export type AcessoDasImagens = (caminho: string) => Promise<EnderecoDaImagem | null>

/**
 * A `ui` não conhece o cliente da API: ele se registra aqui ao abrir o app.
 * Sem registro (ou sem sessão), o avatar mostra o ícone, a cor ou as iniciais.
 */
let acessoDasImagens: AcessoDasImagens | null = null

export function definirAcessoDasImagens(acesso: AcessoDasImagens | null): void {
  acessoDasImagens = acesso
}

/**
 * Na web, a imagem vem por `fetch` com o cabeçalho de acesso e vira um blob
 * local (o `<img>` não manda cabeçalho). Um por endereço, só em memória.
 */
const blobsDaWeb = new Map<string, Promise<string | null>>()

/** Esquece as imagens baixadas (troca de conta, saída): nada de foto alheia depois de sair. */
export function esquecerImagens(): void {
  if (Platform.OS === 'web') {
    for (const pedido of blobsDaWeb.values()) {
      void pedido.then((url) => (url ? URL.revokeObjectURL(url) : undefined))
    }
  }
  blobsDaWeb.clear()
  try {
    void Image.clearMemoryCache().catch(() => false)
  } catch {
    // Sem o módulo nativo (testes, web antiga): não há cache para limpar.
  }
}

registrarAoEncerrarSessao(esquecerImagens)

function enderecoVersionado(foto: FotoDoAvatar): string {
  return `${foto.caminho}?v=${encodeURIComponent(foto.versao)}`
}

async function blobDaWeb(endereco: EnderecoDaImagem): Promise<string | null> {
  try {
    const resposta = await fetch(endereco.url, {
      headers: endereco.cabecalhos,
      credentials: 'include',
    })
    if (!resposta.ok) return null
    return URL.createObjectURL(await resposta.blob())
  } catch {
    return null
  }
}

/** Fonte da imagem para o `expo-image`, ou `null` quando não dá para baixar (sem sessão, 404). */
async function fonteDaFoto(caminho: string, novaTentativa: boolean): Promise<ImageSource | null> {
  const acesso = acessoDasImagens
  if (!acesso) return null
  if (Platform.OS !== 'web') {
    const endereco = await acesso(caminho).catch(() => null)
    // `memory`: a foto de outra pessoa não fica gravada no disco do aparelho.
    return endereco ? { uri: endereco.url, headers: endereco.cabecalhos } : null
  }
  if (novaTentativa) blobsDaWeb.delete(caminho)
  let pedido = blobsDaWeb.get(caminho)
  if (!pedido) {
    pedido = acesso(caminho)
      .catch(() => null)
      .then((endereco) => (endereco ? blobDaWeb(endereco) : null))
    blobsDaWeb.set(caminho, pedido)
  }
  const url = await pedido
  // Falha não fica guardada: a próxima vez tenta de novo.
  if (!url) blobsDaWeb.delete(caminho)
  return url ? { uri: url } : null
}

interface EstadoDaFoto {
  caminho: string
  fonte: ImageSource | null
  /** A imagem carregou: a borda da foto aparece e o fundo some. */
  carregada: boolean
}

/**
 * Baixa a foto (sistema externo: a rede) quando o endereço muda. Um erro ao
 * desenhar (acesso vencido no meio do caminho) pede o endereço de novo uma
 * vez; na segunda falha, fica o avatar de ícone, cor ou iniciais.
 */
function useFoto(foto: FotoDoAvatar | null | undefined) {
  const caminho = foto ? enderecoVersionado(foto) : null
  const [estado, setEstado] = useState<EstadoDaFoto | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!caminho) return
    let vivo = true
    void fonteDaFoto(caminho, tentativa > 0).then((fonte) => {
      if (vivo) setEstado({ caminho, fonte, carregada: false })
    })
    return () => {
      vivo = false
    }
  }, [caminho, tentativa])

  const atual = estado && estado.caminho === caminho ? estado : null
  return {
    fonte: atual?.fonte ?? null,
    carregada: !!atual?.carregada,
    aoCarregar: () => setEstado((e) => (e ? { ...e, carregada: true } : e)),
    aoFalhar: () => {
      if (tentativa === 0) setTentativa(1)
      else setEstado((e) => (e ? { ...e, fonte: null } : e))
    },
  }
}

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
  /** Foto ou logotipo (D33). Na falta, vale `avatar.foto`; sem nenhum, o avatar de sempre. */
  foto?: FotoDoAvatar | null
  tamanho?: TamanhoDoAvatar
  /** Lado em pontos, quando nenhum dos tamanhos da 2.12.13 serve. */
  lado?: number
  /**
   * Quando o nome já está escrito ao lado (linha de lista), o avatar some do
   * leitor de tela para o nome não ser lido duas vezes.
   */
  decorativo?: boolean
  /** A pessoa que usa o app: `primaria` com `sobrePrimaria` enquanto não escolher avatar. */
  proprio?: boolean
  /** Avatar de comunidade: a cor da comunidade. */
  cor?: string
  /**
   * Anel (sinal de forma, além da cor): `inativo` 1,5 suave afastado 2 (aba
   * Perfil); `ativo` 2 coral afastado 2; `perfil` 2 coral afastado 3.
   */
  anel?: 'inativo' | 'ativo' | 'perfil'
}

/** Cor estável da pessoa sem avatar escolhido: uma das 6 cores de comunidade (iniciais brancas). */
export function corDaPessoa(nome: string): string {
  let soma = 0
  for (const letra of nome.trim().toLowerCase()) {
    soma = (soma * 31 + (letra.codePointAt(0) ?? 0)) % 2_147_483_647
  }
  return CORES_DA_COMUNIDADE[soma % CORES_DA_COMUNIDADE.length]!.valor
}

/** Cor e ícone que valem para este avatar (o escolhido ou o derivado do nome). */
export function aparenciaDoAvatar(nome: string, avatar?: DadosDoAvatar | null) {
  const corEscolhida = avatar?.cor
  const iconeEscolhido = avatar?.icone
  const icone = ehIconeDoAvatar(iconeEscolhido) ? iconeEscolhido : null
  const cor = ehCorDoAvatar(corEscolhida)
    ? CORES_DO_AVATAR[corEscolhida]
    : { fundo: corDaPessoa(nome), frente: INICIAIS_SOBRE_COR, nome: '' }
  return { cor, icone }
}

/**
 * Avatar (seção 2.12.13): a foto, quando há (D33), cobrindo o círculo com
 * borda de 1 `tonalBorda`; sem foto (ou enquanto ela chega), o ícone escolhido
 * sobre a cor escolhida ou as iniciais (Bricolage 800, 40% do lado) em branco
 * sobre uma cor estável. A própria pessoa usa a cor primária; a comunidade, a
 * cor dela.
 */
export function Avatar({
  nome,
  avatar,
  foto: fotoPedida,
  tamanho = 'linha',
  lado: ladoPedido,
  decorativo = false,
  proprio = false,
  cor: corDaComunidade,
  anel,
}: PropsDoAvatar) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const foto = useFoto(fotoPedida ?? avatar?.foto)
  const lado = ladoPedido ?? TAMANHO_DO_AVATAR[tamanho]
  const aparencia = aparenciaDoAvatar(nome, avatar)
  const escolhido = ehCorDoAvatar(avatar?.cor) || !!aparencia.icone
  const fundo = escolhido
    ? aparencia.cor.fundo
    : corDaComunidade
      ? corDaComunidade
      : proprio
        ? cores.primaria
        : aparencia.cor.fundo
  const frente = escolhido
    ? aparencia.cor.frente
    : corDaComunidade
      ? corSobre(corDaComunidade)
      : proprio
        ? cores.sobrePrimaria
        : INICIAIS_SOBRE_COR
  const iniciais = iniciaisDoNome(nome)
  const tamanhoDaLetra = ladoPedido ? Math.round(lado * 0.4) : INICIAIS_DO_AVATAR[tamanho]
  const comFoto = foto.carregada && !!foto.fonte

  const circulo = (
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
        backgroundColor: fundo,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: aumentarContraste ? 2 : comFoto ? 1 : 0,
        borderColor: aumentarContraste ? cores.texto : comFoto ? cores.tonalBorda : 'transparent',
        overflow: 'hidden',
      }}
    >
      {aparencia.icone ? (
        <SymbolView
          name={SIMBOLO_DO_AVATAR[aparencia.icone]}
          tintColor={frente}
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
            color: frente,
            fontFamily: FAMILIA.tituloForte,
            fontSize: tamanhoDaLetra,
            lineHeight: Math.round(tamanhoDaLetra * 1.25),
          }}
        >
          {iniciais}
        </Text>
      )}
      {foto.fonte ? (
        // Por cima do avatar de sempre: enquanto a foto chega, nada pisca nem muda de tamanho.
        <Image
          testID="foto-do-avatar"
          source={foto.fonte}
          cachePolicy="memory"
          contentFit="cover"
          accessible={false}
          accessibilityIgnoresInvertColors
          onLoad={foto.aoCarregar}
          onError={foto.aoFalhar}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  )
  if (!anel) return circulo
  const espessura = anel === 'inativo' ? 1.5 : 2
  const afastamento = anel === 'perfil' ? 3 : 2
  return (
    <View
      style={{
        padding: afastamento,
        borderRadius: lado,
        borderWidth: espessura,
        borderColor: anel === 'inativo' ? cores.textoSuave : cores.destaque,
        margin: anel === 'perfil' ? 0 : -(afastamento + espessura),
      }}
    >
      {circulo}
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
  const lado = TAMANHO_DO_AVATAR.aba
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
            borderRadius: lado,
            borderWidth: 2,
            borderColor: cores.superficie,
          }}
        >
          <Avatar nome={nome} tamanho="aba" decorativo />
        </View>
      ))}
      {resto > 0 ? (
        <Texto variante="chip" cor="textoSuave" tabular style={{ marginLeft: ESPACO.e4 }}>
          +{resto}
        </Texto>
      ) : null}
    </View>
  )
}
