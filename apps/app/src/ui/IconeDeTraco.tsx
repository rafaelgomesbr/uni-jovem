import type { ColorValue } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

/**
 * Ícones de traço desenhados no mockup aprovado da direção Aurora (D15):
 * mesmos caminhos SVG, traço 2 e cantos redondos. Usados onde o mockup mostra
 * o ícone (barra de abas, pílula da comunidade, sincronização) para o app
 * ficar igual ao desenho, sem depender da fonte de símbolos do sistema.
 */
export const TRACOS = {
  abaInicio: (c: ColorValue) => (
    <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" stroke={c} />
  ),
  abaAgenda: (c: ColorValue) => (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2} stroke={c} />
      <Path d="M3 10h18M8 3v4M16 3v4" stroke={c} />
    </>
  ),
  abaProgramas: (c: ColorValue) => <Path d="M4 6h16M4 12h16M4 18h10" stroke={c} />,
  abaEquipe: (c: ColorValue) => (
    <>
      <Circle cx={9} cy={8} r={3} stroke={c} />
      <Path
        d="M3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M21 20c0-2-1.5-3.5-3.5-4.3"
        stroke={c}
      />
    </>
  ),
  pessoa: (c: ColorValue) => (
    <>
      <Circle cx={12} cy={8} r={4} stroke={c} />
      <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" stroke={c} />
    </>
  ),
  abrirLista: (c: ColorValue) => <Path d="M6 9l6 6 6-6" stroke={c} />,
  confirmado: (c: ColorValue) => <Path d="M5 12l5 5L20 7" stroke={c} strokeWidth={2.5} />,
  check: (c: ColorValue) => <Path d="M5 12l5 5L20 7" stroke={c} strokeWidth={2.5} />,
} as const

export type NomeDoTraco = keyof typeof TRACOS

export function IconeDeTraco({
  nome,
  cor,
  tamanho = 22,
  traco = 2,
}: {
  nome: NomeDoTraco
  cor: ColorValue
  tamanho?: number
  /** Espessura do traço (2 no mockup; 2,5 na aba ativa, o sinal de peso além da cor). */
  traco?: number
}) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {TRACOS[nome](cor)}
    </Svg>
  )
}
