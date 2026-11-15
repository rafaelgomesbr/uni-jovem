import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'

import {
  estadoDaPermissao,
  pedirPermissao,
  type EstadoDaPermissao,
} from '@/servicos/notificacoesDoSistema'

/**
 * Permissão de notificação do SISTEMA, que é diferente da preferência no app.
 * É estado externo: um só para o app inteiro, relido ao voltar ao primeiro
 * plano (a pessoa pode ter mudado nos Ajustes). `null` enquanto não leu.
 */
let atual: EstadoDaPermissao | null = null
const ouvintes = new Set<() => void>()
let assinado = false

function definir(novo: EstadoDaPermissao) {
  if (novo === atual) return
  atual = novo
  for (const o of ouvintes) o()
}

export async function relerPermissao(): Promise<EstadoDaPermissao> {
  const e = await estadoDaPermissao()
  definir(e)
  return e
}

/** Só depois de a pessoa tocar em "Ativar" numa tela que explica (TC-09). */
export async function pedirPermissaoEmContexto(): Promise<EstadoDaPermissao> {
  const e = await pedirPermissao()
  definir(e)
  return e
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  if (!assinado) {
    assinado = true
    void relerPermissao()
    AppState.addEventListener('change', (s) => {
      if (s === 'active') void relerPermissao()
    })
  }
  return () => {
    ouvintes.delete(ouvinte)
  }
}

const ler = () => atual

export function usePermissaoDoSistema(): EstadoDaPermissao | null {
  return useSyncExternalStore(assinar, ler, ler)
}

/** Para testes: volta ao estado inicial. */
export function reiniciarPermissaoParaTestes() {
  atual = null
  assinado = false
}
