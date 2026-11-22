import { ALTURA, AURORA, DURACAO, ESPACO, RITMO, type MomentoDoDia } from '@uj/tokens'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type Ref,
} from 'react'
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LARGURA_MAXIMA_DO_CONTEUDO, LARGURA_MAXIMA_LARGA } from '@/constantes'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import {
  baseDaBarraDeAcao,
  ContextoDaBarraFlutuanteEmbaixo,
  fimComBarraDeAcao,
} from './BarraDeAcao'
import { BotaoDeSaida, CabecalhoDeTela, voltar } from './CabecalhoDeTela'
import type { NoDeTexto } from './foco'
import { FundoAurora } from './FundoAurora'
import { LuzDeBase } from './LuzDeBase'
import { useTecladoAberto } from './teclado'
import { Texto } from './Texto'
import { sombra, useTema } from './tema'
import { Vidro } from './Vidro'

/**
 * Altura que a barra de abas flutuante ocupa no fim da tela: nas abas e nas
 * telas empilhadas que mostram a barra (D56); 0 nas exceções e fora do app.
 * A barra fica por cima do conteúdo; a tela reserva esse espaço no fim da rolagem.
 */
export const ContextoDaBarraDeAbas = createContext(0)

/**
 * Padding do fim da rolagem: o último bloco sempre rola até 16 acima do que
 * flutua embaixo. Com barra de ação, a altura dela (medida, porque o botão
 * cresce com a fonte), que já inclui a barra de abas flutuante quando esta
 * está embaixo (`barraFlutuante`, no lugar da área segura). Só com a barra
 * flutuante, 120 ou a barra mais 16. Sem nada, a área segura mais 24.
 */
export function fimDaTela({
  margemDeBaixo,
  barraFlutuante,
  barraDeAcao,
}: {
  margemDeBaixo: number
  barraFlutuante: number
  /** Altura medida da barra de ação (0 enquanto não mede); `null` sem barra de ação. */
  barraDeAcao: number | null
}): number {
  if (barraDeAcao !== null) {
    const base = baseDaBarraDeAcao(margemDeBaixo, barraFlutuante)
    return Math.max(fimComBarraDeAcao(base), barraDeAcao + ESPACO.e16)
  }
  if (barraFlutuante > 0) return Math.max(RITMO.fimDasAbas, barraFlutuante + ESPACO.e16)
  return margemDeBaixo + ESPACO.e24
}

/**
 * Onde a rolagem assenta quando para perto da troca de cabeçalho (como o
 * título grande do iOS): nunca no meio, com o título ou o primeiro bloco
 * cortado pela faixa do cabeçalho compacto. `limiar` é a rolagem em que o
 * título some por baixo dele. Até a metade, volta ao topo; depois, até o
 * primeiro bloco (16 de intervalo e um controle de 48) passar inteiro, vai
 * para logo depois do limiar: o cabeçalho compacto aparece e o primeiro bloco
 * fica 16 abaixo dele. Mais longe que isso, a rolagem fica onde está (`null`).
 */
export function pontoDeAssentar(y: number, limiar: number): number | null {
  if (limiar <= 0 || y <= 0) return null
  if (y >= limiar + RITMO.entreSecoes + ALTURA.controle) return null
  const alvo = y < limiar / 2 ? 0 : limiar + 1
  return Math.abs(alvo - y) < 1 ? null : alvo
}

/**
 * O dedo soltou sem inércia? Só com velocidade medida e quase zero. Onde o
 * evento não traz velocidade (web, parte do Android), a rolagem pode estar
 * prestes a deslizar: assentar aí brigaria com o gesto (o `scrollTo`
 * interrompe a inércia). Nesses casos quem assenta é o fim do momentum.
 */
export function soltouSemInercia(velocidade: number | undefined): boolean {
  return velocidade !== undefined && Math.abs(velocidade) < 0.05
}

interface PropsDaTela {
  children: ReactNode
  /** Raiz: `display` 34/38. Pilha: `tituloTela` 28/32. Anunciado como cabeçalho de nível 1. */
  titulo?: string
  descricao?: string
  /** Bloco próprio 8 abaixo do título (meta e chips do detalhe do evento). */
  abaixoDoTitulo?: ReactNode
  /** Tela de pilha: voltar circular de 44, título 28/32 e Aurora a 60%. */
  pilha?: boolean
  /** Pilha aberta como modal (`fullScreenModal`, `modal`): "Fechar" no lugar de "Voltar". */
  modal?: boolean
  /** Raiz de aba: a linha de 44 com a pílula e o status. */
  topo?: ReactNode
  /** Raiz: a mesma linha em versão compacta, no cabeçalho que aparece ao rolar. */
  topoCompacto?: ReactNode
  /** Raiz: só ícone à direita do título. */
  acaoDoTitulo?: ReactNode
  /** Pilha: ações de 44 à direita do voltar. */
  acoes?: ReactNode
  /** Pilha sem voltar (convite aberto pelo link). */
  semVoltar?: boolean
  passos?: { atual: number; total: number }
  rolar?: boolean
  /** Usa a largura de tela larga (lista e detalhe lado a lado na web). */
  larga?: boolean
  /** Para levar o foco ao título quando o conteúdo da tela troca (ver `useFocoAoMudar`). */
  refDoTitulo?: Ref<NoDeTexto>
  /** Rodapé fixo com a ação principal (`BarraDeAcao`). Sobe com o teclado. */
  barraDeAcao?: ReactNode
  /** Intensidade da Aurora: 1 na raiz e na entrada, 0,6 na pilha, 0 no Ao vivo. */
  aurora?: number
  /** A tela desenha o próprio topo (Entrar): sem cabeçalho e com o respiro de 40. */
  semCabecalho?: boolean
  /**
   * O momento do encontro que a tela mostra (`longe`, `vespera`, `dia`, `agora`, `fim`): o brilho
   * coral e a luz de base acompanham o relógio, junto da pose do sol no cartão do momento. Sem
   * ele, `longe` (a luz de base discreta).
   */
  momento?: MomentoDoDia
}

/**
 * Esqueleto de toda tela (seção 2.13): fundo Aurora rolando com o conteúdo,
 * margem lateral de 20, topo na área segura mais 8, intervalo de 16 entre
 * blocos, cabeçalho próprio (nunca o nativo), largura máxima de 720 na web e
 * o fim de 120 nas abas (24 de fundo, 64 de barra e 32 de folga).
 */
export function Tela({
  children,
  titulo,
  descricao,
  abaixoDoTitulo,
  pilha = false,
  modal = false,
  topo,
  topoCompacto,
  acaoDoTitulo,
  acoes,
  semVoltar,
  passos,
  rolar = true,
  larga = false,
  refDoTitulo,
  barraDeAcao,
  aurora,
  semCabecalho = false,
  momento = 'longe',
}: PropsDaTela) {
  const { cores } = useTema()
  const { reduzirMovimento, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const margens = useSafeAreaInsets()
  const espacoDaBarra = useContext(ContextoDaBarraDeAbas)
  const teclado = useTecladoAberto()
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null)
  // Último ponto para onde a tela mandou a rolagem sozinha (zera quando a pessoa toca de novo).
  const ultimoAssento = useRef<number | null>(null)
  const [fimDoTitulo, setFimDoTitulo] = useState<number | null>(null)
  const [compacto, setCompacto] = useState(false)
  // Altura real da barra de ação: com fonte grande o botão cresce, e o ao vivo usa controles de 56.
  const [alturaDaBarraDeAcao, setAlturaDaBarraDeAcao] = useState(0)
  const alturaDoCompacto = margens.top + 52

  const temCabecalho = !semCabecalho && !!(titulo || topo || pilha || passos)
  const intensidade = aurora ?? (pilha ? AURORA.intensidadeNaPilha : 1)
  // Com o teclado aberto a barra flutuante some, e a barra de ação volta a encostar no fim.
  const barraFlutuanteEmbaixo = barraDeAcao && !teclado ? espacoDaBarra : 0
  const fim = fimDaTela({
    margemDeBaixo: margens.bottom,
    barraFlutuante: barraDeAcao ? barraFlutuanteEmbaixo : espacoDaBarra,
    barraDeAcao: barraDeAcao ? alturaDaBarraDeAcao : null,
  })

  const cabecalho = temCabecalho ? (
    <View
      onLayout={(e: LayoutChangeEvent) =>
        setFimDoTitulo(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
      }
    >
      <CabecalhoDeTela
        tipo={pilha ? 'pilha' : 'raiz'}
        {...(titulo ? { titulo } : {})}
        {...(descricao ? { subtitulo: descricao } : {})}
        {...(abaixoDoTitulo ? { abaixoDoTitulo } : {})}
        {...(modal ? { modal } : {})}
        {...(topo ? { linhaDoTopo: topo } : {})}
        {...(acaoDoTitulo ? { acaoDoTitulo } : {})}
        {...(acoes ? { acoes } : {})}
        {...(semVoltar ? { semVoltar } : {})}
        {...(passos ? { passos } : {})}
        {...(refDoTitulo ? { refDoTitulo } : {})}
      />
    </View>
  ) : null

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
      {cabecalho}
      {children}
    </View>
  )

  const preenchimento = {
    paddingHorizontal: RITMO.margemDaTela,
    paddingTop: margens.top + (semCabecalho ? ESPACO.e40 : RITMO.topoDaTela),
    paddingBottom: fim,
  }

  function aoRolar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (fimDoTitulo === null || !titulo) return
    // O título "sai da tela" quando passa por baixo do cabeçalho compacto.
    const saiu =
      e.nativeEvent.contentOffset.y + alturaDoCompacto > fimDoTitulo + preenchimento.paddingTop
    if (saiu !== compacto) setCompacto(saiu)
  }

  // A rolagem parou: se foi no meio da troca de cabeçalho, termina a troca.
  function assentar(y: number) {
    if (fimDoTitulo === null || !titulo) return
    const alvo = pontoDeAssentar(y, fimDoTitulo + preenchimento.paddingTop - alturaDoCompacto)
    if (alvo === null) {
      ultimoAssento.current = null
      return
    }
    // O mesmo ponto pedido de novo sem a pessoa ter tocado: a rolagem não chegou lá (conteúdo
    // curto demais) e cada fim de rolagem pediria outra vez. Desiste em vez de repetir.
    if (ultimoAssento.current === alvo) return
    ultimoAssento.current = alvo
    rolagem.current?.scrollTo({ y: alvo, animated: !reduzirMovimento })
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cores.fundo,
        // O fundo desce do `fundo` para o `fundoProfundo` a partir da metade (direção A, D65).
        ...(aumentarContraste || intensidade <= 0
          ? {}
          : {
              backgroundImage: `linear-gradient(180deg, ${cores.fundo} 0%, ${cores.fundo} 55%, ${cores.fundoProfundo} 100%)`,
            }),
      }}
    >
      {intensidade > 0 ? <LuzDeBase momento={momento} /> : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {rolar ? (
          <ScrollView
            ref={rolagem}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
            onScroll={aoRolar}
            // Tocar de novo (inclusive para parar a rolagem) cancela o assentar automático.
            onScrollBeginDrag={() => {
              ultimoAssento.current = null
            }}
            // Sem inércia, o dedo soltou e a rolagem parou ali; com inércia, espera ela acabar.
            onScrollEndDrag={(e) => {
              if (soltouSemInercia(e.nativeEvent.velocity?.y)) {
                assentar(e.nativeEvent.contentOffset.y)
              }
            }}
            onMomentumScrollEnd={(e) => assentar(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            contentContainerStyle={[{ flexGrow: 1 }, preenchimento]}
          >
            <FundoAurora intensidade={intensidade} movimento="ambiente" momento={momento} />
            {conteudo}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, preenchimento]}>
            <FundoAurora intensidade={intensidade} movimento="ambiente" momento={momento} />
            {conteudo}
          </View>
        )}
        {barraDeAcao ? (
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
            onLayout={(e: LayoutChangeEvent) => {
              const altura = Math.ceil(e.nativeEvent.layout.height)
              if (altura !== alturaDaBarraDeAcao) setAlturaDaBarraDeAcao(altura)
            }}
          >
            <ContextoDaBarraFlutuanteEmbaixo.Provider value={barraFlutuanteEmbaixo}>
              {barraDeAcao}
            </ContextoDaBarraFlutuanteEmbaixo.Provider>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {compacto && titulo ? (
        <CabecalhoCompacto
          altura={alturaDoCompacto}
          topo={margens.top}
          pilha={pilha}
          titulo={titulo}
          topoCompacto={topoCompacto}
          semVoltar={!!semVoltar}
          modal={modal}
        />
      ) : null}
    </View>
  )
}

/**
 * Cabeçalho compacto (2.12.16): barra de vidro com a área segura mais 52 e
 * borda de baixo, que dissolve em 200 ms quando o título sai da tela
 * (instantâneo com "Reduzir movimento"). Raiz: pílula compacta e status;
 * pilha: voltar e o título em uma linha.
 */
function CabecalhoCompacto({
  altura,
  topo,
  pilha,
  titulo,
  topoCompacto,
  semVoltar,
  modal,
}: {
  altura: number
  topo: number
  pilha: boolean
  titulo: string
  topoCompacto: ReactNode
  semVoltar: boolean
  modal: boolean
}) {
  const { elevacao } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const [entrada] = useState(() => new Animated.Value(reduzirMovimento ? 1 : 0))
  // A animação é um sistema externo (o motor de animação): começa ao montar.
  useEffect(() => {
    if (reduzirMovimento) return
    const a = Animated.timing(entrada, {
      toValue: 1,
      duration: DURACAO.aparecer,
      useNativeDriver: Platform.OS !== 'web',
    })
    a.start()
    return () => a.stop()
  }, [entrada, reduzirMovimento])
  // Animação de entrada, não estado.
  // eslint-disable-next-line no-restricted-syntax
  const dissolver = { opacity: entrada }
  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: altura }, dissolver]}
    >
      <Vidro tipo="cabecalho" borda="baixo" style={[{ flex: 1 }, sombra(elevacao.flutuante)]}>
        <View
          style={{
            flex: 1,
            marginTop: topo,
            paddingHorizontal: RITMO.margemDaTela,
            flexDirection: 'row',
            alignItems: 'center',
            gap: ESPACO.e8,
            width: '100%',
            maxWidth: LARGURA_MAXIMA_DO_CONTEUDO + RITMO.margemDaTela * 2,
            alignSelf: 'center',
          }}
        >
          {pilha ? (
            <>
              {semVoltar ? (
                <View style={{ width: 44 }} />
              ) : (
                <BotaoDeSaida modal={modal} aoPressionar={voltar} />
              )}
              <Texto
                variante="tituloItem"
                numberOfLines={1}
                centralizado
                accessibilityRole="text"
                style={{ flex: 1 }}
              >
                {titulo}
              </Texto>
              <View style={{ width: 44 }} />
            </>
          ) : (
            <View style={{ flex: 1 }}>{topoCompacto}</View>
          )}
        </View>
      </Vidro>
    </Animated.View>
  )
}
