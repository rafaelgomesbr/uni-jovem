import { ALTURA, AURORA, DURACAO, ESPACO, RITMO } from '@uj/tokens'
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
import { fimComBarraDeAcao } from './BarraDeAcao'
import { BotaoDeSaida, CabecalhoDeTela, voltar } from './CabecalhoDeTela'
import type { NoDeTexto } from './foco'
import { FundoAurora } from './FundoAurora'
import { Texto } from './Texto'
import { sombra, useTema } from './tema'
import { Vidro } from './Vidro'

/**
 * Altura que a barra de abas flutuante ocupa no fim da tela (0 fora das abas).
 * A barra fica por cima do conteúdo; a tela reserva esse espaço no fim da rolagem.
 */
export const ContextoDaBarraDeAbas = createContext(0)

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
}: PropsDaTela) {
  const { cores } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const margens = useSafeAreaInsets()
  const espacoDaBarra = useContext(ContextoDaBarraDeAbas)
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null)
  const [fimDoTitulo, setFimDoTitulo] = useState<number | null>(null)
  const [compacto, setCompacto] = useState(false)
  // Altura real da barra de ação: com fonte grande o botão cresce, e o ao vivo usa controles de 56.
  const [alturaDaBarraDeAcao, setAlturaDaBarraDeAcao] = useState(0)
  const alturaDoCompacto = margens.top + 52

  const temCabecalho = !semCabecalho && !!(titulo || topo || pilha || passos)
  const intensidade = aurora ?? (pilha ? AURORA.intensidadeNaPilha : 1)
  // Com barra de ação, o último bloco precisa rolar até 16 acima dela.
  const fim = barraDeAcao
    ? Math.max(fimComBarraDeAcao(margens.bottom), alturaDaBarraDeAcao + ESPACO.e16)
    : espacoDaBarra > 0
      ? Math.max(RITMO.fimDasAbas, espacoDaBarra + ESPACO.e16)
      : margens.bottom + ESPACO.e24

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
    if (alvo !== null) rolagem.current?.scrollTo({ y: alvo, animated: !reduzirMovimento })
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
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
            // Sem inércia, o dedo soltou e a rolagem parou ali; com inércia, espera ela acabar.
            onScrollEndDrag={(e) => {
              if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) {
                assentar(e.nativeEvent.contentOffset.y)
              }
            }}
            onMomentumScrollEnd={(e) => assentar(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            contentContainerStyle={[{ flexGrow: 1 }, preenchimento]}
          >
            <FundoAurora intensidade={intensidade} />
            {conteudo}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, preenchimento]}>
            <FundoAurora intensidade={intensidade} />
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
            {barraDeAcao}
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
      <Vidro borda="baixo" style={[{ flex: 1 }, sombra(elevacao.flutuante)]}>
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
