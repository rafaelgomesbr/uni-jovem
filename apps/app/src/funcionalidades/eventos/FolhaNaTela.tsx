import { ESPACO, RAIO, RITMO } from '@uj/tokens'
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
import { Chip } from '@/ui/Chip'
import { focar, type NoDeTexto } from '@/ui/foco'
import type { NomeDoIcone } from '@/ui/Icone'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { ProvedorDeSuperficie, sombra, useTema } from '@/ui/tema'

/**
 * Tempo da folha sair da tela no iOS. A ação escolhida espera esse tempo:
 * um diálogo nativo aberto enquanto a folha ainda está saindo some junto dela.
 */
const SAIDA_DA_FOLHA_MS = Platform.OS === 'ios' ? 350 : 0

/** Executa depois que a folha terminou de sair (diálogo nativo ou outra folha logo em seguida). */
export function depoisDeFechar(acao: () => void) {
  setTimeout(acao, SAIDA_DA_FOLHA_MS)
}

interface PropsDaFolhaNaTela {
  aberta: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
}

/**
 * Folha (seção 2.12.19) aberta pela própria tela, para o que não tem rota
 * própria: "Mais ações", ações de uma linha e formulários curtos. Superfície
 * opaca `superficieElevada`, topo com raio 28, padding de 20 nas laterais e a
 * área segura mais 16 embaixo. Fechar existe sempre (botão de 44, voltar do
 * Android e toque no véu): nada fica só em gesto. Ao abrir, o leitor de tela
 * vai para o título.
 */
export function FolhaNaTela({ aberta, titulo, aoFechar, children }: PropsDaFolhaNaTela) {
  const { cores, elevacao } = useTema()
  const margens = useSafeAreaInsets()
  const { reduzirMovimento, aumentarContraste } = usePreferenciasDeAcessibilidade()
  const tituloRef = useRef<NoDeTexto>(null)

  // O foco do leitor de tela é um sistema externo: vai para o título quando a folha aparece.
  useEffect(() => {
    if (aberta) focar(tituloRef)
  }, [aberta])

  return (
    <Modal
      visible={aberta}
      transparent
      animationType={reduzirMovimento ? 'fade' : 'slide'}
      onRequestClose={aoFechar}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={aoFechar}
          style={[StyleSheet.absoluteFill, { backgroundColor: cores.veu }]}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ProvedorDeSuperficie superficie="opaca">
            <View
              accessibilityViewIsModal
              style={[
                {
                  maxHeight: '92%',
                  backgroundColor: cores.superficieElevada,
                  borderTopLeftRadius: RAIO.barra,
                  borderTopRightRadius: RAIO.barra,
                  borderTopWidth: aumentarContraste ? 2 : 0,
                  borderColor: cores.texto,
                },
                sombra(elevacao.folha),
              ]}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingHorizontal: RITMO.margemDaTela,
                  paddingTop: ESPACO.e16,
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
              </ScrollView>
            </View>
          </ProvedorDeSuperficie>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

export interface AcaoDoMenu {
  titulo: string
  icone: NomeDoIcone
  aoPressionar: () => void
  /** Uma linha de apoio (o estado, a consequência). */
  descricao?: string
  /** Apaga, cancela ou encerra: em vermelho, no grupo de baixo. */
  destrutiva?: boolean
  /** Abre outra tela: chevron à direita. */
  navega?: boolean
  /** Indisponível agora: a linha fica sem toque e a descrição diz por quê. */
  motivo?: string | null
  /** Chip quente à direita ("Recomendado"). */
  chip?: string
}

interface PropsDoMenu {
  aberto: boolean
  titulo: string
  acoes: readonly (AcaoDoMenu | null | false)[]
  aoFechar: () => void
}

/**
 * Menu de ações numa folha (seção 2.12.19): linhas de lista; as destrutivas
 * em vermelho, por último, separadas por 8. Tocar fecha a folha e executa.
 */
export function MenuDeAcoes({ aberto, titulo, acoes, aoFechar }: PropsDoMenu) {
  const validas = acoes.filter((a): a is AcaoDoMenu => !!a)
  const grupos = [validas.filter((a) => !a.destrutiva), validas.filter((a) => a.destrutiva)]

  function escolher(a: AcaoDoMenu) {
    aoFechar()
    depoisDeFechar(a.aoPressionar)
  }

  return (
    <FolhaNaTela aberta={aberto} titulo={titulo} aoFechar={aoFechar}>
      {grupos.map((grupo, i) =>
        grupo.length ? (
          <View key={i} style={i > 0 && grupos[0]!.length ? { marginTop: -ESPACO.e8 } : null}>
            <Lista>
              {grupo.map((a) => {
                const apoio = a.motivo ?? a.descricao
                return (
                  <LinhaDeLista
                    key={a.titulo}
                    icone={a.icone}
                    titulo={a.titulo}
                    {...(apoio ? { descricao: apoio } : {})}
                    destrutivo={!!a.destrutiva}
                    semSeta={!a.navega}
                    {...(a.chip ? { extra: <Chip texto={a.chip} tom="quente" /> } : {})}
                    {...(a.motivo ? {} : { aoPressionar: () => escolher(a) })}
                  />
                )
              })}
            </Lista>
          </View>
        ) : null,
      )}
    </FolhaNaTela>
  )
}
