import { DURACAO, ESPACO, MOVIMENTO_DAS_TELAS, RAIO, type NomeDoPapel, TIPO } from '@uj/tokens'
import { QueryClientContext } from '@tanstack/react-query'
import { useContext, useEffect, useState, type ReactNode } from 'react'
import { Animated, Platform, View, type DimensionValue } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { Botao } from './Botao'
import { Texto } from './Texto'
import { useAnunciar } from './useAnunciar'
import { useTema } from './tema'

/**
 * Depois deste tempo carregando, a tela ganha "Tentar de novo" (D58). É menor
 * que o tempo até o erro de verdade (12 s por pedido mais uma nova tentativa),
 * para ninguém ficar olhando blocos cinzas sem saída.
 */
export const DEMORA_DO_ESQUELETO_MS = 10_000
export const AVISO_DE_DEMORA = 'Está demorando mais que o normal. Confira sua conexão.'

interface PropsDoEsqueleto {
  /** "Carregando a agenda": o que o leitor de tela ouve. Os blocos ficam ocultos para ele. */
  rotulo: string
  children: ReactNode
  /**
   * O que "Tentar de novo" faz quando a carga demora. Sem ele, refaz as
   * consultas que ainda estão carregando pela primeira vez (React Query).
   */
  aoTentarDeNovo?: () => void
}

/**
 * Esqueleto de carregamento (seção 2.12.22 e 8.5 da direção A): blocos na cor `esqueleto` com
 * pulso de 1,0 a 0,5 em 1200 ms (estático com "Reduzir movimento"). Só
 * aparece depois de 300 ms, para não piscar em carga rápida. O indicador
 * giratório fica só dentro de botões.
 */
export function Esqueleto({ rotulo, children, aoTentarDeNovo }: PropsDoEsqueleto) {
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const [visivel, setVisivel] = useState(false)
  const [pulso] = useState(() => new Animated.Value(1))
  const [entrada] = useState(() => new Animated.Value(0))
  const consultas = useContext(QueryClientContext)
  const [demorou, setDemorou] = useState(false)
  // Cada "Tentar de novo" recomeça a contagem da demora.
  const [rodada, setRodada] = useState(0)

  // O atraso e o pulso são relógios externos à tela: começam ao montar e param ao sair.
  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), DURACAO.atrasoDoEsqueleto)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setDemorou(true), DEMORA_DO_ESQUELETO_MS)
    return () => clearTimeout(t)
  }, [rodada])
  // Ao aparecer, o esqueleto dissolve (160 ms; 120 com Reduzir movimento).
  useEffect(() => {
    if (!visivel) return
    const dissolve = Animated.timing(entrada, {
      toValue: 1,
      duration: reduzirMovimento
        ? MOVIMENTO_DAS_TELAS.dissolver
        : MOVIMENTO_DAS_TELAS.esqueleto.aparece,
      useNativeDriver: Platform.OS !== 'web',
    })
    dissolve.start()
    return () => dissolve.stop()
  }, [visivel, reduzirMovimento, entrada])
  useEffect(() => {
    if (!visivel || reduzirMovimento) return
    const metade = DURACAO.pulso / 2
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: MOVIMENTO_DAS_TELAS.esqueleto.opacidadeMinima,
          duration: metade,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulso, {
          toValue: 1,
          duration: metade,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    )
    laco.start()
    return () => laco.stop()
  }, [visivel, reduzirMovimento, pulso])

  function tentarDeNovo() {
    setDemorou(false)
    setRodada((r) => r + 1)
    if (aoTentarDeNovo) aoTentarDeNovo()
    else if (consultas) {
      // Cancela a espera atual antes de refazer: sem isso, o React Query devolve o mesmo
      // pedido pendurado em vez de começar outro.
      const carregando = {
        predicate: (q: { state: { status: string } }) => q.state.status === 'pending',
      }
      void consultas.cancelQueries(carregando).then(() => consultas.refetchQueries(carregando))
    }
  }

  return (
    <>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={rotulo}
        aria-busy
        style={{ gap: ESPACO.e16, alignSelf: 'stretch' }}
      >
        {visivel ? (
          <Animated.View
            style={{
              gap: ESPACO.e16,
              // O pulso é animação, não estado: a opacidade varia só enquanto carrega.
              // eslint-disable-next-line no-restricted-syntax
              opacity: reduzirMovimento ? entrada : Animated.multiply(entrada, pulso),
            }}
          >
            {children}
          </Animated.View>
        ) : null}
      </View>
      {/* Fora do bloco acessível acima: o leitor de tela precisa alcançar o botão. */}
      {demorou ? <AvisoDeDemora aoTentarDeNovo={tentarDeNovo} /> : null}
    </>
  )
}

/** "Está demorando": texto e botão de 44, anunciado ao aparecer. Nada de cor como único sinal. */
function AvisoDeDemora({ aoTentarDeNovo }: { aoTentarDeNovo: () => void }) {
  useAnunciar(AVISO_DE_DEMORA)
  return (
    <View style={{ gap: ESPACO.e12, alignItems: 'flex-start' }}>
      <Texto variante="corpo" cor="textoSuave">
        {AVISO_DE_DEMORA}
      </Texto>
      <Botao
        titulo="Tentar de novo"
        icone="sincronizar"
        variante="secundario"
        aoPressionar={aoTentarDeNovo}
      />
    </View>
  )
}

interface PropsDoBloco {
  largura?: DimensionValue
  altura: number
  raio?: number
  circulo?: boolean
}

/** Um bloco do esqueleto. */
export function BlocoDeEsqueleto({
  largura = '100%',
  altura,
  raio = RAIO.controle,
  circulo,
}: PropsDoBloco) {
  const { cores, solido } = useTema()
  return (
    <View
      style={{
        width: circulo ? altura : largura,
        height: altura,
        borderRadius: circulo ? altura / 2 : raio,
        backgroundColor: solido(cores.esqueleto),
      }}
    />
  )
}

/** Linhas de texto com 60% da entrelinha do papel, em larguras de 100%, 72% e 48%. */
export function LinhasDeEsqueleto({
  papel = 'corpo',
  linhas = 3,
}: {
  papel?: NomeDoPapel
  linhas?: number
}) {
  const altura = Math.round(TIPO[papel].altura * 0.6)
  const larguras: DimensionValue[] = ['100%', '72%', '48%']
  return (
    <View style={{ gap: TIPO[papel].altura - altura }}>
      {Array.from({ length: linhas }, (_, i) => (
        <BlocoDeEsqueleto key={i} largura={larguras[i % larguras.length]} altura={altura} />
      ))}
    </View>
  )
}

/**
 * Uma linha de lista carregando (72 pt, ou 64 ou 88): avatar redondo, duas linhas de texto e a
 * seta. Mesma forma e mesma altura do conteúdo final, para a tela não pular quando ele chegar.
 */
export function LinhaDeEsqueleto({ altura = 72 }: { altura?: 56 | 64 | 72 | 88 }) {
  return (
    <View
      style={{
        height: altura,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ESPACO.e12,
        paddingHorizontal: ESPACO.e16,
      }}
    >
      <BlocoDeEsqueleto circulo altura={44} />
      <View style={{ flex: 1, gap: ESPACO.e8 }}>
        <BlocoDeEsqueleto largura="56%" altura={14} />
        <BlocoDeEsqueleto largura="36%" altura={12} />
      </View>
    </View>
  )
}

/**
 * O esqueleto do cartão do momento: 262 pt, com a moldura apagada (a mesma forma do cartão
 * final: miolo de raio 28 e o sol de 72 no canto, sem texto). Pede o `Esqueleto` em volta.
 */
export function EsqueletoDoMomento() {
  const { cores } = useTema()
  return (
    <View
      style={{
        height: 262,
        borderRadius: RAIO.barra,
        borderWidth: 1.5,
        borderColor: cores.superficieBorda,
        padding: ESPACO.e20,
        gap: ESPACO.e12,
      }}
    >
      <BlocoDeEsqueleto largura="34%" altura={10} />
      <BlocoDeEsqueleto largura="62%" altura={26} />
      <BlocoDeEsqueleto largura="48%" altura={14} />
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: ESPACO.e12 }}>
        <View style={{ flex: 1 }}>
          <BlocoDeEsqueleto altura={48} raio={RAIO.pilula} />
        </View>
        <View style={{ flex: 1 }}>
          <BlocoDeEsqueleto altura={48} raio={RAIO.pilula} />
        </View>
      </View>
    </View>
  )
}

/** Cartão completo: raio 22, padding 18, sobrancelha e 3 linhas. */
export function CartaoDeEsqueleto({ titulo = false }: { titulo?: boolean }) {
  const { cores } = useTema()
  return (
    <View
      style={{
        padding: ESPACO.e18,
        borderRadius: RAIO.cartao,
        borderWidth: 1,
        borderColor: cores.superficieBorda,
        gap: ESPACO.e12,
      }}
    >
      <BlocoDeEsqueleto largura="36%" altura={10} />
      {titulo ? <BlocoDeEsqueleto largura="64%" altura={20} /> : null}
      <LinhasDeEsqueleto />
    </View>
  )
}
