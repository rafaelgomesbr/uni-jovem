import type { Paleta } from '@uj/tokens'

import { Chip, type TomDoChip } from './Chip'

const TOM_DA_COR: Partial<Record<keyof Paleta, TomDoChip>> = {
  sucesso: 'sucesso',
  alerta: 'alerta',
  erro: 'erro',
  info: 'info',
  destaque: 'quente',
  primaria: 'quente',
}

/**
 * Fachada do selo antigo (contorno colorido) para as telas ainda não
 * redesenhadas: vira o chip preenchido da 2.12.12, no tom da cor pedida.
 */
export function Selo({ texto, cor = 'textoSuave' }: { texto: string; cor?: keyof Paleta }) {
  return <Chip texto={texto} tom={TOM_DA_COR[cor] ?? 'neutro'} />
}
