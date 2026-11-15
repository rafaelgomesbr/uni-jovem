/**
 * Tarefas diárias do servidor, com o papel DONO do banco (job sem usuário):
 *   1. retenção (uj.executar_retencao): inscrições e presenças avulsas
 *      vencidas anonimizadas, exportações vencidas, sessões, links e códigos
 *      expirados, e-mail de convites encerrados, cotas, disponibilidades
 *      antigas, notificações, idempotência offline e remoções de vínculo
 *      vencidas (efeito do art. 16);
 *   2. materialização das séries recorrentes (materializarTodas);
 *   3. poda do log de mudanças com mais de 90 dias, só abaixo da marca
 *      d'água (o cursor nunca perde linha que ainda não viu).
 *
 * O relatório vai para a saída padrão e só tem contagens (PRIV-05).
 *
 * Uso (no servidor, com o .env do ambiente carregado):
 *   DATABASE_URL_DONO=... node --import tsx apps/api/src/cli/tarefas-diarias.ts
 */
import pg from 'pg'
import { materializarTodas } from '../rotas/series.ts'

export const DIAS_DO_LOG_DE_MUDANCAS = 90

export async function executarTarefasDiarias(dono: pg.Pool): Promise<Record<string, unknown>> {
  const relatorio: Record<string, unknown> = { inicio: new Date().toISOString() }
  const retencao = await dono.query<{ r: Record<string, number> }>(
    'select uj.executar_retencao() as r',
  )
  relatorio['retencao'] = retencao.rows[0]!.r
  relatorio['ocorrencias_materializadas'] = await materializarTodas(dono)
  const poda = await dono.query<{ n: number }>('select uj.podar_mudancas($1) as n', [
    DIAS_DO_LOG_DE_MUDANCAS,
  ])
  relatorio['mudancas_podadas'] = poda.rows[0]!.n
  relatorio['fim'] = new Date().toISOString()
  return relatorio
}

const executadoDireto = process.argv[1]?.replace(/\\/g, '/').endsWith('cli/tarefas-diarias.ts')
if (executadoDireto) {
  const url = process.env['DATABASE_URL_DONO']
  if (!url) {
    console.error('Defina DATABASE_URL_DONO no ambiente.')
    process.exit(1)
  }
  const dono = new pg.Pool({ connectionString: url, max: 2 })
  try {
    const relatorio = await executarTarefasDiarias(dono)
    process.stdout.write(`${JSON.stringify(relatorio)}\n`)
  } catch (e) {
    // Mensagem do banco, sem parâmetros: as consultas daqui não levam dado pessoal.
    console.error(`Tarefas diárias falharam: ${(e as Error).message}`)
    process.exitCode = 1
  } finally {
    await dono.end()
  }
}
