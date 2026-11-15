import { ErroLocal } from '@/servicos/erros'

import { MENSAGEM_DA_WEB } from './mensagens'
import type { DepositoLocal } from './tipos'

/**
 * Web: nada fica guardado para uso sem internet (ADR 0005). O navegador não
 * tem Keychain nem cifragem confiável do banco local, então a web não oferece
 * modo offline de evento; as telas explicam isso.
 */
export function criarDeposito(): DepositoLocal {
  return {
    disponivel: false,
    motivoIndisponivel: MENSAGEM_DA_WEB,
    abrir: async () => null,
    criar: async () => {
      throw new ErroLocal(MENSAGEM_DA_WEB)
    },
    listar: async () => [],
    apagar: async () => undefined,
    apagarVencidas: async () => [],
    apagarOutrasContas: async () => undefined,
    apagarTudo: async () => undefined,
  }
}

export const depositoPadrao: DepositoLocal = criarDeposito()
