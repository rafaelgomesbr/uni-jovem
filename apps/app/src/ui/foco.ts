import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react'
import { AccessibilityInfo, Platform, type Text, type View, type ViewStyle } from 'react-native'

export type NoDeView = ComponentRef<typeof View>
export type NoDeTexto = ComponentRef<typeof Text>
type NoFocavel = NoDeView | NoDeTexto

/**
 * Leva o foco (do leitor de tela e, na web, do teclado) para um elemento.
 * Usado quando o que tinha foco some: o botão que abriu um formulário volta a
 * ter o foco quando ele fecha; o título do bloco novo recebe o foco quando os
 * botões de resposta desaparecem. Na web, o alvo precisa de `tabIndex={-1}`.
 */
export function focar(ref: RefObject<NoFocavel | null>): void {
  // Espera o quadro seguinte: o elemento pode ter acabado de montar.
  setTimeout(() => {
    const no = ref.current
    if (!no) return
    if (Platform.OS === 'web') {
      const el = no as unknown as HTMLElement
      if (typeof el.focus === 'function') el.focus()
      return
    }
    AccessibilityInfo.sendAccessibilityEvent(no, 'focus')
  }, 50)
}

/**
 * Para blocos que trocam de conteúdo depois de uma ação (inscrever, cancelar,
 * criar convite): `pedirFoco()` antes da ação; quando `chave` muda, o foco vai
 * para `alvo` (o primeiro elemento do bloco novo). Sem pedido, nada acontece:
 * a troca por outro motivo (atualização da lista) não rouba o foco de ninguém.
 */
export function useFocoAoMudar<T extends NoFocavel = NoDeView>(chave: string) {
  const alvo = useRef<T>(null)
  const pedido = useRef(false)
  // O foco do leitor de tela é um sistema externo: sincroniza depois da troca.
  useEffect(() => {
    if (!pedido.current) return
    pedido.current = false
    focar(alvo)
  }, [chave])
  return {
    alvo,
    pedirFoco: () => {
      pedido.current = true
    },
  }
}

/**
 * Anel de foco de teclado (seção 2.12): 2 na cor `foco`, afastado 2, com o
 * raio do componente mais 2 (o contorno acompanha o raio da caixa). Na web quem desenha é o `:focus-visible` (CSS em
 * `EstilosDaWeb`); no Android e no Acesso Total por Teclado do iOS, o
 * `onFocus` do Pressable liga as propriedades `outline*`.
 */
export function useAnelDeFoco(cor: string) {
  const [focado, setFocado] = useState(false)
  const nativo = Platform.OS !== 'web'
  const estilo: ViewStyle =
    focado && nativo
      ? {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: cor,
          outlineOffset: 2,
        }
      : {}
  return {
    estilo,
    onFocus: () => setFocado(true),
    onBlur: () => setFocado(false),
  }
}
