import { TIPO, type Paleta } from '@uj/tokens'
import type { Ref } from 'react'
import { Text, type TextProps, type TextStyle } from 'react-native'

import type { NoDeTexto } from './foco'
import { familiaDoPeso, type VarianteDeTexto } from './fontes'
import { useTema } from './tema'
import { soNaWeb } from './web'

/**
 * Peso dentro do mesmo papel, quando a 2.4 prevê: hora da linha em 600
 * (`lista`), erro em 600 (`legenda`), aba e segmento inativos em 500.
 */
export type PesoDoTexto = 'regular' | 'medio' | 'forte'

const PESO = { regular: '400', medio: '500', forte: '600' } as const

export interface PropsDoTexto extends TextProps {
  variante?: VarianteDeTexto
  cor?: keyof Paleta
  peso?: PesoDoTexto
  centralizado?: boolean
  /** Algarismos de largura fixa (horas em coluna, contagens, totais). */
  tabular?: boolean
  /** Nível do cabeçalho; o padrão vem do papel (display e tituloTela 1, tituloCartao 2, sobrancelha 3). */
  nivel?: 1 | 2 | 3 | 4
  ref?: Ref<NoDeTexto>
}

/** Estilo de um papel tipográfico (para quem desenha texto sem `Texto`, como o `TextInput`). */
export function estiloDoPapel(variante: VarianteDeTexto, peso?: PesoDoTexto): TextStyle {
  const papel = TIPO[variante]
  return {
    fontFamily: familiaDoPeso(papel.familia, peso ? PESO[peso] : papel.peso),
    fontSize: papel.tamanho,
    lineHeight: papel.altura,
    ...(papel.espacamento ? { letterSpacing: papel.espacamento } : {}),
    ...(papel.maiusculas ? { textTransform: 'uppercase' as const } : {}),
    ...(papel.tabular ? { fontVariant: ['tabular-nums' as const] } : {}),
  }
}

/**
 * Texto com os papéis da seção 2.4. Respeita o tamanho de fonte do sistema
 * (nunca desliga `allowFontScaling`); o teto de escala vem do papel. Títulos
 * e sobrancelhas são anunciados como cabeçalho, com o nível do papel.
 */
export function Texto({
  variante = 'corpo',
  cor,
  peso,
  centralizado,
  tabular,
  nivel,
  style,
  accessibilityRole,
  maxFontSizeMultiplier,
  ...resto
}: PropsDoTexto) {
  const { cores } = useTema()
  const papel = TIPO[variante]
  const nivelFinal = nivel ?? papel.nivel
  const funcao = accessibilityRole ?? (papel.nivel ? 'header' : undefined)
  return (
    <Text
      accessibilityRole={funcao}
      {...(funcao === 'header' ? soNaWeb({ 'aria-level': nivelFinal ?? 3 }) : {})}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? papel.teto ?? undefined}
      style={[
        // A sobrancelha é coral por padrão (mockup); o resto, a cor do texto.
        { color: cores[cor ?? (variante === 'sobrancelha' ? 'destaque' : 'texto')] },
        estiloDoPapel(variante, peso),
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        centralizado ? { textAlign: 'center' } : null,
        style,
      ]}
      {...resto}
    />
  )
}
