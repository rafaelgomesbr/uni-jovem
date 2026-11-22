import type { NomeDoTraco } from '@/ui/IconeDeTraco'

export interface DefinicaoDaAba {
  /** Nome da rota dentro de `(autenticado)/(abas)`. */
  rota: 'index' | 'agenda' | 'comunidade' | 'perfil'
  href: '/' | '/agenda' | '/comunidade' | '/perfil'
  rotulo: string
  /** A aba Perfil mostra o avatar da pessoa no lugar do ícone. */
  icone: NomeDoTraco | 'avatar'
}

/**
 * As quatro abas, iguais em iOS, Android e web (D68, direção A): Início (o
 * cartão do momento, que vira o sol), Agenda (os encontros, com "Só o que é
 * meu"), Comunidade (avisos, oração e pessoas) e Perfil (a conta). A antiga aba
 * Escalas deixou de existir: `/escalas` e `/programacoes` redirecionam para a
 * Agenda (ver `Redirecionamentos`). Na web larga, a barra lateral repete os
 * atalhos da comunidade. Nenhuma aba ganha bolinha ou número: o sino é o único
 * lugar de "tem novidade".
 */
export const ABAS: readonly DefinicaoDaAba[] = [
  { rota: 'index', href: '/', rotulo: 'Início', icone: 'sol' },
  { rota: 'agenda', href: '/agenda', rotulo: 'Agenda', icone: 'abaAgenda' },
  { rota: 'comunidade', href: '/comunidade', rotulo: 'Comunidade', icone: 'abaComunidade' },
  { rota: 'perfil', href: '/perfil', rotulo: 'Perfil', icone: 'avatar' },
]
