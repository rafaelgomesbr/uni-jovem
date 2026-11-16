import { Redirect, useLocalSearchParams } from 'expo-router'

import { parametro } from '@/utilidades/parametros'

/**
 * `/programacoes` deixou de ser aba (D57): a lista dos encontros mora na
 * Agenda, no modo Lista. Links antigos (notificação, favorito, captura)
 * continuam abrindo, com o encontro escolhido na web larga (`?evento=`).
 */
export function RedirecionarParaALista() {
  const evento = parametro(useLocalSearchParams<{ evento?: string }>().evento)
  return (
    <Redirect
      href={{
        pathname: '/agenda',
        params: { vista: 'lista', ...(evento ? { evento } : {}) },
      }}
    />
  )
}
