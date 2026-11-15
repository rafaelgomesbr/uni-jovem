import { LinhaDeLista, Lista, type PropsDaLinhaDeLista } from './LinhaDeLista'

export { Lista }

/**
 * Fachada da linha antiga para as telas ainda não redesenhadas (D2 a D4):
 * mesma assinatura, desenho da `LinhaDeLista` (seção 2.12.11).
 */
export function Linha(props: PropsDaLinhaDeLista) {
  return <LinhaDeLista {...props} />
}
