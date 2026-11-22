import { Redirect, useLocalSearchParams, type Href } from 'expo-router'

import { parametro } from '@/utilidades/parametros'

/**
 * Parâmetros que a Agenda lê para abrir já no modo certo (contrato da D68):
 * `vista=lista` abre em Lista e `filtro=meu` marca "Só o que é meu".
 */
export const PARAMETROS_DA_AGENDA = { lista: 'lista', soMeu: 'meu' } as const

/** Para onde `/escalas` leva: a Agenda, em Lista, com "Só o que é meu". */
export const DESTINO_DE_ESCALAS: Href = {
  pathname: '/agenda',
  params: { vista: PARAMETROS_DA_AGENDA.lista, filtro: PARAMETROS_DA_AGENDA.soMeu },
}

/** Para onde `/programacoes` leva (com o encontro escolhido, se o link trouxe `?evento=`). */
export function destinoDeProgramacoes(evento: string | null): Href {
  return {
    pathname: '/agenda',
    params: { vista: PARAMETROS_DA_AGENDA.lista, ...(evento ? { evento } : {}) },
  }
}

/**
 * `/escalas` deixou de ser aba (D68): "Escalas" virou a linha "Sua parte" em
 * todo lugar onde há um encontro, e o que sobrou (as minhas convocações, os
 * pedidos de ajuda, os dias em que posso ajudar) mora na Agenda. A rota
 * continua existindo como redirecionamento, para que notificações antigas,
 * links universais e favoritos não quebrem.
 */
export function RedirecionarParaMinhaParte() {
  return <Redirect href={DESTINO_DE_ESCALAS} />
}

/**
 * `/programacoes` (antiga aba Programas, D57) também leva à Agenda em Lista,
 * agora com o mesmo comportamento da D68: links antigos continuam abrindo.
 */
export function RedirecionarParaAAgenda() {
  const evento = parametro(useLocalSearchParams<{ evento?: string }>().evento)
  return <Redirect href={destinoDeProgramacoes(evento)} />
}
