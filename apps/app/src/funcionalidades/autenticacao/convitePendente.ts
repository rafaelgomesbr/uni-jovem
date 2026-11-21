import { useSyncExternalStore } from 'react'

import { lerCodigoDaComunidade } from '../entrada/consultas'
import { lerTokenDoConvite } from '../comunidade/TelaEntrarComConvite'
import {
  descartarConviteEmEspera,
  guardarConviteEmEspera,
  lerConviteEmEspera,
} from '../convite/conviteEmEspera'
import { esquecerDestino, guardarDestino } from './destinoDepoisDeEntrar'

/**
 * O convite que a pessoa guardou antes de entrar (D63). Existem dois jeitos,
 * e os dois ficam só em memória (nada vai para disco, como já era):
 * - o link do convite (`/convite#t=...`): o token fica em `conviteEmEspera`, e
 *   o guarda do grupo público leva ao convite depois de entrar;
 * - o código da comunidade (`ABCD 2345` ou `/entrar/ABCD2345`): vira o destino
 *   depois de entrar, que abre "Tenho um código" já preenchido.
 */
export type ConvitePendente =
  { tipo: 'convite'; token: string } | { tipo: 'codigo'; codigo: string }

let codigoGuardado: string | null = null
let anterior: ConvitePendente | null = null
const ouvintes = new Set<() => void>()

function avisar() {
  for (const ouvinte of ouvintes) ouvinte()
}

/** O estado atual, lido das duas memórias: o token pode ter sido guardado ou descartado por outra tela. */
function ler(): ConvitePendente | null {
  const token = lerConviteEmEspera()
  const proximo: ConvitePendente | null = token
    ? { tipo: 'convite', token }
    : codigoGuardado
      ? { tipo: 'codigo', codigo: codigoGuardado }
      : null
  const igual =
    (proximo === null && anterior === null) ||
    (proximo !== null &&
      anterior !== null &&
      proximo.tipo === anterior.tipo &&
      (proximo.tipo === 'convite'
        ? anterior.tipo === 'convite' && anterior.token === proximo.token
        : anterior.tipo === 'codigo' && anterior.codigo === proximo.codigo))
  if (!igual) anterior = proximo
  return anterior
}

/** Reconhece o que a pessoa colou (link do convite, código da comunidade ou link do código). */
export function reconhecerConvite(texto: string): ConvitePendente | null {
  const token = lerTokenDoConvite(texto)
  if (token) return { tipo: 'convite', token }
  const codigo = lerCodigoDaComunidade(texto)
  if (codigo) return { tipo: 'codigo', codigo }
  return null
}

export function guardarConvitePendente(convite: ConvitePendente): void {
  if (convite.tipo === 'convite') {
    codigoGuardado = null
    esquecerDestino()
    guardarConviteEmEspera(convite.token)
  } else {
    descartarConviteEmEspera()
    codigoGuardado = convite.codigo
    guardarDestino(`/entrar/${convite.codigo}`)
  }
  avisar()
}

/** Tira o convite guardado e devolve o "desfazer" (o aviso "Convite removido. Desfazer"). */
export function removerConvitePendente(): () => void {
  const removido = ler()
  descartarConviteEmEspera()
  codigoGuardado = null
  esquecerDestino()
  avisar()
  return () => {
    if (removido) guardarConvitePendente(removido)
  }
}

export function useConvitePendente(): ConvitePendente | null {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    ler,
    ler,
  )
}

/** Só os testes. */
export function esquecerConvitePendenteParaTeste(): void {
  descartarConviteEmEspera()
  codigoGuardado = null
  anterior = null
  esquecerDestino()
  avisar()
}
