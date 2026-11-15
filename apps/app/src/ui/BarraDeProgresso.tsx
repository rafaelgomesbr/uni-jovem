import { ALTURA, BORDA, RAIO, type Paleta } from '@uj/tokens'
import { View } from 'react-native'

import { usePreferenciasDeAcessibilidade } from './acessibilidade'
import { useTema } from './tema'

interface PropsDaBarra {
  /** De 0 a 1. Valores fora do intervalo são cortados. */
  fracao: number
  /** Texto lido pelo leitor de tela (ex.: "3 de 7 etapas concluídas"). */
  rotulo: string
  cor?: keyof Paleta
  /** Padrão: 6 (3.3.4 e 3.5.1). */
  altura?: number
  /**
   * `tonal`: trilho em `tonal`, sem borda (3.3.4 e quadro 09), quando o
   * número também está escrito ao lado. `contorno`: trilho elevado com borda
   * de 1 em `campoBorda`, quando a barra precisa se destacar sozinha.
   */
  trilho?: 'tonal' | 'contorno'
}

/**
 * Barra de progresso estática (sem animação: respeita Reduzir movimento por
 * construção). O número vai sempre em texto ao lado ou no rótulo. Com
 * "Aumentar contraste", o trilho ganha borda na cor do texto.
 */
export function BarraDeProgresso({
  fracao,
  rotulo,
  cor = 'destaque',
  altura = ALTURA.progresso,
  trilho = 'contorno',
}: PropsDaBarra) {
  const { cores, solido } = useTema()
  const { aumentarContraste } = usePreferenciasDeAcessibilidade()
  const valor = Math.min(1, Math.max(0, Number.isFinite(fracao) ? fracao : 0))
  const tonal = trilho === 'tonal'
  const comBorda = aumentarContraste || !tonal
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor * 100)}
      aria-valuetext={rotulo}
      style={{
        height: altura,
        borderRadius: RAIO.pilula,
        borderWidth: comBorda ? BORDA.fina : 0,
        borderColor: aumentarContraste ? cores.texto : cores.campoBorda,
        backgroundColor: tonal ? solido(cores.tonal) : cores.superficieElevada,
        overflow: 'hidden',
        alignSelf: 'stretch',
      }}
    >
      <View
        style={{
          width: `${valor * 100}%`,
          height: '100%',
          borderRadius: RAIO.pilula,
          backgroundColor: cores[cor],
        }}
      />
    </View>
  )
}
