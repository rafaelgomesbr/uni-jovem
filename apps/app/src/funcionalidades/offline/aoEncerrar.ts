import { registrarAoEncerrarSessao } from '@/estado/aoEncerrarSessao'

import { limparPdfsAbertos } from '../pdf/abrirPdf'
import { guardarDescarte } from './descartadas'
import type { DepositoLocal, OperacaoNaFila } from './tipos'

/**
 * Sair da conta (ou ter a sessão revogada) apaga TODAS as partições deste
 * aparelho. Antes, o que não foi enviado vai para a memória, para a tela de
 * entrada mostrar o que se perdeu.
 */
export function ligarLimpezaAoSair(deposito: DepositoLocal): () => void {
  return registrarAoEncerrarSessao(async () => {
    const naoEnviadas: OperacaoNaFila[] = []
    for (const r of await deposito.listar()) {
      const p = await deposito.abrir(r.contaId, r.comunidadeId).catch(() => null)
      if (p) naoEnviadas.push(...(await p.operacoes().catch(() => [])))
    }
    guardarDescarte('sessao', naoEnviadas)
    await deposito.apagarTudo()
    // O PDF aberto para ler fica no cache do app: sai junto com a conta (D76).
    limparPdfsAbertos()
  })
}
