import type { NomeDoTraco } from '@/ui/IconeDeTraco'

export interface DefinicaoDaAba {
  /** Nome da rota dentro de `(autenticado)/(abas)`. */
  rota: 'index' | 'agenda' | 'programacoes' | 'comunidade' | 'perfil'
  href: '/' | '/agenda' | '/programacoes' | '/comunidade' | '/perfil'
  rotulo: string
  /** A aba Perfil mostra o avatar da pessoa no lugar do ícone. */
  icone: NomeDoTraco | 'avatar'
}

/**
 * As cinco abas, iguais em iOS, Android e web (mockup Aurora): Início, Agenda,
 * Programas, Equipe e Perfil. Os módulos que não são aba (oração, avisos,
 * relatórios...) ficam no Perfil, nos atalhos do Início e, na web larga, na
 * barra lateral.
 */
export const ABAS: readonly DefinicaoDaAba[] = [
  { rota: 'index', href: '/', rotulo: 'Início', icone: 'abaInicio' },
  { rota: 'agenda', href: '/agenda', rotulo: 'Agenda', icone: 'abaAgenda' },
  { rota: 'programacoes', href: '/programacoes', rotulo: 'Programas', icone: 'abaProgramas' },
  { rota: 'comunidade', href: '/comunidade', rotulo: 'Equipe', icone: 'abaEquipe' },
  { rota: 'perfil', href: '/perfil', rotulo: 'Perfil', icone: 'avatar' },
]
