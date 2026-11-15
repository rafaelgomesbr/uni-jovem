import { BORDA, ESPACO, RAIO, RITMO } from '@uj/tokens'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { CabecalhoDeTela } from '@/ui/CabecalhoDeTela'
import { focar, type NoDeTexto } from '@/ui/foco'
import type { NomeDoIcone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { ProvedorDeSuperficie, sombra, useTema } from '@/ui/tema'

export interface AcaoDaFolha {
  titulo: string
  icone: NomeDoIcone
  descricao?: string
  /** Apaga, recusa ou denuncia: em vermelho, por último e separada das outras por 8. */
  destrutiva?: boolean
  /** A folha fecha quando a ação termina (inclusive a confirmação nativa, que aparece por cima). */
  aoPressionar: () => void | Promise<unknown>
}

interface PropsDaFolha {
  titulo: string
  aberta: boolean
  aoFechar: () => void
  acoes?: readonly AcaoDaFolha[]
  /** Conteúdo próprio acima do menu (um formulário curto, como a denúncia). */
  children?: ReactNode
}

/**
 * Folha "Mais ações" (2.12.19) aberta na própria tela, sem rota: menu de
 * linhas de lista com a destrutiva por último, sobre a superfície elevada
 * opaca, raio 28 no topo, padding 20 nas laterais e a área segura mais 16
 * embaixo. Fechar existe sempre (botão de 44 e o voltar do Android); o véu
 * também fecha, mas nada depende de gesto. Com "Reduzir movimento", a folha
 * só dissolve. Ao abrir, o leitor de tela vai para o título.
 *
 * Fica aqui até existir em `src/ui` (o detalhe do evento precisa da mesma).
 */
export function FolhaDeAcoes({ titulo, aberta, aoFechar, acoes = [], children }: PropsDaFolha) {
  const { cores, elevacao } = useTema()
  const { reduzirMovimento, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const margens = useSafeAreaInsets()
  const tituloRef = useRef<NoDeTexto>(null)
  const comuns = acoes.filter((a) => !a.destrutiva)
  const destrutivas = acoes.filter((a) => a.destrutiva)

  // O foco do leitor de tela é um sistema externo: vai para o título quando a folha abre.
  useEffect(() => {
    if (aberta) focar(tituloRef)
  }, [aberta])

  async function executar(acao: AcaoDaFolha) {
    await acao.aoPressionar()
    aoFechar()
  }

  const grupo = (lista: readonly AcaoDaFolha[]) => (
    <Lista>
      {lista.map((a) => (
        <LinhaDeLista
          key={a.titulo}
          icone={a.icone}
          titulo={a.titulo}
          {...(a.descricao ? { descricao: a.descricao } : {})}
          semSeta
          destrutivo={!!a.destrutiva}
          aoPressionar={() => void executar(a)}
        />
      ))}
    </Lista>
  )

  return (
    <Modal
      visible={aberta}
      transparent
      animationType={reduzirMovimento ? 'fade' : 'slide'}
      onRequestClose={aoFechar}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* O véu fecha ao toque, mas não é um alvo para o leitor de tela: o "Fechar" é. */}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={aoFechar}
          style={[StyleSheet.absoluteFill, { backgroundColor: cores.veu }]}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            accessibilityViewIsModal
            aria-modal
            style={{
              maxHeight: '92%',
              backgroundColor: cores.superficieElevada,
              borderTopLeftRadius: RAIO.barra,
              borderTopRightRadius: RAIO.barra,
              borderTopWidth: aumentarContraste ? BORDA.contraste : 0,
              borderColor: cores.texto,
              ...sombra(elevacao.folha),
            }}
          >
            <ProvedorDeSuperficie superficie="opaca">
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingHorizontal: RITMO.margemDaTela,
                  paddingTop: ESPACO.e8,
                  paddingBottom: margens.bottom + ESPACO.e16,
                  gap: RITMO.entreSecoes,
                }}
              >
                <CabecalhoDeTela
                  tipo="folha"
                  titulo={titulo}
                  aoFechar={aoFechar}
                  refDoTitulo={tituloRef}
                />
                {children}
                {acoes.length ? (
                  <View style={{ gap: ESPACO.e8 }}>
                    {comuns.length ? grupo(comuns) : null}
                    {destrutivas.length ? grupo(destrutivas) : null}
                  </View>
                ) : null}
              </ScrollView>
            </ProvedorDeSuperficie>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}
