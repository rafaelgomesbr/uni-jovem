import { RAIO, type Paleta } from '@uj/tokens'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

interface PropsDaBarra {
  /** De 0 a 1. Valores fora do intervalo são cortados. */
  fracao: number
  /** Texto lido pelo leitor de tela (ex.: "3 de 7 etapas concluídas"). */
  rotulo: string
  cor?: keyof Paleta
  altura?: number
}

/**
 * Barra de progresso estática (sem animação: respeita Reduzir movimento por
 * construção). O número vai sempre em texto ao lado ou no rótulo.
 */
export function BarraDeProgresso({ fracao, rotulo, cor = 'destaque', altura = 8 }: PropsDaBarra) {
  const { cores } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const valor = Math.min(1, Math.max(0, Number.isFinite(fracao) ? fracao : 0))
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(valor * 100), text: rotulo }}
      style={{
        height: altura,
        borderRadius: RAIO.pilula,
        borderWidth: 1,
        borderColor: aumentarContraste ? cores.texto : cores.borda,
        backgroundColor: cores.superficieElevada,
        overflow: 'hidden',
        alignSelf: 'stretch',
      }}
    >
      <View style={{ width: `${valor * 100}%`, height: '100%', backgroundColor: cores[cor] }} />
    </View>
  )
}
