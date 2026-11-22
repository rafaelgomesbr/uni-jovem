import { useIsFocused } from 'expo-router'
import type { ReactNode } from 'react'

import { TransicaoDeAba } from '@/ui/primitivasDeMovimento'

/**
 * Raiz de cada aba: "estas telas são pares, não pai e filho" (6.2 do UX). A
 * tela nova dissolve em 160 ms e a que sai em 120 ms; nada desliza (com Reduzir
 * movimento, 120 ms). Fica no arquivo da rota, e não dentro de `TelaDoApp`, para
 * que as telas das abas continuem testáveis sem navegador.
 */
export function EmbrulhoDaAba({ children }: { children: ReactNode }) {
  return <TransicaoDeAba ativa={useIsFocused()}>{children}</TransicaoDeAba>
}
