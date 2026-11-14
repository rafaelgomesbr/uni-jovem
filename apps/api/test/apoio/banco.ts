import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { inject } from 'vitest'
import { emTransacao, type Contexto } from '../../src/banco/contexto.ts'
import { SENHAS_TESTE } from './postgres-global.ts'

/** Um banco novo, clonado do modelo migrado, com um pool por papel. */
export interface BancoDeTeste {
  nome: string
  su: pg.Pool
  dono: pg.Pool
  api: pg.Pool
  auth: pg.Pool
  /** Roda `sql` como `uj_api` com o contexto dado. */
  comoApi<T = Record<string, unknown>>(
    ctx: Partial<Contexto>,
    sql: string,
    params?: unknown[],
  ): Promise<T[]>
  encerrar(): Promise<void>
}

function url(usuario: string, senha: string, banco: string): string {
  return `postgres://${usuario}:${senha}@localhost:${inject('pgPorta')}/${banco}`
}

export async function novoBanco(): Promise<BancoDeTeste> {
  const nome = `uj_t_${randomBytes(6).toString('hex')}`
  const admin = new pg.Client({ connectionString: url('postgres', SENHAS_TESTE.su, 'postgres') })
  await admin.connect()
  await admin.query(`create database ${nome} template uj_modelo owner uj_dono`)
  await admin.query(`grant connect on database ${nome} to uj_api, uj_auth`)
  await admin.end()

  const su = new pg.Pool({
    connectionString: url('postgres', SENHAS_TESTE.su, nome),
    max: 2,
    connectionTimeoutMillis: 10_000,
  })
  const dono = new pg.Pool({
    connectionString: url('uj_dono', SENHAS_TESTE.dono, nome),
    max: 2,
    connectionTimeoutMillis: 10_000,
  })
  const api = new pg.Pool({
    connectionString: url('uj_api', SENHAS_TESTE.api, nome),
    max: 4,
    connectionTimeoutMillis: 10_000,
  })
  const auth = new pg.Pool({
    connectionString: url('uj_auth', SENHAS_TESTE.auth, nome),
    max: 4,
    connectionTimeoutMillis: 10_000,
  })

  return {
    nome,
    su,
    dono,
    api,
    auth,
    async comoApi<T>(ctx: Partial<Contexto>, sql: string, params: unknown[] = []) {
      return emTransacao(
        api,
        {
          contaId: ctx.contaId ?? null,
          comunidadeId: ctx.comunidadeId ?? null,
          prova: ctx.prova ?? null,
        },
        async (c) => (await c.query(sql, params)).rows as T[],
      )
    },
    async encerrar() {
      await Promise.all([su.end(), dono.end(), api.end(), auth.end()])
      const fim = new pg.Client({ connectionString: url('postgres', SENHAS_TESTE.su, 'postgres') })
      await fim.connect()
      await fim.query(`drop database if exists ${nome} with (force)`)
      await fim.end()
    },
  }
}

// ------------------------------------------------------------ fixtures (como superusuário)

export async function criarConta(
  b: BancoDeTeste,
  nome: string,
  opcoes: { proprietario?: boolean } = {},
): Promise<string> {
  const email = `${nome.toLowerCase().replace(/\W+/g, '.')}.${randomBytes(3).toString('hex')}@exemplo.test`
  const { rows } = await b.su.query<{ id: string }>(
    `insert into uj.contas (nome, email, email_verificado_em, plataforma_proprietario)
     values ($1, $2, now(), $3) returning id`,
    [nome, email, opcoes.proprietario ?? false],
  )
  return rows[0]!.id
}

/**
 * Prova de 2FA recente do Criador (o que a API grava depois de conferir o TOTP).
 * Devolve o valor cru, que vai no contexto como `prova`.
 */
export async function concederProva(b: BancoDeTeste, contaId: string): Promise<string> {
  const prova = randomBytes(32).toString('base64url')
  await b.su.query(
    `insert into uj.provas_de_plataforma (prova_hash, conta_id, expira_em)
     values (sha256(convert_to($1, 'UTF8')), $2, now() + interval '10 minutes')`,
    [prova, contaId],
  )
  return prova
}

export async function criarComunidade(b: BancoDeTeste, nome: string): Promise<string> {
  const { rows } = await b.su.query<{ id: string }>(
    'insert into uj.comunidades (nome) values ($1) returning id',
    [nome],
  )
  return rows[0]!.id
}

export async function vincular(
  b: BancoDeTeste,
  contaId: string,
  comunidadeId: string,
  papel: 'admin' | 'organizador' | 'membro',
): Promise<string> {
  // Como o dono (o mesmo caminho das funções atômicas de aceite de convite).
  const c = await b.su.connect()
  try {
    await c.query('begin')
    await c.query('set local role uj_dono')
    const { rows } = await c.query<{ id: string }>(
      'insert into uj.vinculos (conta_id, comunidade_id, papel) values ($1, $2, $3) returning id',
      [contaId, comunidadeId, papel],
    )
    await c.query('commit')
    return rows[0]!.id
  } catch (e) {
    await c.query('rollback')
    throw e
  } finally {
    c.release()
  }
}
