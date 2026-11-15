import { ALTURA, ESPACO, RAIO } from '@uj/tokens'
import {
  Children,
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { ALFA_DESABILITADO, comOpacidade, escurecer } from './cor'
import { useAnelDeFoco, type NoDeView } from './foco'
import { Icone, type NomeDoIcone } from './Icone'
import { ALVO } from './medidas'
import { Texto } from './Texto'
import { useTema, type Tema } from './tema'
import { soNaWeb } from './web'

/**
 * Hierarquia (seção 2.12.1): `primario` (no máximo um visível por tela ou por
 * cartão de destaque), `secundario` (contorno), `terciario` (só texto),
 * `destrutivo` (contorno de erro) e `destrutivoCheio` (a confirmação final).
 */
export type VarianteDoBotao =
  'primario' | 'secundario' | 'terciario' | 'destrutivo' | 'destrutivoCheio'

/**
 * `grande` (48): formulários, barra de ação, entrada. `medio` (44; 48 no
 * Android): dentro de cartão. `alto` (56, ícone de 24): controles do Ao vivo,
 * usados sob pressão.
 */
export type TamanhoDoBotao = 'grande' | 'medio' | 'alto'

export interface PropsDoBotao {
  titulo: string
  aoPressionar: () => void
  variante?: VarianteDoBotao
  tamanho?: TamanhoDoBotao
  carregando?: boolean
  desabilitado?: boolean
  /** Por que o botão está desabilitado. Aparece 6 abaixo dele e vai para o leitor de tela. */
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

interface Aparencia {
  fundo: string
  fundoPressionado: string
  texto: string
  borda: string | null
}

/** Cores de cada variante em cada estado (tabela da 2.12.1). Sem `opacity`: tudo é cor. */
export function aparenciaDoBotao(
  variante: VarianteDoBotao,
  inativo: boolean,
  { cores, semFundo, solido }: Pick<Tema, 'cores' | 'semFundo' | 'solido'>,
  marcado = false,
): Aparencia {
  const textoInativo = comOpacidade(cores.texto, ALFA_DESABILITADO)
  if (inativo) {
    if (variante === 'primario' || variante === 'destrutivoCheio') {
      return { fundo: solido(cores.tonal), fundoPressionado: '', texto: textoInativo, borda: null }
    }
    if (variante === 'terciario') {
      return { fundo: 'transparent', fundoPressionado: '', texto: textoInativo, borda: null }
    }
    return { fundo: semFundo, fundoPressionado: '', texto: textoInativo, borda: cores.tonalBorda }
  }
  switch (variante) {
    case 'primario':
      return {
        fundo: cores.primaria,
        fundoPressionado: cores.primariaPressionada,
        texto: cores.sobrePrimaria,
        borda: null,
      }
    case 'secundario':
      if (marcado) {
        return {
          fundo: solido(cores.quenteFundo),
          fundoPressionado: solido(cores.quenteFundo),
          texto: cores.destaque,
          borda: cores.destaque,
        }
      }
      return {
        fundo: semFundo,
        fundoPressionado: solido(cores.pressionado),
        texto: cores.texto,
        borda: cores.contorno,
      }
    case 'terciario':
      return {
        fundo: 'transparent',
        fundoPressionado: solido(cores.quenteFundo),
        texto: cores.destaque,
        borda: null,
      }
    case 'destrutivo':
      return {
        fundo: semFundo,
        fundoPressionado: solido(cores.erroFundo),
        texto: cores.erro,
        borda: cores.erro,
      }
    case 'destrutivoCheio':
      return {
        fundo: cores.erroCheio,
        fundoPressionado: escurecer(cores.erroCheio, 0.08),
        texto: cores.sobreErro,
        borda: null,
      }
  }
}

/** Dentro do `ParDeBotoes`, cada botão ocupa a sua metade. */
const ContextoDoPar = createContext(false)

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

/** Altura do tamanho: grande 48; médio 44 no iOS e na web, 48 no Android; alto 56. */
export function alturaDoBotao(tamanho: TamanhoDoBotao): number {
  if (tamanho === 'alto') return ALTURA.controleAlto
  return tamanho === 'grande' ? ALTURA.controle : ALVO
}

/** Ícone de 18 nos botões; 24 nos de 56, para o ícone crescer com o alvo. */
function ladoDoIcone(altura: number): number {
  return altura >= ALTURA.controleAlto ? 24 : 18
}

export function Botao({
  titulo,
  aoPressionar,
  variante = 'primario',
  tamanho = 'medio',
  carregando = false,
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
  const idDoMotivoNaBarra = useContext(ContextoDoMotivoNaBarra)
  const larguraTotal = larguraTotalPedida ?? noPar
  const tema = useTema()
  const { cores } = tema
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const idProprio = `motivo-${useId()}`
  // Carregando: a largura fica travada na medida do estado normal (o botão não "pula").
  const [larguraNormal, setLarguraNormal] = useState<number | null>(null)
  const anel = useAnelDeFoco(cores.foco)
  const inativo = desabilitado || carregando
  const aparencia = aparenciaDoBotao(variante, desabilitado && !carregando, tema, !!marcado)
  const mostrarMotivo = desabilitado && !carregando && motivo
  const idDoMotivo = idDoMotivoNaBarra ?? idProprio
  // Em par (`flex: 1`) o padding cai para 6, como no quadro: "Pedir substituição" cabe em 152.
  // No alto (Ao vivo), o rótulo mais longo ("Concluir a última etapa") cabe entre dois controles de 56.
  const padding = alinhado
    ? 0
    : noPar
      ? ESPACO.e6
      : tamanho === 'alto'
        ? ESPACO.e8
        : tamanho === 'medio'
          ? ESPACO.e16
          : ESPACO.e20

  return (
    <View style={[larguraTotal ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}>
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
        onPress={aoPressionar}
        onFocus={anel.onFocus}
        onBlur={anel.onBlur}
        onLayout={(e) => {
          if (!carregando) setLarguraNormal(e.nativeEvent.layout.width)
        }}
        android_ripple={
          aparencia.fundoPressionado ? { color: cores.pressionado, borderless: false } : undefined
        }
        style={({ pressed: tocado }) => {
          const pressed = tocado || estadoDeVitrine === 'pressionado'
          return [
            {
              minHeight: alturaDoBotao(tamanho),
              minWidth: carregando && larguraNormal ? larguraNormal : ALVO,
              paddingHorizontal: padding,
              paddingVertical: ESPACO.e8,
              borderRadius: RAIO.controle,
              backgroundColor:
                pressed && aparencia.fundoPressionado
                  ? aparencia.fundoPressionado
                  : aparencia.fundo,
              borderWidth: aparencia.borda ? 1 : 0,
              borderColor: aparencia.borda ?? 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: ESPACO.e8,
              // Afundar de leve ao tocar é movimento: some com "Reduzir movimento".
              transform: [{ scale: pressed && !inativo && !reduzirMovimento ? 0.98 : 1 }],
            },
            anel.estilo,
            estadoDeVitrine === 'foco' ? ANEL_DE_VITRINE(cores.foco) : null,
          ]
        }}
      >
        {carregando ? (
          <ActivityIndicator
            color={aparencia.texto}
            size={Platform.OS === 'android' ? 18 : 'small'}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : icone ? (
          <Icone nome={icone} cor={aparencia.texto} tamanho={ladoDoIcone(alturaDoBotao(tamanho))} />
        ) : null}
        {/* Encolhe e quebra a linha em vez de empurrar o ícone para fora do botão. */}
        <Texto variante="botao" style={{ color: aparencia.texto, flexShrink: 1 }} centralizado>
          {titulo}
        </Texto>
      </Pressable>
      {mostrarMotivo && !idDoMotivoNaBarra ? (
        <Texto
          variante="legenda"
          cor="textoSuave"
          nativeID={idDoMotivo}
          style={{ marginTop: ESPACO.e6 }}
        >
          {motivo}
        </Texto>
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
  /** Circular (raio 22): o voltar e as ações do cabeçalho. */
  circular?: boolean
  /** 44 por padrão; 48 na barra de ação; 56 nos controles do Ao vivo (ícone de 24). */
  lado?: number
  ref?: Ref<NoDeView>
}

/**
 * Botão de ícone (44×44, fundo tonal): voltar, mais ações, subir e descer.
 * Com `texto`, a mesma altura e o texto visível ao lado (ou embaixo) do ícone;
 * a largura segue o texto.
 */
export function BotaoIcone({
  icone,
  rotulo,
  texto,
  disposicao = 'lado',
  aoPressionar,
  dica,
  desabilitado = false,
  circular = false,
  lado = ALTURA.iconeSo,
  ref,
}: PropsDoBotaoIcone) {
  const { cores, solido } = useTema()
  const { reduzirTransparencia, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const anel = useAnelDeFoco(cores.foco)
  const fundo = reduzirTransparencia ? cores.tonalOpaco : solido(cores.tonal)
  const cor = desabilitado ? comOpacidade(cores.texto, ALFA_DESABILITADO) : cores.texto
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={dica}
      aria-disabled={desabilitado}
      disabled={desabilitado}
      onPress={aoPressionar}
      onFocus={anel.onFocus}
      onBlur={anel.onBlur}
      ref={ref}
      hitSlop={Math.max(0, (ALVO - lado) / 2)}
      style={({ pressed }) => [
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
          borderRadius: circular ? lado / 2 : RAIO.controle,
          backgroundColor: fundo,
          borderWidth: aumentarContraste ? 2 : 0,
          borderColor: aumentarContraste ? cores.texto : 'transparent',
        },
        // Pressionado: a camada `pressionado` sobre o tonal.
        // Com texto o botão é mais largo que alto: o anel interno cobre a largura toda.
        pressed
          ? { boxShadow: `inset 0px 0px 0px ${texto ? 200 : lado}px ${cores.pressionado}` }
          : null,
        anel.estilo,
      ]}
    >
      <Icone nome={icone} cor={cor} tamanho={ladoDoIcone(lado)} peso="semibold" />
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
  )
}

/** Botões que dividem a linha (barra de ação): largura total e padding 6, como no par. */
export function EmPar({ children }: { children: ReactNode }) {
  return <ContextoDoPar.Provider value>{children}</ContextoDoPar.Provider>
}

/**
 * Até 2 botões lado a lado, cada um com `flex: 1` e intervalo de 10 (M). Com
 * fonte grande (`fontScale` de 1,35 ou mais), viram coluna. Com
 * `larguraMinima` (a de cada botão, na fonte padrão), também viram coluna
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
  const metade = largura === null ? null : (largura - ESPACO.e10) / 2
  const naoCabe =
    larguraMinima !== undefined &&
    itens.length > 1 &&
    (metade === null || metade < larguraMinima * fontScale)
  const coluna = fontScale >= 1.35 || naoCabe
  return (
    <ContextoDoPar.Provider value>
      <View
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
        style={{ flexDirection: coluna ? 'column' : 'row', gap: ESPACO.e10 }}
      >
        {itens.map((filho, i) => (
          <View key={i} style={coluna ? { alignSelf: 'stretch' } : { flex: 1 }}>
            {filho}
          </View>
        ))}
      </View>
    </ContextoDoPar.Provider>
  )
}
