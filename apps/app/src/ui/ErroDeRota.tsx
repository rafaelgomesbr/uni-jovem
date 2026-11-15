import { useSegments, type ErrorBoundaryProps } from 'expo-router'

import { ErroDaTela } from './Falha'
import { Tela } from './Tela'

/**
 * Limite de erro de cada tela (expo-router: `screenErrorBoundary` do layout
 * raiz e `ErrorBoundary` dele). Um erro de renderização derruba só a tela em
 * que aconteceu: no lugar dela aparece o `ErroDaTela` com "Tentar de novo" e,
 * fora das abas, o voltar do cabeçalho. Sem isso, num build de produção, o
 * erro vira `reportFatalException` e o sistema fecha o app.
 *
 * Não usa sessão, consulta nem toast: também serve de limite do layout raiz,
 * que fica por fora desses provedores.
 */
export function ErroDeRota({ error, retry }: ErrorBoundaryProps) {
  const segmentos: readonly string[] = useSegments()
  // Raiz de aba: a barra de abas continua embaixo, não há para onde voltar.
  const naAba = segmentos.includes('(abas)')
  return (
    <Tela pilha={!naAba}>
      <ErroDaTela erro={error} titulo="Esta tela não abriu" aoTentarDeNovo={() => void retry()} />
    </Tela>
  )
}
