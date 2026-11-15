import { Platform } from 'react-native'

import type { Local } from '@/servicos/contratoDosEventos'

/**
 * Link para abrir o local no app de mapas do aparelho. Com coordenadas, usa o
 * pino exato; sem elas, busca pelo endereço. `null` quando não há o que abrir.
 */
export function linkDoMapa(
  local: Pick<Local, 'nome' | 'endereco' | 'latitude' | 'longitude'>,
): string | null {
  const temPino = local.latitude !== null && local.longitude !== null
  if (!temPino && !local.endereco) return null
  const nome = encodeURIComponent(local.nome)
  if (Platform.OS === 'ios') {
    return temPino
      ? `https://maps.apple.com/?q=${nome}&ll=${local.latitude},${local.longitude}`
      : `https://maps.apple.com/?q=${encodeURIComponent(local.endereco ?? '')}`
  }
  const consulta = temPino ? `${local.latitude},${local.longitude}` : (local.endereco ?? '')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`
}
