import { Platform, type ColorValue } from 'react-native'
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
  // Escalas: a lista das minhas convocações (o traço da antiga aba Programas).
  abaEscalas: (c: ColorValue) => <Path d="M4 6h16M4 12h16M4 18h10" stroke={c} />,
  abaComunidade: (c: ColorValue) => (
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
  /*
   * Conjunto da direção A "Aurora Viva" (D65): os caminhos do protótipo
   * `docs/design/v3/a/prototipo.html`, mesma gramática (grade de 24, traço 2,
   * pontas e junções redondas, sem preenchimento). Os nomes são os de `ICONES`.
   */
  sol: (c: ColorValue) => (
    <Path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6v2.2M5.2 9.8l1.6 1.4M18.8 9.8l-1.6 1.4" stroke={c} />
  ),
  agenda: (c: ColorValue) => (
    <>
      <Rect x={3.5} y={5} width={17} height={15.5} rx={3.5} stroke={c} />
      <Path d="M8 3v4M16 3v4M3.5 10.5h17" stroke={c} />
    </>
  ),
  pessoas: (c: ColorValue) => (
    <>
      <Circle cx={9} cy={8} r={3.2} stroke={c} />
      <Path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c} />
      <Circle cx={17} cy={9} r={2.5} stroke={c} />
      <Path d="M17.5 14.2c2.2.4 3.5 2.2 3.5 5" stroke={c} />
    </>
  ),
  perfil: (c: ColorValue) => (
    <>
      <Circle cx={12} cy={8.5} r={4} stroke={c} />
      <Path d="M4.5 20.5c.6-4 3.8-6 7.5-6s6.9 2 7.5 6" stroke={c} />
    </>
  ),
  sino: (c: ColorValue) => <Path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4" stroke={c} />,
  voltar: (c: ColorValue) => <Path d="M15 5l-7 7 7 7" stroke={c} />,
  avancar: (c: ColorValue) => <Path d="M9 5l7 7-7 7" stroke={c} />,
  confirmadoCirculo: (c: ColorValue) => (
    <>
      <Circle cx={12} cy={12} r={9} stroke={c} />
      <Path d="M8 12.5l3 3 5-6" stroke={c} />
    </>
  ),
  fechar: (c: ColorValue) => <Path d="M6 6l12 12M18 6L6 18" stroke={c} />,
  maisAcoes: (c: ColorValue) => (
    <>
      <Circle cx={5.5} cy={12} r={1.4} fill={c} stroke={c} />
      <Circle cx={12} cy={12} r={1.4} fill={c} stroke={c} />
      <Circle cx={18.5} cy={12} r={1.4} fill={c} stroke={c} />
    </>
  ),
  relogio: (c: ColorValue) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={c} />
      <Path d="M12 7.5V12l3 2" stroke={c} />
    </>
  ),
  local: (c: ColorValue) => (
    <>
      <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" stroke={c} />
      <Circle cx={12} cy={10} r={2.3} stroke={c} />
    </>
  ),
  avisoAlerta: (c: ColorValue) => <Path d="M12 4l9 16H3zM12 10v4.5M12 17.3v.1" stroke={c} />,
  musica: (c: ColorValue) => (
    <>
      <Path d="M9 18V6l10-2v12" stroke={c} />
      <Circle cx={6.5} cy={18} r={2.5} stroke={c} />
      <Circle cx={16.5} cy={16} r={2.5} stroke={c} />
    </>
  ),
  compartilhar: (c: ColorValue) => (
    <Path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" stroke={c} />
  ),
  qr: (c: ColorValue) => (
    <>
      <Rect x={4} y={4} width={6} height={6} rx={1} stroke={c} />
      <Rect x={14} y={4} width={6} height={6} rx={1} stroke={c} />
      <Rect x={4} y={14} width={6} height={6} rx={1} stroke={c} />
      <Path d="M14 14h3v3M20 14v.1M14 20h6v-3" stroke={c} />
    </>
  ),
  buscar: (c: ColorValue) => (
    <>
      <Circle cx={11} cy={11} r={6.5} stroke={c} />
      <Path d="M16 16l4.5 4.5" stroke={c} />
    </>
  ),
  semConexao: (c: ColorValue) => (
    <Path
      d="M3 9a14 14 0 0 1 18 0M6 12.5a9.5 9.5 0 0 1 12 0M9 16a5 5 0 0 1 6 0M12 19.5v.1M4 4l16 16"
      stroke={c}
    />
  ),
  cadeado: (c: ColorValue) => (
    <>
      <Rect x={5} y={10.5} width={14} height={10} rx={3} stroke={c} />
      <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={c} />
    </>
  ),
  pausar: (c: ColorValue) => <Path d="M8 5v14M16 5v14" stroke={c} />,
  iniciar: (c: ColorValue) => <Path d="M7 4.5l12 7.5-12 7.5z" stroke={c} />,
  etapaAnterior: (c: ColorValue) => <Path d="M19 5L9 12l10 7zM5 5v14" stroke={c} />,
  aviso: (c: ColorValue) => <Path d="M4 10v4h3l8 4V6L7 10zM18 9.5c1 .8 1 4.2 0 5" stroke={c} />,
  versiculo: (c: ColorValue) => (
    <Path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10" stroke={c} />
  ),
  sugestao: (c: ColorValue) => (
    <Path
      d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"
      stroke={c}
    />
  ),
  seguranca: (c: ColorValue) => (
    <Path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" stroke={c} />
  ),
  ajuda: (c: ColorValue) => (
    <>
      <Circle cx={12} cy={12} r={9} stroke={c} />
      <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17v.1" stroke={c} />
    </>
  ),
  sair: (c: ColorValue) => (
    <Path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" stroke={c} />
  ),
  coracao: (c: ColorValue) => (
    <Path
      d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"
      stroke={c}
    />
  ),
  convidar: (c: ColorValue) => (
    <>
      <Circle cx={10} cy={8} r={3.5} stroke={c} />
      <Path d="M3.5 20c.5-3.6 3.2-5.5 6.5-5.5M17 14v6M14 17h6" stroke={c} />
    </>
  ),
  ajustes: (c: ColorValue) => (
    <>
      <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke={c} />
      <Circle cx={16} cy={7} r={2} stroke={c} />
      <Circle cx={8} cy={17} r={2} stroke={c} />
    </>
  ),
  fixar: (c: ColorValue) => <Path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" stroke={c} />,
} as const

export type NomeDoTraco = keyof typeof TRACOS

const ESCONDIDO_DO_LEITOR =
  Platform.OS === 'web'
    ? ({ 'aria-hidden': true } as const)
    : ({
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
        'aria-hidden': true,
      } as const)

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
      // Decorativo: na web só `aria-hidden` (as props do celular viram atributos soltos no DOM).
      {...ESCONDIDO_DO_LEITOR}
    >
      {TRACOS[nome](cor)}
    </Svg>
  )
}
