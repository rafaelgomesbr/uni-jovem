import { ESPACO } from '@uj/tokens'
import { useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { Aparecer } from './Aparecer'
import { Icone } from './Icone'
import { ALVO } from './medidas'
import { useTema } from './tema'

/**
 * O que a pessoa escolheu abrir vale só enquanto o app está aberto (D59, D62):
 * nada vai para o aparelho nem para o servidor. Sem isso, trocar de aba
 * recolheria de novo o que ela acabou de abrir.
 */
const abertosNestaSessao = new Map<string, boolean>()

/** Só para os testes: cada teste começa com tudo recolhido, como numa sessão nova. */
export function reiniciarAcordeoesDaSessao(): void {
  abertosNestaSessao.clear()
}

interface PropsDoAcordeao {
  /**
   * Lembra a escolha durante a sessão sob este nome ("versiculo", "resumo").
   * Sem nome, cada montagem começa recolhida.
   */
  chave?: string
  /** A linha de 44 pt que fica sempre à vista, à esquerda do chevron. Recebe o estado. */
  cabecalho: (aberto: boolean) => ReactNode
  /** O que o leitor de tela diz com o acordeão recolhido ("Versículo do dia, João 3:16. Recolhido."). */
  rotuloRecolhido: string
  /** E com ele aberto. */
  rotuloAberto: string
  /** Recuo lateral da linha (dentro de cartão lista, 18; solto na tela, 0). */
  recuo?: number
  children: ReactNode
}

/**
 * Acordeão (D62): uma linha tocável de pelo menos 44 pt (botão com
 * `aria-expanded`) que abre e recolhe o conteúdo. Abre com a entrada de 200 ms
 * do `Aparecer`, que com "Reduzir movimento" aparece direto, sem animação.
 * Recolhido por padrão: o que precisa de ação fica à vista, o resto espera o
 * toque. O chevron só gira (estado), não anima.
 */
export function Acordeao({
  chave,
  cabecalho,
  rotuloRecolhido,
  rotuloAberto,
  recuo = 0,
  children,
}: PropsDoAcordeao) {
  const { cores } = useTema()
  const [aberto, setAberto] = useState(() =>
    chave ? (abertosNestaSessao.get(chave) ?? false) : false,
  )

  function alternar() {
    const novo = !aberto
    if (chave) abertosNestaSessao.set(chave, novo)
    setAberto(novo)
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={aberto ? rotuloAberto : rotuloRecolhido}
        aria-expanded={aberto}
        onPress={alternar}
        style={{
          minHeight: ALVO,
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e8,
          paddingHorizontal: recuo,
        }}
      >
        <View style={{ flex: 1 }}>{cabecalho(aberto)}</View>
        <View style={{ transform: [{ rotate: aberto ? '180deg' : '0deg' }] }}>
          <Icone nome="abrirLista" cor={cores.textoSuave} tamanho={18} peso="semibold" />
        </View>
      </Pressable>
      {aberto ? <Aparecer>{children}</Aparecer> : null}
    </View>
  )
}
