import { Redirect, useLocalSearchParams } from 'expo-router'

import { parametro } from '@/utilidades/parametros'

/**
 * `/evento/[eventoId]/duplicar` deixou de ser tela (D69): "Duplicar" e "Igual ao último sábado" eram
 * a mesma ideia. "Copiar este encontro" leva à conferência, que copia o roteiro E a equipe (como
 * "aguardando resposta") e deixa publicar com Desfazer. Links antigos continuam abrindo.
 */
export function TelaDuplicar() {
  const eventoId = parametro(useLocalSearchParams<{ eventoId: string }>().eventoId)
  return (
    <Redirect
      href={
        eventoId
          ? { pathname: '/evento/igual-ao-ultimo', params: { origem: eventoId } }
          : '/evento/igual-ao-ultimo'
      }
    />
  )
}
