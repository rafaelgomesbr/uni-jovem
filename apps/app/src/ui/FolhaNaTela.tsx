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

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { CabecalhoDeTela } from './CabecalhoDeTela'
import { Chip } from './Chip'
import { focar, type NoDeTexto } from './foco'
import type { NomeDoIcone } from './Icone'
import { LinhaDeLista, Lista } from './LinhaDeLista'
import { ProvedorDeSuperficie, sombra, useTema } from './tema'
import { Texto } from './Texto'
import { Vidro } from './Vidro'

/**
 * Tempo da folha sair da tela no iOS. A ação escolhida espera esse tempo:
 * um diálogo nativo aberto enquanto a folha ainda está saindo some junto dela.
 */
const SAIDA_DA_FOLHA_MS = Platform.OS === 'ios' ? 350 : 0

/** Executa depois que a folha terminou de sair (diálogo nativo ou outra folha logo em seguida). */
export function depoisDeFechar(acao: () => void) {
  setTimeout(acao, SAIDA_DA_FOLHA_MS)
}

/**
 * A alça da folha (direção A): 40 por 5, cápsula em `neutroFundo`, a 8 do topo. É só um
 * indício de que a folha cede: nada depende dela (o "Fechar" de 44 e o véu fecham sempre).
 */
export function AlcaDaFolha() {
  const { cores } = useTema()
  return (
    <View
      testID="alca-da-folha"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 40,
        height: 5,
        borderRadius: RAIO.pilula,
        backgroundColor: cores.neutroFundo,
        alignSelf: 'center',
        marginTop: ESPACO.e8,
      }}
    />
  )
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
 * de vidro (desfoque de 30, com fallback opaco `superficieElevada` com Reduzir transparência,
 * Aumentar contraste e no Android), alça no topo, topo com raio 28, padding de 20 nas
 * laterais e a área segura mais 16 embaixo. Fechar existe sempre (botão de 44, voltar do
 * Android e toque no véu): nada fica só em gesto. Com "Reduzir movimento", a
 * folha só dissolve. Ao abrir, o leitor de tela vai para o título.
 *
 * A folha com rota própria é a `Folha`, aberta como `formSheet` nativo.
 */
export function FolhaNaTela({ aberta, titulo, aoFechar, children }: PropsDaFolhaNaTela) {
  const { cores, elevacao } = useTema()
  const margens = useSafeAreaInsets()
  const { reduzirMovimento } = usePreferenciasDeAcessibilidade()
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
        {/* O véu fecha ao toque, mas não é um alvo para o leitor de tela: o "Fechar" é. */}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={aoFechar}
          style={[StyleSheet.absoluteFill, { backgroundColor: cores.veu }]}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Vidro
            tipo="folha"
            style={{
              maxHeight: '90%',
              borderTopLeftRadius: RAIO.barra,
              borderTopRightRadius: RAIO.barra,
              borderBottomWidth: 0,
              overflow: 'hidden',
              ...sombra(elevacao.folha),
            }}
          >
            <View accessibilityViewIsModal aria-modal style={{ flexShrink: 1 }}>
              <AlcaDaFolha />
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
                </ScrollView>
              </ProvedorDeSuperficie>
            </View>
          </Vidro>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

export interface AcaoDoMenu {
  titulo: string
  icone: NomeDoIcone
  /** Com `esperarAcao`, a folha espera a promessa (a confirmação nativa) antes de fechar. */
  aoPressionar: () => void | Promise<unknown>
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
  /**
   * Grupo com título ("Organizar", "Neste aparelho"), na ordem em que aparece
   * pela primeira vez. As destrutivas continuam por último, sem título.
   */
  grupo?: string
}

interface PropsDoMenu {
  aberto: boolean
  titulo: string
  acoes: readonly (AcaoDoMenu | null | false)[]
  aoFechar: () => void
  /** Conteúdo próprio acima do menu (um formulário curto, como a denúncia). */
  children?: ReactNode
  /**
   * A ação roda com a folha aberta (a confirmação nativa aparece por cima
   * dela) e a folha fecha quando a ação termina. Sem isto, a folha fecha
   * primeiro e a ação roda quando ela termina de sair.
   */
  esperarAcao?: boolean
}

/**
 * Menu de ações numa folha (seção 2.12.19): linhas de lista; as destrutivas
 * em vermelho, por último, separadas por 8. Tocar fecha a folha e executa.
 */
export function MenuDeAcoes({
  aberto,
  titulo,
  acoes,
  aoFechar,
  children,
  esperarAcao = false,
}: PropsDoMenu) {
  const validas = acoes.filter((a): a is AcaoDoMenu => !!a)
  const comuns = validas.filter((a) => !a.destrutiva)
  const titulos = [...new Set(comuns.map((a) => a.grupo ?? ''))]
  const grupos = [
    ...titulos.map((t) => ({ titulo: t, acoes: comuns.filter((a) => (a.grupo ?? '') === t) })),
    { titulo: '', acoes: validas.filter((a) => a.destrutiva) },
  ]

  async function escolher(a: AcaoDoMenu) {
    if (esperarAcao) {
      await a.aoPressionar()
      aoFechar()
      return
    }
    aoFechar()
    depoisDeFechar(() => void a.aoPressionar())
  }

  return (
    <FolhaNaTela aberta={aberto} titulo={titulo} aoFechar={aoFechar}>
      {children}
      {validas.length ? (
        <View style={{ gap: ESPACO.e8 }}>
          {grupos.map((grupo, i) =>
            grupo.acoes.length ? (
              <View key={i} style={{ gap: ESPACO.e8 }}>
                {grupo.titulo ? (
                  <Texto variante="sobrancelha" accessibilityRole="header" nivel={3}>
                    {grupo.titulo}
                  </Texto>
                ) : null}
                <Lista>
                  {grupo.acoes.map((a) => {
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
                        {...(a.motivo ? {} : { aoPressionar: () => void escolher(a) })}
                      />
                    )
                  })}
                </Lista>
              </View>
            ) : null,
          )}
        </View>
      ) : null}
    </FolhaNaTela>
  )
}
