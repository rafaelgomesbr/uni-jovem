import { ESPACO, LADO_DO_SOL, LARGURA_DA_COLUNA_DE_ACESSO, RITMO } from '@uj/tokens'
import { useState, type ReactNode, type Ref } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BotaoIcone } from '@/ui/Botao'
import { ContextoDaBarraFlutuanteEmbaixo } from '@/ui/BarraDeAcao'
import type { NoDeTexto } from '@/ui/foco'
import { FundoAurora } from '@/ui/FundoAurora'
import { MarcaDoSol } from '@/ui/MarcaDoSol'
import { ProvedorDeRevelacao, Revelar } from '@/ui/Revelar'
import { Texto } from '@/ui/Texto'
import { useTema } from '@/ui/tema'
import { soNaWeb } from '@/ui/web'
import { voltarOu } from '@/ui/navegacao'

interface PropsDoQuadroDeAcesso {
  titulo: string
  /** Uma frase de apoio em `corpo` suave, 8 abaixo do título. */
  apoio?: ReactNode
  /** Sem o voltar (o convite aberto pelo link é a entrada). */
  semVoltar?: boolean
  aoVoltar?: () => void
  /**
   * Muda quando o passo muda: o conteúdo desliza de novo (16 pt em 260 ms) e a
   * marca e a aurora ficam paradas. `direcao` é +1 ao avançar e -1 ao voltar.
   */
  chaveDoPasso?: string
  direcao?: 1 | -1
  refDoTitulo?: Ref<NoDeTexto>
  /** Rodapé fixo com a ação principal (`BarraDeAcao`), que sobe com o teclado. */
  barraDeAcao?: ReactNode
  children: ReactNode
}

/**
 * A moldura das telas de acesso que não são a entrada (criar conta, "Falta
 * pouco", convite), no mesmo desenho da entrada (D63): aurora de fundo, coluna
 * única de até 400, o voltar de 44 à esquerda e o sol de 32 à direita, o
 * título em `tituloTela` e a ação principal presa embaixo, acima do teclado.
 * Sem cartão em volta dos campos: o espaço e o alinhamento agrupam.
 */
export function QuadroDeAcesso({
  titulo,
  apoio,
  semVoltar = false,
  aoVoltar,
  chaveDoPasso = 'unico',
  direcao = 1,
  refDoTitulo,
  barraDeAcao,
  children,
}: PropsDoQuadroDeAcesso) {
  const { cores } = useTema()
  const margens = useSafeAreaInsets()
  const [alturaDaBarra, setAlturaDaBarra] = useState(0)

  return (
    <ProvedorDeRevelacao value="curta">
      <View style={{ flex: 1, backgroundColor: cores.fundo }}>
        <FundoAurora intensidade={1} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="never"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: 'center',
              paddingTop: margens.top + RITMO.topoDaTela,
              paddingBottom: barraDeAcao ? alturaDaBarra + ESPACO.e16 : margens.bottom + ESPACO.e24,
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: LARGURA_DA_COLUNA_DE_ACESSO + RITMO.margemDaTela * 2,
                paddingHorizontal: RITMO.margemDaTela,
                gap: ESPACO.e16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {semVoltar ? (
                  <View />
                ) : (
                  <BotaoIcone
                    icone="voltar"
                    rotulo="Voltar"
                    circular
                    aoPressionar={aoVoltar ?? (() => voltarOu('/entrar'))}
                  />
                )}
                <MarcaDoSol lado={LADO_DO_SOL.mini} etapa="estatica" halo={false} />
              </View>

              <Revelar key={`${chaveDoPasso}-titulo`} ordem={0} direcao={direcao}>
                <View style={{ gap: RITMO.entreItens }}>
                  <Texto variante="tituloTela" ref={refDoTitulo} {...soNaWeb({ tabIndex: -1 })}>
                    {titulo}
                  </Texto>
                  {apoio ? (
                    <Texto variante="corpo" cor="textoSuave">
                      {apoio}
                    </Texto>
                  ) : null}
                </View>
              </Revelar>

              <Revelar key={`${chaveDoPasso}-corpo`} ordem={1} direcao={direcao}>
                <View style={{ gap: RITMO.entreSecoes }}>{children}</View>
              </Revelar>
            </View>
          </ScrollView>
          {barraDeAcao ? (
            <View
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
              onLayout={(e: LayoutChangeEvent) => {
                const altura = Math.ceil(e.nativeEvent.layout.height)
                if (altura !== alturaDaBarra) setAlturaDaBarra(altura)
              }}
            >
              <ContextoDaBarraFlutuanteEmbaixo.Provider value={0}>
                {barraDeAcao}
              </ContextoDaBarraFlutuanteEmbaixo.Provider>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </ProvedorDeRevelacao>
  )
}
