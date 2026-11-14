import type pg from 'pg'

/**
 * Toda operação do aplicativo roda numa transação com contexto. As políticas
 * RLS leem `app.conta_id` e `app.comunidade_id`; sem contexto, nada aparece.
 *
 * A comunidade aqui vem SEMPRE do caminho da rota já conferido contra o vínculo
 * da conta autenticada, nunca de corpo ou cabeçalho enviado pelo cliente.
 */
export interface Contexto {
  contaId: string | null
  comunidadeId: string | null
}

export async function emTransacao<T>(
  pool: pg.Pool,
  contexto: Contexto,
  trabalho: (cliente: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    await cliente.query(
      "select set_config('app.conta_id', $1, true), set_config('app.comunidade_id', $2, true)",
      [contexto.contaId ?? '', contexto.comunidadeId ?? ''],
    )
    const resultado = await trabalho(cliente)
    await cliente.query('commit')
    return resultado
  } catch (erro) {
    await cliente.query('rollback').catch(() => undefined)
    throw erro
  } finally {
    cliente.release()
  }
}
