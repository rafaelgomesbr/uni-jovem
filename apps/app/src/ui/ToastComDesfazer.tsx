import { ALVO_MINIMO, DESFAZER, ESPACO, RAIO, TOAST } from '@uj/tokens'
import * as Roteador from 'expo-router'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { AccessibilityInfo, AppState, Platform, Pressable, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { marcarDescarga } from '@/servicos/descarga'
import { ehErroDaApi, SemConexao } from '@/servicos/erros'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { anunciar } from './anunciar'
import { useRevelar } from './primitivasDeMovimento'
import { sombra, useTema } from './tema'
import { Texto } from './Texto'

export interface PedidoDeDesfazer {
  /** O verbo no presente, o número de pessoas: "Publicando e avisando 11 pessoas." */
  texto: string
  /**
   * O envio de verdade. Roda quando a contagem chega a zero, quando outro toast com Desfazer
   * chega, quando a pessoa sai da tela, quando o app vai para segundo plano ou a página web é
   * fechada: a ação pendente nunca se perde em silêncio (D74). Roda no máximo uma vez por
   * pedido. Devolva a promessa: se ela falhar por rede ou servidor, o envio é repetido sozinho e,
   * esgotadas as tentativas, a faixa vira "Tentar de novo" e fica até a pessoa tocar.
   */
  aoConfirmar: () => void | Promise<unknown>
  /** A pessoa tocou em "Desfazer": volte a tela ao estado anterior. `aoConfirmar` não roda. */
  aoDesfazer?: () => void
  /**
   * Quanto tempo a pessoa tem (10 s por padrão: WCAG 2.2.1 e o catálogo de interação 5.2). Com
   * leitor de tela ligado o tempo dobra (10 vira 20), como no toast comum: ele precisa ler antes.
   * Todo texto que cita o tempo usa `segundosDaEsperaAgora` ou `useSegundosDoDesfazer`, nunca um
   * número escrito à mão.
   */
  segundos?: number
  /** "Tentar de novo" numa falha de ação; "Desfazer" no resto. */
  rotuloDoBotao?: string
  /** O que a faixa diz se o envio não passar depois das novas tentativas. */
  textoDaFalha?: string
  /** O envio falhou de vez (antes da faixa de falha): desfaça o que a tela mostrou como feito. */
  aoFalhar?: () => void
  /**
   * A própria ação leva a pessoa a outra tela logo depois de pedir (ex.: "Adiar" volta ao
   * encontro): essa primeira navegação não envia na hora. Qualquer outra, sim.
   */
  seguePeloCaminho?: boolean
}

interface Pendente {
  id: number
  texto: string
  rotuloDoBotao: string
  total: number
  restante: number
  /** O tempo pedido, sem a extensão do leitor de tela. */
  base: number
  /** O tempo já foi estendido para o leitor de tela? */
  estendido: boolean
  /** Sem contagem: é a faixa de falha, que fica até a pessoa tocar, sair ou chegar outro pedido. */
  fixo: boolean
  seguePeloCaminho: boolean
  textoDaFalha: string | undefined
  aoFalhar: (() => void) | undefined
  aoConfirmar: () => void | Promise<unknown>
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
let leitorDeTela = false
let vigiaDoLeitorIniciada = false
/** Falhas que chegaram com outro pedido em curso: a faixa de cada uma espera a sua vez. */
const filaDeFalhas: Pendente[] = []
let substituindo = false
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((o) => o())

/** Esperas entre as novas tentativas de um envio que falhou por rede ou servidor. */
export const ESPERAS_ENTRE_TENTATIVAS_MS: readonly number[] = [2000, 6000]

function parar() {
  if (relogio) clearInterval(relogio)
  relogio = null
}

/** Rede fora ou servidor com problema: vale repetir. Recusa do servidor (4xx) repetiria igual. */
function valeRepetir(erro: unknown): boolean {
  return erro instanceof SemConexao || (ehErroDaApi(erro) && erro.status >= 500)
}

/**
 * Faz o envio e repete se a rede ou o servidor falharem. A primeira chamada é síncrona (o envio
 * sai na hora do toque, do fim da contagem ou da saída da tela). Falha de vez: a faixa de falha.
 */
async function enviar(p: Pendente): Promise<void> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      await p.aoConfirmar()
      return
    } catch (erro) {
      const espera = ESPERAS_ENTRE_TENTATIVAS_MS[tentativa]
      if (espera === undefined || !valeRepetir(erro)) {
        p.aoFalhar?.()
        mostrarFalha(p)
        return
      }
      await new Promise((resolver) => setTimeout(resolver, espera))
    }
  }
}

/** A faixa de falha: sem contagem, "Tentar de novo". Sair ou trocar de pedido repete o envio. */
function mostrarFalha(original: Pendente) {
  const tentarOutraVez = () => void enviar(original)
  const falha: Pendente = {
    id: proximoId++,
    texto:
      original.textoDaFalha ??
      'Não deu para enviar agora. Nada se perdeu: toque em Tentar de novo.',
    rotuloDoBotao: 'Tentar de novo',
    total: 0,
    restante: 0,
    base: 0,
    estendido: false,
    fixo: true,
    seguePeloCaminho: false,
    textoDaFalha: original.textoDaFalha,
    aoFalhar: undefined,
    aoConfirmar: tentarOutraVez,
    aoDesfazer: tentarOutraVez,
  }
  if (pendente) filaDeFalhas.push(falha)
  else abrir(falha)
}

function abrir(p: Pendente) {
  pendente = p
  parar()
  if (!p.fixo) relogio = setInterval(passar, 1000)
  vigiarOApp()
  vigiarOLeitorDeTela()
  avisar()
}

/** Fecha o pendente UMA vez: zera o estado antes de chamar o callback, então nada se repete. */
function finalizar(como: 'confirmar' | 'desfazer') {
  const p = pendente
  if (!p) return
  pendente = null
  parar()
  avisar()
  if (como === 'confirmar') void enviar(p)
  else p.aoDesfazer?.()
  // A próxima faixa de falha, se houve alguma enquanto este pedido estava no ar.
  if (!substituindo && !pendente) {
    const proxima = filaDeFalhas.shift()
    if (proxima) abrir(proxima)
  }
}

function passar() {
  if (!pendente) return
  pendente = { ...pendente, restante: pendente.restante - 1 }
  if (pendente.restante <= 0) finalizar('confirmar')
  else avisar()
}

/** O tempo da espera: o dobro com leitor de tela (WCAG 2.2.1; o toast comum faz o mesmo). */
export function segundosDoDesfazer(segundos: number, comLeitorDeTela: boolean): number {
  return comLeitorDeTela ? segundos * 2 : segundos
}

/**
 * Lê se o leitor de tela está ligado e acompanha as mudanças. O valor é guardado: `mostrarDesfazer`
 * é síncrona e precisa dele na hora. Se a resposta chega depois de a espera começar (primeiro uso
 * do app), a espera em curso é estendida.
 */
function vigiarOLeitorDeTela() {
  void AccessibilityInfo.isScreenReaderEnabled()
    .catch(() => false)
    .then(definirLeitorDeTela)
  if (vigiaDoLeitorIniciada) return
  vigiaDoLeitorIniciada = true
  AccessibilityInfo.addEventListener('screenReaderChanged', definirLeitorDeTela)
}

function definirLeitorDeTela(ligado: boolean) {
  const mudou = leitorDeTela !== ligado
  leitorDeTela = ligado
  if (ligado && pendente && !pendente.estendido && !pendente.fixo) {
    const total = segundosDoDesfazer(pendente.base, true)
    pendente = {
      ...pendente,
      total,
      restante: pendente.restante + (total - pendente.total),
      estendido: true,
    }
    avisar()
  } else if (mudou) {
    // Os textos que citam "10 segundos" passam a dizer o tempo de verdade.
    avisar()
  }
}

/**
 * Quantos segundos a pessoa tem de verdade AGORA: o tempo pedido (10 por padrão), dobrado com
 * leitor de tela. É o número que a faixa conta; todo texto de folha, botão e dica usa este mesmo
 * (antes a folha dizia 10 s e a faixa contava 20 s).
 */
export function segundosDaEsperaAgora(base: number = DESFAZER.segundos): number {
  return segundosDoDesfazer(base, leitorDeTela)
}

/** O mesmo número, para a tela que o escreve: acompanha o leitor de tela ligar ou desligar. */
export function useSegundosDoDesfazer(base: number = DESFAZER.segundos): number {
  return useSyncExternalStore(
    assinar,
    () => segundosDoDesfazer(base, leitorDeTela),
    () => base,
  )
}

/** "Você tem 10 segundos para desfazer." (ou 20, com leitor de tela). */
export function frasePraDesfazer(segundos: number): string {
  return `Você tem ${segundos} segundos para desfazer.`
}

/** Quantos segundos faltam na contagem em curso (ou `null` sem contagem): botões dizem "em 7 s". */
export function useRestanteDoDesfazer(): number | null {
  return useSyncExternalStore(
    assinar,
    () => (pendente && !pendente.fixo ? pendente.restante : null),
    () => null,
  )
}

/** Para a raiz do app: já deixa o estado do leitor de tela à mão antes do primeiro Desfazer. */
export function conhecerOLeitorDeTela(): void {
  vigiarOLeitorDeTela()
}

/**
 * Mostra o toast com Desfazer e a contagem regressiva (10 s, 20 com leitor de tela). O ato já aparece feito na
 * tela; o envio (`aoConfirmar`) só sai ao fim. Um segundo `mostrarDesfazer` com o primeiro
 * ainda em contagem CONFIRMA o primeiro (nunca se perde um envio) e começa o novo.
 */
export function mostrarDesfazer(pedido: PedidoDeDesfazer): void {
  if (pendente) {
    substituindo = true
    try {
      finalizar('confirmar')
    } finally {
      substituindo = false
    }
  }
  const base = pedido.segundos ?? DESFAZER.segundos
  const total = segundosDoDesfazer(base, leitorDeTela)
  abrir({
    id: proximoId++,
    texto: pedido.texto,
    rotuloDoBotao: pedido.rotuloDoBotao ?? 'Desfazer',
    total,
    restante: total,
    base,
    estendido: leitorDeTela,
    fixo: false,
    seguePeloCaminho: pedido.seguePeloCaminho ?? false,
    textoDaFalha: pedido.textoDaFalha,
    aoFalhar: pedido.aoFalhar,
    aoConfirmar: pedido.aoConfirmar,
    aoDesfazer: pedido.aoDesfazer,
  })
}

/** A pessoa tocou em "Desfazer". Para testes e para telas que desfazem por outro caminho. */
export function desfazerAgora(): void {
  finalizar('desfazer')
}

/** Envia já (a pessoa saiu da tela, trocou de comunidade). Sem pendente, não faz nada. */
export function confirmarAgora(): void {
  finalizar('confirmar')
}

/** Só para os testes: zera a espera, a fila de falhas e o relógio, sem enviar nada. */
export function reiniciarDesfazer(): void {
  pendente = null
  filaDeFalhas.length = 0
  substituindo = false
  parar()
  avisar()
}

/** Há uma espera em curso? */
export function haDesfazerPendente(): boolean {
  return pendente !== null
}

/**
 * O envio pendente sai na hora (a pessoa já decidiu) quando o app vai para segundo plano ou a
 * página web é fechada. Se o app for encerrado à força antes disso, o que não saiu não saiu:
 * por isso a contagem é curta e o estado da tela diz "ainda não enviado". Uma vigia para o app todo.
 */
function vigiarOApp() {
  if (vigiaDoAppIniciada) return
  vigiaDoAppIniciada = true
  AppState.addEventListener('change', aoMudarEstadoDoApp)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // `pagehide` cobre fechar a aba e navegar para outro site; `beforeunload`, os navegadores antigos.
    window.addEventListener('pagehide', aoFecharAPagina)
    window.addEventListener('beforeunload', aoFecharAPagina)
  }
}

/** O que a vigia faz com cada estado do app: só o segundo plano envia. */
export function aoMudarEstadoDoApp(estado: string): void {
  if (estado === 'background') confirmarAgora()
}

/** A página web vai sumir: os pedidos feitos agora sobrevivem ao fechamento (`keepalive`). */
export function aoFecharAPagina(): void {
  marcarDescarga()
  confirmarAgora()
}

function assinar(o: () => void) {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}
const ler = () => pendente

/**
 * O caminho da tela, para saber que a pessoa navegou. Escolhido uma vez ao carregar o módulo (o
 * Hook que roda é sempre o mesmo); onde não há roteador (testes isolados), nunca muda.
 */
const useCaminho: () => string | null =
  typeof Roteador.usePathname === 'function' ? Roteador.usePathname : () => null

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

  // Sair da tela com a ação pendente envia na hora (D74): a pessoa decidiu e foi adiante.
  const caminho = useCaminho()
  const caminhoDeAgora = useRef(caminho)
  const jaSeguiu = useRef(false)
  useEffect(() => {
    if (caminho === caminhoDeAgora.current) return
    if (p.seguePeloCaminho && !jaSeguiu.current) {
      // A própria ação levou a pessoa para outra tela: esta é a tela de onde ela segue.
      jaSeguiu.current = true
      caminhoDeAgora.current = caminho
      return
    }
    confirmarAgora()
  }, [caminho, p.seguePeloCaminho])

  // O anúncio e a barra são sistemas externos: começam ao montar (um toast novo é outra caixa).
  useEffect(() => {
    anunciar(
      p.fixo
        ? `${p.texto} Toque em ${p.rotuloDoBotao}.`
        : `${p.texto} ${DESFAZER.anuncio(p.total)}`,
    )
  }, [p.texto, p.total, p.fixo, p.rotuloDoBotao])
  useEffect(() => {
    if (reduzirMovimento || p.fixo) return
    barra.set(
      withTiming(0, {
        duration: p.total * 1000,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
    )
    return () => cancelAnimation(barra)
  }, [reduzirMovimento, p.fixo, p.total, barra])

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
      {p.fixo ? null : (
        <Texto
          variante="legenda"
          tabular
          accessible={false}
          importantForAccessibility="no"
          style={{ color: TOAST.textoSuave }}
        >
          {`${p.restante} s`}
        </Texto>
      )}
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
      {reduzirMovimento || p.fixo ? null : (
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
