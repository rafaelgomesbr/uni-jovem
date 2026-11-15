import { TIPO, type Paleta } from '@uj/tokens'
import type { Ref } from 'react'
import { Text, type TextProps } from 'react-native'

import type { NoDeTexto } from './foco'
import { FAMILIA_DA_VARIANTE, type VarianteDeTexto } from './fontes'
import { useTema } from './tema'
import { soNaWeb } from './web'

const TITULOS: ReadonlySet<VarianteDeTexto> = new Set(['tituloGrande', 'titulo', 'subtitulo'])

/** Nível do título na web (h1 a h4). Sem isso, todo cabeçalho vira <h1>. */
const NIVEL_PADRAO: Partial<Record<VarianteDeTexto, 1 | 2 | 3>> = {
  tituloGrande: 1,
  titulo: 1,
  subtitulo: 2,
  secao: 2,
}

export interface PropsDoTexto extends TextProps {
  variante?: VarianteDeTexto
  cor?: keyof Paleta
  centralizado?: boolean
  /**
   * Algarismos de largura fixa: contagens e horários não "dançam" quando o
   * número muda (contador de presença, cronômetro, totais de relatório).
   */
  tabular?: boolean
  /** Nível do cabeçalho (web): 1 título da tela, 2 cartão ou seção, 3 dentro do cartão. */
  nivel?: 1 | 2 | 3 | 4
  ref?: Ref<NoDeTexto>
}

/**
 * Texto com a escala do design system. Respeita o tamanho de fonte do sistema
 * (nunca desliga `allowFontScaling`). Títulos são anunciados como cabeçalho.
 */
export function Texto({
  variante = 'corpo',
  cor,
  centralizado,
  tabular,
  nivel,
  style,
  accessibilityRole,
  ...resto
}: PropsDoTexto) {
  const { cores } = useTema()
  const tipo = TIPO[variante]
  const papel = accessibilityRole ?? (TITULOS.has(variante) ? 'header' : undefined)
  return (
    <Text
      accessibilityRole={papel}
      {...(papel === 'header'
        ? soNaWeb({ 'aria-level': nivel ?? NIVEL_PADRAO[variante] ?? 3 })
        : {})}
      style={[
        {
          // A sobrancelha é coral por padrão (mockup); o resto, a cor do texto.
          color: cores[cor ?? (variante === 'sobrancelha' ? 'destaque' : 'texto')],
          fontFamily: FAMILIA_DA_VARIANTE[variante],
          fontSize: tipo.tamanho,
          lineHeight: tipo.altura,
        },
        variante === 'secao' ? { letterSpacing: 0.2 } : null,
        variante === 'tituloGrande' || variante === 'titulo' ? { letterSpacing: -0.5 } : null,
        variante === 'sobrancelha' ? { letterSpacing: 1, textTransform: 'uppercase' } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        centralizado ? { textAlign: 'center' } : null,
        style,
      ]}
      {...resto}
    />
  )
}
