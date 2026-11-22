import { Redirect, useLocalSearchParams } from 'expo-router'

import { parametro } from '@/utilidades/parametros'

import { dataDaRota } from './calendario'

/**
 * `/agenda/[data]` (a antiga "Linha do tempo do dia") deixou de ser tela (D69): ela repetia a
 * lista. Tocar um dia no Calendário filtra a Agenda a esse dia (`?dia=`). Links antigos
 * (notificação, favorito) continuam abrindo: levam à Agenda já nesse dia, ou na lista inteira
 * quando a data não vale.
 */
export function RedirecionarParaODia() {
  const dia = dataDaRota(parametro(useLocalSearchParams<{ data?: string }>().data))
  return (
    <Redirect href={{ pathname: '/agenda', params: dia && dia !== 'invalida' ? { dia } : {} }} />
  )
}
