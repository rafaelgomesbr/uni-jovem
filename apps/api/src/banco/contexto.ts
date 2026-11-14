import type pg from 'pg'

/**
 * Toda operação do aplicativo roda numa transação com contexto. As políticas
 * RLS leem `app.conta_id` e `app.comunidade_id`; sem contexto, nada aparece.
 *
 * A comunidade aqui vem SEMPRE do caminho da rota já conferido contra o vínculo
 * da conta autenticada, nunca de corpo ou cabeçalho enviado pelo cliente.
 *
 * `prova` é a prova de 2FA recente do Criador (claim do token de acesso). Sem
 * ela, o banco não reconhece poderes de plataforma, mesmo que alguém forje
 * `app.conta_id` (ver 0001_nucleo.sql, uj.eh_proprietario).
 */
export interface Contexto {
  contaId: string | null
  comunidadeId: string | null
  prova?: string | null
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
      `select set_config('app.conta_id', $1, true),
              set_config('app.comunidade_id', $2, true),
              set_config('app.prova', $3, true)`,
      [contexto.contaId ?? '', contexto.comunidadeId ?? '', contexto.prova ?? ''],
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
