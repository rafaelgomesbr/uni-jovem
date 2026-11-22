/* eslint-disable no-restricted-syntax -- opacidade aqui é a camada animada de toque e o indicador, não estado (D64) */
import { ALTURA, ESPACO, MOVIMENTO_DOS_CONTROLES, RAIO } from '@uj/tokens'
import {
  Children,
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { aparenciaDoBotao, type VarianteDoBotao } from './aparenciaDoBotao'
import { ALFA_DESABILITADO, comOpacidade } from './cor'
import { useAnelDeFoco, type NoDeView } from './foco'
import { Icone, type NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { useTema } from './tema'
import { useToqueComMola } from './useToqueComMola'
import { soNaWeb } from './web'

export { aparenciaDoBotao, type AparenciaDoBotao, type VarianteDoBotao } from './aparenciaDoBotao'

/**
 * `grande` (56): formulários, barra de ação, entrada. `medio` (48): dentro de
 * cartão. `compacto` (40 visual, alvo de 48 com a folga de toque): só em linha
 * de lista. `alto` (56, ícone de 24): controles do Ao vivo, usados sob pressão.
 */
export type TamanhoDoBotao = 'grande' | 'medio' | 'compacto' | 'alto'

export interface PropsDoBotao {
  titulo: string
  aoPressionar: () => void
  variante?: VarianteDoBotao
  tamanho?: TamanhoDoBotao
  carregando?: boolean
  /** Enquanto carrega, troca o título ("Entrando..."). O nome acessível continua o `titulo`. */
  tituloCarregando?: string
  desabilitado?: boolean
  /** Por que o botão está desabilitado. Aparece 8 abaixo dele, com um cadeado, e vai para o leitor de tela. */
  motivo?: string
  /** Só quando ajuda a reconhecer a ação (QR, compartilhar, "+"). */
  icone?: NomeDoIcone
  /** Quando o título sozinho não basta fora de contexto (ex.: "Revogar" + nome do aparelho). */
  rotuloAcessivel?: string
  dica?: string
  /** Largura total: só em formulário, barra de ação e estado vazio de tela inteira. */
  larguraTotal?: boolean
  /**
   * Terciário alinhado à coluna de texto: sem padding lateral, o rótulo
   * começa (ou termina) na mesma borda do texto ao redor.
   */
  alinhado?: boolean
  style?: StyleProp<ViewStyle>
  /** Botão que abre e fecha um bloco: o leitor de tela anuncia aberto ou fechado. */
  expandido?: boolean
  /**
   * Botão alternável ("Estou orando"): o leitor de tela ouve se está marcado
   * (`aria-pressed`). Marcado, o secundário ganha fundo quente, borda e texto
   * em destaque. Quem chama troca também o rótulo e o ícone ("Orando" com o
   * check): a cor nunca é o único sinal.
   */
  marcado?: boolean
  /** Só o catálogo: desenha o estado pressionado ou o anel de foco sem toque nem teclado. */
  estadoDeVitrine?: 'pressionado' | 'foco'
  ref?: Ref<NoDeView>
}

/** Dentro do `ParDeBotoes`, cada botão ocupa a sua metade. */
const ContextoDoPar = createContext(false)

/**
 * Botão ao lado de um campo (`Campo.botao`): vira peça única com ele, com a
 * altura da caixa (56) e o raio do campo, em vez de cápsula.
 */
export const ContextoDoBotaoEncaixado = createContext(false)

/**
 * Dentro da `BarraDeAcao`: o id da linha de motivo que a barra desenha na
 * largura toda, embaixo dos botões. O botão não desenha o motivo ao lado (a
 * coluna de meia largura espremia o texto); só aponta para ele.
 */
export const ContextoDoMotivoNaBarra = createContext<string | null>(null)

/** O anel de foco (2, afastado 2) desenhado sem foco de verdade, para o catálogo. */
function ANEL_DE_VITRINE(cor: string): ViewStyle {
  return { outlineWidth: 2, outlineStyle: 'solid', outlineColor: cor, outlineOffset: 2 }
}

/** Altura do tamanho: grande 56; médio 48; compacto 40; alto 56. */
export function alturaDoBotao(tamanho: TamanhoDoBotao): number {
  if (tamanho === 'compacto') return ALTURA.botao.compacto
  return tamanho === 'medio' ? ALTURA.botao.medio : ALTURA.botao.grande
}

/** Ícone de 20 no grande, 18 no médio, 16 no compacto e 24 no alto (Ao vivo). */
export function ladoDoIconeDoBotao(tamanho: TamanhoDoBotao): number {
  return tamanho === 'alto' ? 24 : tamanho === 'grande' ? 20 : tamanho === 'medio' ? 18 : 16
}

/** Padding horizontal: 24 no grande, 20 no médio, 16 no compacto, 8 no alto e 12 dentro do par. */
function paddingDoBotao(tamanho: TamanhoDoBotao, noPar: boolean, alinhado: boolean): number {
  if (alinhado) return 0
  if (noPar) return ESPACO.e12
  switch (tamanho) {
    case 'alto':
      return ESPACO.e8
    case 'compacto':
      return ESPACO.e16
    case 'medio':
      return ESPACO.e20
    case 'grande':
      return ESPACO.e24
  }
}

export function Botao({
  titulo,
  aoPressionar,
  variante = 'primario',
  tamanho = 'medio',
  carregando = false,
  tituloCarregando,
  desabilitado = false,
  motivo,
  icone,
  rotuloAcessivel,
  dica,
  larguraTotal: larguraTotalPedida,
  alinhado = false,
  style,
  expandido,
  marcado,
  estadoDeVitrine,
  ref,
}: PropsDoBotao) {
  const noPar = useContext(ContextoDoPar)
  const encaixado = useContext(ContextoDoBotaoEncaixado)
  const idDoMotivoNaBarra = useContext(ContextoDoMotivoNaBarra)
  const larguraTotal = larguraTotalPedida ?? noPar
  const tema = useTema()
  const { cores } = tema
  const { reduzirMovimento, reduzirTransparencia, aumentarContraste } =
    usePreferenciasDeAcessibilidade()
  const idProprio = `motivo-${useId()}`
  // Carregando: a largura fica travada na medida do estado normal (o botão não "pula").
  const [larguraNormal, setLarguraNormal] = useState<number | null>(null)
  const anel = useAnelDeFoco(cores.foco)
  const toque = useToqueComMola()
  const inativo = desabilitado || carregando
  const aparencia = aparenciaDoBotao(variante, desabilitado && !carregando, tema, !!marcado, {
    aumentarContraste,
    reduzirTransparencia,
  })
  const mostrarMotivo = desabilitado && !carregando && motivo
  const idDoMotivo = idDoMotivoNaBarra ?? idProprio
  const altura = encaixado ? ALTURA.campo : alturaDoBotao(tamanho)
  const padding = paddingDoBotao(tamanho, noPar, alinhado)
  const raio = encaixado ? RAIO.campo : RAIO.pilula
  const vitrinePressionado = estadoDeVitrine === 'pressionado'

  // O indicador só aparece depois de 250 ms (resposta rápida não pisca) e dissolve em 140 ms.
  const [passouAEspera, setPassouAEspera] = useState(false)
  useEffect(() => {
    if (!carregando) return
    const t = setTimeout(() => setPassouAEspera(true), MOVIMENTO_DOS_CONTROLES.esperaDoIndicador)
    return () => {
      clearTimeout(t)
      setPassouAEspera(false)
    }
  }, [carregando])
  const mostrarIndicador = carregando && passouAEspera
  const indicador = useSharedValue(0)
  useEffect(() => {
    indicador.set(
      withTiming(mostrarIndicador ? 1 : 0, {
        duration: mostrarIndicador
          ? MOVIMENTO_DOS_CONTROLES.indicadorEntra
          : MOVIMENTO_DOS_CONTROLES.indicadorSai,
        reduceMotion: ReduceMotion.Never,
      }),
    )
  }, [mostrarIndicador, indicador])
  const estiloDoIndicador = useAnimatedStyle(() => ({ opacity: indicador.value }))

  const ladoDoIcone = ladoDoIconeDoBotao(tamanho)
  const tituloVisivel = carregando && tituloCarregando ? tituloCarregando : titulo
  // O ponteiro em cima só existe na web; o toque nativo usa só a camada de pressionado.
  const comPonteiro = Platform.OS === 'web'

  return (
    <View style={[larguraTotal ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}>
      <Animated.View
        style={
          vitrinePressionado
            ? {
                transform: [
                  { scale: reduzirMovimento ? 1 : MOVIMENTO_DOS_CONTROLES.escalaDoToque },
                ],
              }
            : toque.estiloDoToque
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rotuloAcessivel ?? titulo}
          accessibilityHint={mostrarMotivo ? motivo : dica}
          ref={ref}
          aria-disabled={inativo}
          {...(expandido !== undefined ? { 'aria-expanded': expandido } : {})}
          {...(marcado !== undefined ? { 'aria-pressed': marcado } : {})}
          aria-busy={carregando}
          {...(mostrarMotivo ? soNaWeb({ 'aria-describedby': idDoMotivo }) : {})}
          disabled={inativo}
          hitSlop={tamanho === 'compacto' ? ESPACO.e4 : undefined}
          onPress={aoPressionar}
          onPressIn={toque.aoPressionarDentro}
          onPressOut={toque.aoPressionarFora}
          onFocus={anel.onFocus}
          onBlur={anel.onBlur}
          {...(comPonteiro
            ? { onHoverIn: toque.aoEntrarComPonteiro, onHoverOut: toque.aoSairComPonteiro }
            : {})}
          onLayout={(e) => {
            if (!carregando) setLarguraNormal(e.nativeEvent.layout.width)
          }}
          style={({ pressed: tocado }) => {
            const pressed = tocado || vitrinePressionado
            return [
              {
                minHeight: altura,
                minWidth:
                  carregando && larguraNormal
                    ? larguraNormal
                    : tamanho === 'grande' && !alinhado
                      ? 96
                      : ALVO,
                ...(carregando && larguraNormal ? { width: larguraNormal } : {}),
                paddingHorizontal: padding,
                paddingVertical: ESPACO.e8,
                borderRadius: raio,
                overflow: 'hidden',
                backgroundColor: aparencia.fundo,
                // Degradê com o sólido por baixo: onde `backgroundImage` não é desenhado, vale o sólido.
                ...(aparencia.degrade ? { backgroundImage: aparencia.degrade } : {}),
                borderWidth: aparencia.larguraDaBorda,
                borderColor: aparencia.borda ?? 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: ESPACO.e8,
                // Pressionado: sem sombra nem realce (o botão "afunda").
                ...(aparencia.sombra && !pressed ? { boxShadow: aparencia.sombra } : {}),
              },
              anel.estilo,
              estadoDeVitrine === 'foco' ? ANEL_DE_VITRINE(cores.foco) : null,
            ]
          }}
        >
          {aparencia.camadaDeHover ? (
            <Animated.View
              pointerEvents="none"
              testID="botao-camada-de-hover"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: aparencia.camadaDeHover },
                toque.estiloDoHover,
              ]}
            />
          ) : null}
          {aparencia.camadaDeToque ? (
            <Animated.View
              pointerEvents="none"
              testID="botao-camada-de-toque"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: aparencia.camadaDeToque },
                vitrinePressionado ? { opacity: 1 } : toque.estiloDaCamada,
              ]}
            />
          ) : null}
          {mostrarIndicador ? (
            <Animated.View
              testID="botao-indicador"
              style={[
                { width: ladoDoIcone, height: ladoDoIcone, justifyContent: 'center' },
                estiloDoIndicador,
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <ActivityIndicator
                color={aparencia.texto}
                size={Platform.OS === 'android' ? 18 : 'small'}
              />
            </Animated.View>
          ) : icone ? (
            <Icone nome={icone} cor={aparencia.texto} tamanho={ladoDoIcone} />
          ) : null}
          {/* Encolhe e quebra a linha em vez de empurrar o ícone para fora do botão. */}
          <Texto variante="botao" style={{ color: aparencia.texto, flexShrink: 1 }} centralizado>
            {tituloVisivel}
          </Texto>
        </Pressable>
      </Animated.View>
      {mostrarMotivo && !idDoMotivoNaBarra ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: ESPACO.e6,
            marginTop: ESPACO.e8,
          }}
        >
          <View style={{ height: 20, justifyContent: 'center' }}>
            <Icone nome="cadeado" cor={cores.textoSuave} tamanho={14} />
          </View>
          <Texto variante="legenda" cor="textoSuave" nativeID={idDoMotivo} style={{ flex: 1 }}>
            {motivo}
          </Texto>
        </View>
      ) : null}
    </View>
  )
}

export interface PropsDoBotaoIcone {
  icone: NomeDoIcone
  /** Sempre: o nome acessível. Com `texto`, precisa contê-lo ("Mais ações" para "Mais"). */
  rotulo: string
  /**
   * Texto visível junto do ícone, para quem não lê o símbolo sozinho ("…" não
   * é "menu" para todo mundo; auditoria U-05 e U-20). Sem ele, só o ícone.
   */
  texto?: string
  /** Onde fica o `texto`: ao lado (padrão, "… Mais") ou embaixo do ícone (controles do Ao vivo). */
  disposicao?: 'lado' | 'embaixo'
  aoPressionar: () => void
  dica?: string
  desabilitado?: boolean
  /** Mantido por compatibilidade: o botão de ícone é sempre circular (cápsula com `texto`). */
  circular?: boolean
  /** 44 por padrão; 48 na barra de ação; 56 nos controles do Ao vivo (ícone de 24). */
  lado?: number
  ref?: Ref<NoDeView>
}

/**
 * Botão de ícone (44×44, círculo tonal, sem borda): voltar, mais ações, subir e
 * descer. Com `texto`, a mesma altura e o texto visível ao lado (ou embaixo) do
 * ícone; a largura segue o texto. Mesma gramática do `Botao`: camada de
 * pressionado, escala 0,98 com mola, anel de foco coral.
 */
export function BotaoIcone({
  icone,
  rotulo,
  texto,
  disposicao = 'lado',
  aoPressionar,
  dica,
  desabilitado = false,
  lado = ALTURA.iconeSo,
  ref,
}: PropsDoBotaoIcone) {
  const { cores, solido } = useTema()
  const { reduzirTransparencia, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const anel = useAnelDeFoco(cores.foco)
  const toque = useToqueComMola()
  const fundo = reduzirTransparencia ? cores.botaoTonalOpaco : solido(cores.botaoTonal)
  const cor = desabilitado ? comOpacidade(cores.texto, ALFA_DESABILITADO) : cores.texto
  const comPonteiro = Platform.OS === 'web'
  return (
    <Animated.View style={toque.estiloDoToque}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        accessibilityHint={dica}
        aria-disabled={desabilitado}
        disabled={desabilitado}
        onPress={aoPressionar}
        onPressIn={toque.aoPressionarDentro}
        onPressOut={toque.aoPressionarFora}
        onFocus={anel.onFocus}
        onBlur={anel.onBlur}
        {...(comPonteiro
          ? { onHoverIn: toque.aoEntrarComPonteiro, onHoverOut: toque.aoSairComPonteiro }
          : {})}
        ref={ref}
        hitSlop={Math.max(0, (ALVO - lado) / 2)}
        style={[
          texto
            ? {
                minWidth: lado,
                minHeight: lado,
                flexDirection: disposicao === 'lado' ? 'row' : 'column',
                gap: disposicao === 'lado' ? ESPACO.e6 : ESPACO.e2,
                paddingHorizontal: disposicao === 'lado' ? ESPACO.e14 : ESPACO.e8,
                paddingVertical: ESPACO.e4,
              }
            : { width: lado, height: lado },
          {
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderRadius: RAIO.pilula,
            backgroundColor: fundo,
            borderWidth: aumentarContraste ? 2 : 0,
            borderColor: aumentarContraste ? cores.texto : 'transparent',
          },
          anel.estilo,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: cores.botaoTonalPressionado },
            toque.estiloDoHover,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: cores.botaoTonalPressionado },
            toque.estiloDaCamada,
          ]}
        />
        <Icone
          nome={icone}
          cor={cor}
          tamanho={lado >= ALTURA.botao.grande ? 24 : 22}
          peso="semibold"
        />
        {texto ? (
          <Texto
            variante={disposicao === 'lado' ? 'botao' : 'legenda'}
            peso="forte"
            centralizado
            // Embaixo do ícone, o texto cresce até 1,6: mais que isso, a barra do Ao vivo não comporta.
            {...(disposicao === 'embaixo' ? { maxFontSizeMultiplier: 1.6 } : {})}
            style={{ color: cor }}
          >
            {texto}
          </Texto>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

/** O filho é um `Botao` primário (a variante padrão, ou `primario` escrito)? */
function ehPrimario(filho: ReactNode): boolean {
  if (typeof filho !== 'object' || filho === null || !('props' in filho)) return false
  const variante = (filho.props as { variante?: unknown }).variante
  return variante === undefined || variante === 'primario'
}

/** Botões que dividem a linha (barra de ação): largura total e padding 12, como no par. */
export function EmPar({ children }: { children: ReactNode }) {
  return <ContextoDoPar.Provider value>{children}</ContextoDoPar.Provider>
}

/**
 * Até 2 botões lado a lado, cada um com `flex: 1` e intervalo de 12 (D64). Com
 * fonte grande (`fontScale` de 1,35 ou mais), viram coluna, o primário em cima.
 * Com `larguraMinima` (a de cada botão, na fonte padrão), também viram coluna
 * quando a metade da linha não comporta o rótulo: nada de rótulo cortado.
 */
export function ParDeBotoes({
  children,
  larguraMinima,
}: {
  children: ReactNode
  larguraMinima?: number
}) {
  const { fontScale } = useWindowDimensions()
  // Largura real da linha (a do cartão em que o par está), medida no layout.
  const [largura, setLargura] = useState<number | null>(null)
  const itens = Children.toArray(children).filter(Boolean)
  const metade = largura === null ? null : (largura - ESPACO.e12) / 2
  const naoCabe =
    larguraMinima !== undefined &&
    itens.length > 1 &&
    (metade === null || metade < larguraMinima * fontScale)
  const coluna = fontScale >= 1.35 || naoCabe
  // Empilhado: o primário fica em cima (a ação principal é a primeira a ser lida).
  const ordenados =
    coluna && itens.length === 2 && ehPrimario(itens[1]) && !ehPrimario(itens[0])
      ? [itens[1], itens[0]]
      : itens
  return (
    <ContextoDoPar.Provider value>
      <View
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
        style={{ flexDirection: coluna ? 'column' : 'row', gap: ESPACO.e12 }}
      >
        {ordenados.map((filho, i) => (
          <View key={i} style={coluna ? { alignSelf: 'stretch' } : { flex: 1 }}>
            {filho}
          </View>
        ))}
      </View>
    </ContextoDoPar.Provider>
  )
}
