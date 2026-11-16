import type { NomeDoTraco } from '@/ui/IconeDeTraco'

export interface DefinicaoDaAba {
  /** Nome da rota dentro de `(autenticado)/(abas)`. */
  rota: 'index' | 'agenda' | 'escalas' | 'comunidade' | 'perfil'
  href: '/' | '/agenda' | '/escalas' | '/comunidade' | '/perfil'
  rotulo: string
  /** A aba Perfil mostra o avatar da pessoa no lugar do ícone. */
  icone: NomeDoTraco | 'avatar'
}

/**
 * As cinco abas, iguais em iOS, Android e web (D57): Início, Agenda (o
 * calendário e a lista dos encontros), Escalas (as minhas convocações e a
 * disponibilidade), Comunidade (os atalhos da comunidade e as pessoas) e
 * Perfil (só a conta). Na web larga, a barra lateral repete os atalhos da
 * comunidade.
 */
export const ABAS: readonly DefinicaoDaAba[] = [
  { rota: 'index', href: '/', rotulo: 'Início', icone: 'abaInicio' },
  { rota: 'agenda', href: '/agenda', rotulo: 'Agenda', icone: 'abaAgenda' },
  { rota: 'escalas', href: '/escalas', rotulo: 'Escalas', icone: 'abaEscalas' },
  { rota: 'comunidade', href: '/comunidade', rotulo: 'Comunidade', icone: 'abaComunidade' },
  { rota: 'perfil', href: '/perfil', rotulo: 'Perfil', icone: 'avatar' },
]
