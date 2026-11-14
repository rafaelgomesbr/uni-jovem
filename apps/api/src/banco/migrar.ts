import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'

/**
 * Executor de migrações. Aplica, em ordem, os arquivos `NNNN_nome.sql` ainda
 * não aplicados, cada um na sua transação, e recusa seguir se um arquivo já
 * aplicado mudou (checksum diferente): migração publicada não se edita, se
 * corrige com outra migração.
 */

export const PASTA_MIGRACOES = join(import.meta.dirname, '..', '..', 'migracoes')

export interface ResultadoMigracao {
  aplicadas: string[]
  jaAplicadas: string[]
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
}

export async function migrar(
  urlDono: string,
  pasta: string = PASTA_MIGRACOES,
): Promise<ResultadoMigracao> {
  const cliente = new pg.Client({ connectionString: urlDono })
  await cliente.connect()
  try {
    await cliente.query(`
      create table if not exists public.migracoes_aplicadas (
        nome text primary key,
        checksum text not null,
        aplicada_em timestamptz not null default now()
      )`)

    const arquivos = (await readdir(pasta)).filter((a) => /^\d{4}_[a-z0-9_]+\.sql$/.test(a)).sort()
    const { rows } = await cliente.query<{ nome: string; checksum: string }>(
      'select nome, checksum from public.migracoes_aplicadas',
    )
    const registradas = new Map(rows.map((r) => [r.nome, r.checksum]))

    const resultado: ResultadoMigracao = { aplicadas: [], jaAplicadas: [] }
    for (const arquivo of arquivos) {
      const sql = await readFile(join(pasta, arquivo), 'utf8')
      const soma = checksum(sql)
      const anterior = registradas.get(arquivo)
      if (anterior !== undefined) {
        if (anterior !== soma) {
          throw new Error(
            `A migração ${arquivo} já aplicada foi alterada. Crie uma migração nova em vez de editar.`,
          )
        }
        resultado.jaAplicadas.push(arquivo)
        continue
      }
      await cliente.query('begin')
      try {
        await cliente.query(sql)
        await cliente.query(
          'insert into public.migracoes_aplicadas (nome, checksum) values ($1, $2)',
          [arquivo, soma],
        )
        await cliente.query('commit')
      } catch (erro) {
        await cliente.query('rollback')
        throw new Error(`Falha ao aplicar ${arquivo}: ${(erro as Error).message}`, { cause: erro })
      }
      resultado.aplicadas.push(arquivo)
    }
    return resultado
  } finally {
    await cliente.end()
  }
}
