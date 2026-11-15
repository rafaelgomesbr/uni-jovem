/**
 * Web: sem notificação nesta versão (plano, seção 8). Avisos e o versículo
 * aparecem no Início. As funções existem para as telas não se bifurcarem.
 */
import type { VersiculoAgendado } from '@/funcionalidades/versiculo/plano'

import type { EstadoDaPermissao, TokenDoAparelho } from './notificacoesDoSistema'

export type { EstadoDaPermissao, TokenDoAparelho } from './notificacoesDoSistema'

export const NOTIFICACOES_DISPONIVEIS = false

export async function estadoDaPermissao(): Promise<EstadoDaPermissao> {
  return 'indisponivel'
}

export async function pedirPermissao(): Promise<EstadoDaPermissao> {
  return 'indisponivel'
}

export async function abrirAjustes(): Promise<void> {}

export function configurarApresentacao() {}

export async function agendarVersiculos(_plano: readonly VersiculoAgendado[]): Promise<number> {
  return 0
}

export async function cancelarVersiculos(): Promise<void> {}

export async function tokenDoAparelho(): Promise<TokenDoAparelho | null> {
  return null
}
