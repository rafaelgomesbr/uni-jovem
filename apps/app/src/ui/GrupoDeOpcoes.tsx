import { ListaDeOpcoes, type Opcao, type PropsDaListaDeOpcoes } from './ListaDeOpcoes'

export type { Opcao }

/**
 * Fachada do grupo de rádio antigo para as telas ainda não redesenhadas:
 * mesma assinatura, desenho da `ListaDeOpcoes` (seção 2.12.6).
 */
export function GrupoDeOpcoes<T extends string>(props: PropsDaListaDeOpcoes<T>) {
  return <ListaDeOpcoes {...props} />
}
