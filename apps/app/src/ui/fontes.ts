import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold'
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { FONTES, TIPO } from '@uj/tokens'

/**
 * Uma família por peso: no Android, `fontWeight` sobre fonte carregada vira
 * negrito sintético. Por isso o peso já vem no nome da família.
 */
export const FAMILIA = {
  tituloForte: `${FONTES.titulo}_800ExtraBold`,
  tituloMedio: `${FONTES.titulo}_600SemiBold`,
  texto: `${FONTES.texto}_400Regular`,
  textoForte: `${FONTES.texto}_600SemiBold`,
} as const

/** Arquivos carregados com `useFonts` antes de esconder a abertura. */
export const ARQUIVOS_DE_FONTE = {
  [FAMILIA.tituloForte]: BricolageGrotesque_800ExtraBold,
  [FAMILIA.tituloMedio]: BricolageGrotesque_600SemiBold,
  [FAMILIA.texto]: Inter_400Regular,
  [FAMILIA.textoForte]: Inter_600SemiBold,
}

export type VarianteDeTexto = keyof typeof TIPO

export const FAMILIA_DA_VARIANTE: Readonly<Record<VarianteDeTexto, string>> = {
  tituloGrande: FAMILIA.tituloForte,
  titulo: FAMILIA.tituloForte,
  subtitulo: FAMILIA.tituloMedio,
  corpo: FAMILIA.texto,
  corpoForte: FAMILIA.textoForte,
  apoio: FAMILIA.texto,
  rotulo: FAMILIA.textoForte,
}
