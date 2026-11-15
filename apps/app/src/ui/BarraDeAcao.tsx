import { ALTURA, ESPACO } from '@uj/tokens'
import { Children, useEffect, type ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { EmPar } from './Botao'
import { sombra, useTema } from './tema'
import { registrarRodape } from './Toast'
import { Vidro } from './Vidro'

/** Quanto a barra ocupa: padding de 12, botão de 48 e a área segura mais 12. */
export function alturaDaBarraDeAcao(margemDeBaixo: number): number {
  return ESPACO.e12 + ALTURA.controle + margemDeBaixo + ESPACO.e12
}

/** Padding de fim do conteúdo de uma tela com barra de ação: 48 + 24 + área segura + 16. */
export function fimComBarraDeAcao(margemDeBaixo: number): number {
  return ALTURA.controle + ESPACO.e24 + margemDeBaixo + ESPACO.e16
}

/**
 * Barra de ação (seção 2.12.18): rodapé fixo das telas de pilha com ação
 * principal. Vidro da barra com borda de cima, padding 12 por 20 e a área
 * segura mais 12 embaixo. Até 2 botões grandes lado a lado (secundário à
 * esquerda, primário à direita) ou 1 primário com o só ícone "Mais ações".
 * Quem a posiciona (e a faz subir com o teclado) é a `Tela`.
 */
export function BarraDeAcao({ children }: { children: ReactNode }) {
  const { elevacao } = useTema()
  const margens = useSafeAreaInsets()
  const altura = alturaDaBarraDeAcao(margens.bottom)
  // O toast precisa saber onde a barra termina: registra ao montar e libera ao sair.
  useEffect(() => registrarRodape(altura), [altura])
  const itens = Children.toArray(children).filter(Boolean)
  return (
    <Vidro borda="cima" style={sombra(elevacao.flutuante)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: ESPACO.e10,
          paddingTop: ESPACO.e12,
          paddingHorizontal: ESPACO.e20,
          paddingBottom: margens.bottom + ESPACO.e12,
        }}
      >
        <EmPar>
          {itens.map((filho, i) => (
            <View key={i} style={ehSoIcone(filho) ? null : { flex: 1 }}>
              {filho}
            </View>
          ))}
        </EmPar>
      </View>
    </Vidro>
  )
}

/** O só ícone "Mais ações" não estica: fica com 48×48 ao lado do primário. */
function ehSoIcone(filho: ReactNode): boolean {
  return (
    typeof filho === 'object' &&
    filho !== null &&
    'props' in filho &&
    typeof (filho.props as { icone?: unknown; titulo?: unknown }).icone === 'string' &&
    (filho.props as { titulo?: unknown }).titulo === undefined
  )
}
