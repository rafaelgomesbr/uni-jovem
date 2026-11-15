import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { FONTES, TIPO, type NomeDoPapel, type PapelTipografico } from '@uj/tokens'

/**
 * Uma família por peso: no Android, `fontWeight` sobre fonte carregada vira
 * negrito sintético. Por isso o peso já vem no nome da família. A reserva,
 * se o arquivo não carregar, é a fonte do sistema.
 */
export const FAMILIA = {
  tituloForte: `${FONTES.titulo}_800ExtraBold`,
  texto: `${FONTES.texto}_400Regular`,
  textoMedio: `${FONTES.texto}_500Medium`,
  textoForte: `${FONTES.texto}_600SemiBold`,
} as const

/** Arquivos carregados com `useFonts` antes de esconder a abertura. */
export const ARQUIVOS_DE_FONTE = {
  [FAMILIA.tituloForte]: BricolageGrotesque_800ExtraBold,
  [FAMILIA.texto]: Inter_400Regular,
  [FAMILIA.textoMedio]: Inter_500Medium,
  [FAMILIA.textoForte]: Inter_600SemiBold,
}

export type VarianteDeTexto = NomeDoPapel

/** Família do peso pedido (a Bricolage só existe em 800). */
export function familiaDoPeso(
  familia: PapelTipografico['familia'],
  peso: PapelTipografico['peso'],
): string {
  if (familia === 'titulo') return FAMILIA.tituloForte
  if (peso === '600' || peso === '800') return FAMILIA.textoForte
  if (peso === '500') return FAMILIA.textoMedio
  return FAMILIA.texto
}

export const FAMILIA_DA_VARIANTE: Readonly<Record<VarianteDeTexto, string>> = Object.fromEntries(
  (Object.keys(TIPO) as VarianteDeTexto[]).map((v) => [
    v,
    familiaDoPeso(TIPO[v].familia, TIPO[v].peso),
  ]),
) as Record<VarianteDeTexto, string>
