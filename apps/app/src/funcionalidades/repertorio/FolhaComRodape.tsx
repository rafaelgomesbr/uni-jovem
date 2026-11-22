import { ESPACO, RAIO, RITMO } from '@uj/tokens'
import { useEffect, useRef, type ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePreferenciasDeAcessibilidade } from '@/ui/acessibilidade'
import { CabecalhoDeTela } from '@/ui/CabecalhoDeTela'
import { focar, type NoDeTexto } from '@/ui/foco'
import { AlcaDaFolha } from '@/ui/FolhaNaTela'
import { ProvedorDeSuperficie, sombra, useTema } from '@/ui/tema'
import { Vidro } from '@/ui/Vidro'

interface Props {
  aberta: boolean
  titulo: string
  aoFechar: () => void
  children: ReactNode
  /** O que fica FIXO embaixo, fora da rolagem: o botão que conclui a folha. */
  rodape?: ReactNode
}

/**
 * A folha do repertório com o botão FIXO embaixo (auditoria de UX, achado 42): o corpo rola e o
 * rodapé nunca sai da tela, nem com a lista longa, nem com o teclado aberto. Tem o mesmo desenho
 * da `FolhaNaTela` (vidro com fallback opaco, alça, "Fechar" sempre à mão, foco no título); a
 * diferença é só o rodapé. Quando a `FolhaNaTela` ganhar o rodapé, esta peça some e as folhas
 * voltam a usá-la.
 */
export function FolhaComRodape({ aberta, titulo, aoFechar, children, rodape }: Props) {
  const { cores, elevacao } = useTema()
  const margens = useSafeAreaInsets()
  const { height: alturaDaJanela } = useWindowDimensions()
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
              maxHeight: Math.round(alturaDaJanela * 0.9),
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
                  style={{ flexShrink: 1 }}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{
                    paddingHorizontal: RITMO.margemDaTela,
                    paddingTop: ESPACO.e8,
                    paddingBottom: ESPACO.e16,
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
                {rodape ? (
                  <View
                    testID="rodape-da-folha"
                    style={{
                      paddingHorizontal: RITMO.margemDaTela,
                      paddingTop: ESPACO.e12,
                      paddingBottom: margens.bottom + ESPACO.e12,
                      gap: ESPACO.e8,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: cores.separador,
                    }}
                  >
                    {rodape}
                  </View>
                ) : (
                  <View style={{ height: margens.bottom }} />
                )}
              </ProvedorDeSuperficie>
            </View>
          </Vidro>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}
