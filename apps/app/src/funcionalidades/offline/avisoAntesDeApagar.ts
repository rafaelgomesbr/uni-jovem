import { contar } from './formatos'
import type { OperacaoNaFila } from './tipos'

const MAXIMO_NA_LISTA = 5

/**
 * Texto do diálogo antes de sair da conta ou da comunidade: mostra o que
 * ainda não foi enviado, porque sair apaga a partição deste aparelho.
 */
export function mensagemDePendencias(operacoes: readonly OperacaoNaFila[]): string {
  const lista = operacoes
    .slice(0, MAXIMO_NA_LISTA)
    .map((o) => `• ${o.descricao}`)
    .join('\n')
  const mais =
    operacoes.length > MAXIMO_NA_LISTA ? `\n• e mais ${operacoes.length - MAXIMO_NA_LISTA}` : ''
  const cabeca = contar(
    operacoes.length,
    'alteração feita sem internet ainda não foi enviada',
    'alterações feitas sem internet ainda não foram enviadas',
  )
  return `${cabeca}:\n${lista}${mais}\n\nSe continuar, elas são apagadas deste aparelho. Para não perder, conecte-se e toque em Sincronizar agora, em Perfil, Uso sem internet, antes de sair.`
}
