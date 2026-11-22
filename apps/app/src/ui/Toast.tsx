import { DURACAO, ESPACO, RAIO } from '@uj/tokens'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Platform, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { anunciar } from './anunciar'
import { Botao } from './Botao'
import { Icone, type NomeDoIcone } from './Icone'
import { Texto } from './Texto'
import { ProvedorDeTemaInverso, sombra, useTema } from './tema'
import { CaixaDoDesfazer, useDesfazerPendente } from './ToastComDesfazer'

export interface PedidoDeToast {
  texto: string
  tipo?: 'sucesso' | 'info' | 'erro'
  /** Ação terciária à direita ("Desfazer"). */
  acao?: { titulo: string; aoPressionar: () => void }
}

interface ToastNaFila extends PedidoDeToast {
  id: number
}

/**
 * Fila de toasts (um por vez) e o espaço que o rodapé ocupa: a barra de abas
 * ou a barra de ação registram a altura, e o toast aparece 12 acima delas.
 * É um armazenamento externo à árvore: qualquer tela pode chamar `mostrarToast`.
 */
let fila: ToastNaFila[] = []
let proximoId = 1
// Cada rodapé registrado (barra das abas, barra da pilha, barra de ação). Vale o mais alto:
// com a barra de ação acima da barra flutuante, as duas ficam registradas ao mesmo tempo, e
// a ordem em que os efeitos rodam não pode decidir onde o toast aparece.
const rodapes = new Map<number, number>()
let proximoRodape = 1
let rodape = 0
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((o) => o())

export function mostrarToast(pedido: PedidoDeToast): void {
  fila = [...fila, { ...pedido, id: proximoId++ }]
  avisar()
}

function tirarDaFila(id: number) {
  fila = fila.filter((t) => t.id !== id)
  avisar()
}

/**
 * A barra de abas e a barra de ação dizem quanto ocupam no fim da tela; a
 * função devolvida retira o registro. O toast fica acima do maior.
 */
export function registrarRodape(altura: number): () => void {
  const id = proximoRodape++
  rodapes.set(id, altura)
  rodape = Math.max(0, ...rodapes.values())
  avisar()
  return () => {
    rodapes.delete(id)
    rodape = Math.max(0, ...rodapes.values())
    avisar()
  }
}

/** Onde o toast se apoia agora (o maior rodapé registrado; 0 sem nenhum). */
export function rodapeDoToast(): number {
  return rodape
}

function assinar(o: () => void) {
  ouvintes.add(o)
  return () => {
    ouvintes.delete(o)
  }
}
const lerAtual = () => fila[0] ?? null
const lerRodape = () => rodape

/** Quanto fica na tela um toast com ação ("Desfazer"): tempo de ler e de alcançar o botão. */
export const DURACAO_COM_ACAO = 10_000

/**
 * 4 s, mais 1 s a cada 10 palavras. Com ação ("Desfazer"), no mínimo 10 s:
 * quem lê devagar, com fila na porta, ainda alcança o botão (auditoria U-13,
 * WCAG 2.2.1). Com leitor de tela ligado, o dobro (ele precisa ler).
 */
export function duracaoDoToast(texto: string, leitorDeTela = false, comAcao = false): number {
  const palavras = texto.trim().split(/\s+/).length
  const lido = 4000 + Math.floor(palavras / 10) * 1000
  const base = comAcao ? Math.max(DURACAO_COM_ACAO, lido) : lido
  return leitorDeTela ? base * 2 : base
}

const ICONE: Record<NonNullable<PedidoDeToast['tipo']>, NomeDoIcone> = {
  sucesso: 'avisoSucesso',
  info: 'avisoInfo',
  erro: 'avisoErro',
}

/**
 * Toast (seção 2.12.24 e 8.6 da direção A): escuro nos dois temas, raio 20, sombra flutuante, a 16 das
 * laterais e 12 acima do rodapé. Sobe 8 e aparece em 200 ms (só dissolve com
 * "Reduzir movimento"). Para confirmações transitórias; erro que pede ação
 * não vai em toast. Montado uma vez na raiz.
 */
export function HospedeiroDeToast() {
  const atual = useSyncExternalStore(assinar, lerAtual, lerAtual)
  const espaco = useSyncExternalStore(assinar, lerRodape, lerRodape)
  const comDesfazer = useDesfazerPendente()
  const margens = useSafeAreaInsets()
  if (!atual && !comDesfazer) return null
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: ESPACO.e16,
        right: ESPACO.e16,
        bottom: (espaco || margens.bottom + ESPACO.e16) + ESPACO.e12,
        gap: ESPACO.e8,
      }}
    >
      {comDesfazer ? <CaixaDoDesfazer key={comDesfazer.id} pendente={comDesfazer} /> : null}
      {atual ? (
        <ProvedorDoToast>
          <CaixaDoToast key={atual.id} toast={atual} />
        </ProvedorDoToast>
      ) : null}
    </View>
  )
}

/**
 * O toast é sempre escuro (direção A, D65): no tema escuro vale a paleta base, no claro a
 * inversa (índigo). Nos dois, o texto é claro.
 */
function ProvedorDoToast({ children }: { children: ReactNode }) {
  const { nome } = useTema()
  return nome === 'claro' ? <ProvedorDeTemaInverso>{children}</ProvedorDeTemaInverso> : children
}

function CaixaDoToast({ toast }: { toast: ToastNaFila }) {
  const { cores, elevacao, inverso } = useTema()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
  const [entrada] = useState(() => new Animated.Value(0))
  const tipo = toast.tipo ?? 'sucesso'
  const comAcao = !!toast.acao

  // Relógio e animação são sistemas externos: começam ao montar e param ao sair.
  useEffect(() => {
    let vivo = true
    let relogio: ReturnType<typeof setTimeout> | undefined
    anunciar(toast.texto)
    const animacao = Animated.timing(entrada, {
      toValue: 1,
      duration: reduzirMovimento ? DURACAO.aparecerReduzido : DURACAO.aparecer,
      useNativeDriver: Platform.OS !== 'web',
    })
    animacao.start()
    void AccessibilityInfo.isScreenReaderEnabled()
      .catch(() => false)
      .then((leitor) => {
        if (vivo)
          relogio = setTimeout(
            () => tirarDaFila(toast.id),
            duracaoDoToast(toast.texto, leitor, comAcao),
          )
      })
    return () => {
      vivo = false
      animacao.stop()
      if (relogio) clearTimeout(relogio)
    }
  }, [entrada, reduzirMovimento, toast.id, toast.texto, comAcao])

  const animacaoDeEntrada = {
    // A entrada é animação, não estado: dissolve e sobe 8 enquanto o toast aparece.
    // eslint-disable-next-line no-restricted-syntax
    opacity: entrada,
    transform: reduzirMovimento
      ? []
      : [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  }
  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e12,
          minHeight: 48,
          paddingVertical: ESPACO.e12,
          paddingHorizontal: ESPACO.e16,
          borderRadius: RAIO.medio,
          backgroundColor: inverso ? cores.fundo : cores.toastFundo,
        },
        animacaoDeEntrada,
        sombra(elevacao.flutuante),
      ]}
    >
      <Icone nome={ICONE[tipo]} cor={cores[tipo]} tamanho={18} />
      <Texto variante="corpo" numberOfLines={2} style={{ flex: 1 }}>
        {toast.texto}
      </Texto>
      {toast.acao ? (
        <View style={{ marginVertical: -10, marginRight: -8 }}>
          <Botao
            titulo={toast.acao.titulo}
            variante="terciario"
            aoPressionar={() => {
              toast.acao?.aoPressionar()
              tirarDaFila(toast.id)
            }}
          />
        </View>
      ) : null}
    </Animated.View>
  )
}
