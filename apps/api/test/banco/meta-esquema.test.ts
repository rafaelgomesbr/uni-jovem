import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { novoBanco, type BancoDeTeste } from '../apoio/banco.ts'

/**
 * O padrão que toda tabela de comunidade precisa seguir (cabeçalho de
 * 0001_nucleo.sql). Migração nova fora do padrão reprova aqui, antes de virar
 * vazamento ou consulta lenta.
 */

// Tabelas com comunidade_id que, por desenho, não entram no log de mudanças.
// `sync_operacoes` é o registro de idempotência da fila offline: anunciá-lo no
// log faria cada envio gerar uma mudança só para quem enviou, sem utilidade.
// `denuncias_de_comunidade` (ADR 0007) é da fila da Plataforma: anunciá-la no
// log contaria aos membros que alguém denunciou a comunidade.
const SEM_LOG = new Set(['auditoria', 'mudancas', 'sync_operacoes', 'denuncias_de_comunidade'])

let b: BancoDeTeste
beforeAll(async () => {
  b = await novoBanco()
})
afterAll(async () => {
  await b.encerrar()
})

async function tabelasComComunidade(): Promise<string[]> {
  const { rows } = await b.su.query<{ tabela: string }>(
    `select c.table_name as tabela from information_schema.columns c
       join information_schema.tables t
         on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'uj' and c.column_name = 'comunidade_id'
        and t.table_type = 'BASE TABLE'
      order by 1`,
  )
  return rows.map((r) => r.tabela)
}

describe('padrão das tabelas de comunidade', () => {
  it('toda tabela do esquema uj tem RLS habilitada', async () => {
    const { rows } = await b.su.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'uj' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(rows).toEqual([])
  })

  it('toda tabela com comunidade_id tem política para uj_api', async () => {
    const { rows } = await b.su.query<{ tablename: string }>(
      "select distinct tablename from pg_policies where schemaname = 'uj' and 'uj_api' = any (roles)",
    )
    const comPolitica = new Set(rows.map((r) => r.tablename))
    expect((await tabelasComComunidade()).filter((t) => !comPolitica.has(t))).toEqual([])
  })

  it('toda tabela com comunidade_id tem índice começando por comunidade_id', async () => {
    const { rows } = await b.su.query<{ tabela: string }>(
      `select distinct t.relname as tabela
         from pg_index i
         join pg_class t on t.oid = i.indrelid
         join pg_namespace n on n.oid = t.relnamespace
         join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
        where n.nspname = 'uj' and a.attname = 'comunidade_id'`,
    )
    const comIndice = new Set(rows.map((r) => r.tabela))
    expect((await tabelasComComunidade()).filter((t) => !comIndice.has(t))).toEqual([])
  })

  it('toda tabela com comunidade_id (exceto as de sistema) registra mudanças', async () => {
    const { rows } = await b.su.query<{ tabela: string }>(
      `select distinct c.relname as tabela
         from pg_trigger g
         join pg_class c on c.oid = g.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_proc p on p.oid = g.tgfoid
        where n.nspname = 'uj' and p.proname like 'registrar_mudanca%'`,
    )
    const comLog = new Set(rows.map((r) => r.tabela))
    const faltando = (await tabelasComComunidade()).filter((t) => !SEM_LOG.has(t) && !comLog.has(t))
    expect(faltando).toEqual([])
  })
})
