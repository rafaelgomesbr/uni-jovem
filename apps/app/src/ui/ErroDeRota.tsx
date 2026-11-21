import { router, useSegments, type ErrorBoundaryProps } from 'expo-router'
import { Platform } from 'react-native'

import { ErroDaTela } from './Falha'
import { Tela } from './Tela'

/** Vai ao Início; se a navegação em si estiver quebrada, recarrega (web) em vez de ficar parado. */
function voltarAoInicio(): void {
  try {
    router.replace('/')
  } catch {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign('/app/')
  }
}

/**
 * Limite de erro de cada tela (expo-router: `screenErrorBoundary` do layout
 * raiz e `ErrorBoundary` dele). Um erro de renderização derruba só a tela em
 * que aconteceu: no lugar dela aparece o `ErroDaTela` com "Tentar de novo" e,
 * fora das abas, o voltar do cabeçalho. Sem isso, num build de produção, o
 * erro vira `reportFatalException` e o sistema fecha o app.
 *
 * "Voltar ao início" é a saída que não depende da tela que quebrou: se "Tentar
 * de novo" falhar outra vez, a pessoa não fica presa (D58).
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
      <ErroDaTela
        erro={error}
        titulo="Esta tela não abriu"
        aoTentarDeNovo={() => void retry()}
        acaoSecundaria={{ titulo: 'Voltar ao início', aoPressionar: voltarAoInicio }}
      />
    </Tela>
  )
}
