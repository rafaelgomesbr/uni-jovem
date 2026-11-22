import { ALVO_MINIMO, DESFAZER, ESPACO, RAIO, TOAST } from '@uj/tokens'
import { useEffect, useSyncExternalStore } from 'react'
import { AppState, Platform, Pressable, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { anunciar } from './anunciar'
import { useRevelar } from './primitivasDeMovimento'
import { sombra, useTema } from './tema'
import { Texto } from './Texto'

export interface PedidoDeDesfazer {
  /** O verbo no presente, o número de pessoas: "Publicando e avisando 11 pessoas." */
  texto: string
  /**
   * O envio de verdade. Só roda quando a contagem chega a zero, ou quando outro toast com
   * Desfazer chega, ou quando o app vai para segundo plano. Roda no máximo uma vez.
   */
  aoConfirmar: () => void
  /** A pessoa tocou em "Desfazer": volte a tela ao estado anterior. `aoConfirmar` não roda. */
  aoDesfazer?: () => void
  /** Quanto tempo a pessoa tem (10 s por padrão: WCAG 2.2.1 e o catálogo de interação 5.2). */
  segundos?: number
  /** "Tentar de novo" numa falha de ação; "Desfazer" no resto. */
  rotuloDoBotao?: string
}

interface Pendente {
  id: number
  texto: string
  rotuloDoBotao: string
  total: number
  restante: number
  aoConfirmar: () => void
  aoDesfazer: (() => void) | undefined
}

/*
 * A espera do envio é um armazenamento externo à árvore (como a fila de toasts): qualquer
 * tela chama `mostrarDesfazer`, o hospedeiro na raiz desenha. Um só pendente por vez.
 */
let pendente: Pendente | null = null
let proximoId = 1
let relogio: ReturnType<typeof setInterval> | null = null
let vigiaDoAppIniciada = false
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((o) => o())

function parar() {
  if (relogio) clearInterval(relogio)
  relogio = null
}

/** Fecha o pendente UMA vez: zera o estado antes de chamar o callback, então nada se repete. */
function finalizar(como: 'confirmar' | 'desfazer') {
  const p = pendente
  if (!p) return
  pendente = null
  parar()
  avisar()
  if (como === 'confirmar') p.aoConfirmar()
  else p.aoDesfazer?.()
}

function passar() {
  if (!pendente) return
  pendente = { ...pendente, restante: pendente.restante - 1 }
  if (pendente.restante <= 0) finalizar('confirmar')
  else avisar()
}

/**
 * Mostra o toast com Desfazer e a contagem regressiva (10 s). O ato já aparece feito na
 * tela; o envio (`aoConfirmar`) só sai ao fim. Um segundo `mostrarDesfazer` com o primeiro
 * ainda em contagem CONFIRMA o primeiro (nunca se perde um envio) e começa o novo.
 */
export function mostrarDesfazer(pedido: PedidoDeDesfazer): void {
  if (pendente) finalizar('confirmar')
  const total = pedido.segundos ?? DESFAZER.segundos
  pendente = {
    id: proximoId++,
    texto: pedido.texto,
    rotuloDoBotao: pedido.rotuloDoBotao ?? 'Desfazer',
    total,
    restante: total,
    aoConfirmar: pedido.aoConfirmar,
    aoDesfazer: pedido.aoDesfazer,
  }
  parar()
  relogio = setInterval(passar, 1000)
  vigiarOApp()
  avisar()
}

/** A pessoa tocou em "Desfazer". Para testes e para telas que desfazem por outro caminho. */
export function desfazerAgora(): void {
  finalizar('desfazer')
}

/** Envia já (a pessoa saiu da tela, trocou de comunidade). Sem pendente, não faz nada. */
export function confirmarAgora(): void {
  finalizar('confirmar')
}

/** Há uma espera em curso? */
export function haDesfazerPendente(): boolean {
  return pendente !== null
}

/**
 * Se o app for para segundo plano com a espera em curso, o envio sai (a pessoa decidiu). Se for
 * encerrado à força, nada foi enviado: o erro seguro é o de não enviar. Uma vigia para o app todo.
 */
function vigiarOApp() {
  if (vigiaDoAppIniciada) return
  vigiaDoAppIniciada = true
  AppState.addEventListener('change', aoMudarEstadoDoApp)
}

/** O que a vigia faz com cada estado do app: só o segundo plano confirma. */
export function aoMudarEstadoDoApp(estado: string): void {
  if (estado === 'background') confirmarAgora()
}

function assinar(o: () => void) {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}
const ler = () => pendente

/** O pendente de agora (ou `null`), para o hospedeiro desenhar. */
export function useDesfazerPendente(): Pendente | null {
  return useSyncExternalStore(assinar, ler, ler)
}

/**
 * O toast: cápsula de raio 20 em `toastFundo` (sempre escuro, texto claro), com o texto, a
 * contagem em número ("10 s"), o botão "Desfazer" de 44 por 44 no mínimo em `acao` e a barra
 * fina de 3 pt no rodapé que encolhe por 10 s, linear. O número é o equivalente da barra: com
 * Reduzir movimento a barra some e o número continua. É uma região `status` anunciada uma
 * vez ("Desfazer disponível por 10 segundos"); o foco nunca é roubado.
 */
export function CaixaDoDesfazer({ pendente: p }: { pendente: Pendente }) {
  const { cores, elevacao } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const entrada = useRevelar(true)
  const barra = useSharedValue(1)

  // O anúncio e a barra são sistemas externos: começam ao montar (um toast novo é outra caixa).
  useEffect(() => {
    anunciar(`${p.texto} ${DESFAZER.anuncio(p.total)}`)
  }, [p.texto, p.total])
  useEffect(() => {
    if (reduzirMovimento) return
    barra.set(
      withTiming(0, {
        duration: p.total * 1000,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
    )
    return () => cancelAnimation(barra)
  }, [reduzirMovimento, p.total, barra])

  const estiloDaBarra = useAnimatedStyle(() => ({
    transform: [{ scaleX: barra.value }],
  }))

  return (
    <Animated.View
      testID="toast-com-desfazer"
      role="status"
      accessibilityLiveRegion="polite"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e8,
          minHeight: 52,
          paddingVertical: ESPACO.e6,
          paddingLeft: ESPACO.e16,
          paddingRight: ESPACO.e6,
          borderRadius: RAIO.medio,
          overflow: 'hidden',
          backgroundColor: cores.toastFundo,
        },
        sombra(elevacao.flutuante),
        entrada,
      ]}
    >
      <Texto
        variante="meta"
        style={{ flex: 1, paddingVertical: ESPACO.e6, color: TOAST.texto, lineHeight: 22 }}
      >
        {p.texto}
      </Texto>
      <Texto
        variante="legenda"
        tabular
        accessible={false}
        importantForAccessibility="no"
        style={{ color: TOAST.textoSuave }}
      >
        {`${p.restante} s`}
      </Texto>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={p.rotuloDoBotao}
        onPress={desfazerAgora}
        style={({ pressed }) => ({
          minWidth: ALVO_MINIMO.ios,
          minHeight: Platform.OS === 'android' ? ALVO_MINIMO.android : ALVO_MINIMO.ios,
          paddingHorizontal: ESPACO.e14,
          borderRadius: RAIO.pilula,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
        })}
      >
        <Texto variante="botao" peso="forte" style={{ color: TOAST.acao, fontWeight: '700' }}>
          {p.rotuloDoBotao}
        </Texto>
      </Pressable>
      {reduzirMovimento ? null : (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 }}
        >
          <Animated.View
            testID="toast-barra"
            style={[
              {
                height: 3,
                backgroundColor: TOAST.acao,
                transformOrigin: ['0%', '50%', 0],
              },
              estiloDaBarra,
            ]}
          />
        </View>
      )}
    </Animated.View>
  )
}
