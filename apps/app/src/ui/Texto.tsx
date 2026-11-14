import { TIPO, type Paleta } from '@uj/tokens'
import { Text, type TextProps } from 'react-native'

import { FAMILIA_DA_VARIANTE, type VarianteDeTexto } from './fontes'
import { useTema } from './tema'

const TITULOS: ReadonlySet<VarianteDeTexto> = new Set(['tituloGrande', 'titulo', 'subtitulo'])

export interface PropsDoTexto extends TextProps {
  variante?: VarianteDeTexto
  cor?: keyof Paleta
  centralizado?: boolean
}

/**
 * Texto com a escala do design system. Respeita o tamanho de fonte do sistema
 * (nunca desliga `allowFontScaling`). Títulos são anunciados como cabeçalho.
 */
export function Texto({
  variante = 'corpo',
  cor = 'texto',
  centralizado,
  style,
  accessibilityRole,
  ...resto
}: PropsDoTexto) {
  const { cores } = useTema()
  const tipo = TIPO[variante]
  return (
    <Text
      accessibilityRole={accessibilityRole ?? (TITULOS.has(variante) ? 'header' : undefined)}
      style={[
        {
          color: cores[cor],
          fontFamily: FAMILIA_DA_VARIANTE[variante],
          fontSize: tipo.tamanho,
          lineHeight: tipo.altura,
        },
        centralizado ? { textAlign: 'center' } : null,
        style,
      ]}
      {...resto}
    />
  )
}
