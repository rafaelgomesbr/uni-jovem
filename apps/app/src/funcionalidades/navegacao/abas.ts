import type { NomeDoIcone } from '@/ui/Icone'

export interface DefinicaoDaAba {
  /** Nome da rota dentro de `(autenticado)/(abas)`. */
  rota: 'index' | 'agenda' | 'programacoes' | 'comunidade' | 'perfil'
  href: '/' | '/agenda' | '/programacoes' | '/comunidade' | '/perfil'
  rotulo: string
  icone: NomeDoIcone
}

/** As cinco abas do app, na ordem em que aparecem (celular e web). */
export const ABAS: readonly DefinicaoDaAba[] = [
  { rota: 'index', href: '/', rotulo: 'Início', icone: 'inicio' },
  { rota: 'agenda', href: '/agenda', rotulo: 'Agenda', icone: 'agenda' },
  { rota: 'programacoes', href: '/programacoes', rotulo: 'Programações', icone: 'programacoes' },
  { rota: 'comunidade', href: '/comunidade', rotulo: 'Comunidade', icone: 'comunidade' },
  { rota: 'perfil', href: '/perfil', rotulo: 'Perfil', icone: 'perfil' },
]
