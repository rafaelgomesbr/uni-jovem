import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import type { TestProject } from 'vitest/node'
import { migrar } from '../../src/banco/migrar.ts'

/**
 * Sobe UM Postgres 17 real para a execução inteira dos testes de banco, cria
 * os três papéis (mesmos nomes e atributos de infra/banco/papeis.sql) e um
 * banco-modelo já migrado. Cada arquivo de teste clona o modelo (`novoBanco`).
 * Senhas aqui são só de teste, num cluster efêmero que só escuta em localhost.
 */

export const SENHAS_TESTE = {
  su: 'su-teste',
  dono: 'dono-teste',
  api: 'api-teste',
  auth: 'auth-teste',
}

declare module 'vitest' {
  export interface ProvidedContext {
    pgPorta: number
  }
}

export default async function setup(projeto: TestProject) {
  const porta = 55000 + Math.floor(Math.random() * 4000)
  const pasta = join(tmpdir(), `uj-pg-${process.pid}-${porta}`)
  const servidor = new EmbeddedPostgres({
    databaseDir: pasta,
    user: 'postgres',
    password: SENHAS_TESTE.su,
    port: porta,
    // A pasta é apagada por nós no fim (com novas tentativas: no Windows o
    // arquivo pode continuar travado alguns instantes depois do stop).
    persistent: true,
    onLog: () => undefined,
    // Vários arquivos de teste em paralelo, cada um com seus pools: o padrão
    // de 100 conexões esgotava e o pool esperava para sempre.
    postgresFlags: ['-c', 'max_connections=400'],
  })
  await servidor.initialise()
  await servidor.start()

  const su = servidor.getPgClient()
  await su.connect()
  for (const [papel, senha] of [
    ['uj_dono', SENHAS_TESTE.dono],
    ['uj_api', SENHAS_TESTE.api],
    ['uj_auth', SENHAS_TESTE.auth],
  ] as const) {
    await su.query(
      `create role ${papel} login password '${senha}' nosuperuser nocreatedb nocreaterole nobypassrls`,
    )
  }
  // Mesmos limites de infra/banco/papeis.sql.
  for (const papel of ['uj_api', 'uj_auth']) {
    await su.query(`alter role ${papel} set statement_timeout = '15s'`)
    await su.query(`alter role ${papel} set idle_in_transaction_session_timeout = '30s'`)
    await su.query(`alter role ${papel} set lock_timeout = '5s'`)
  }
  await su.query('create database uj_modelo owner uj_dono')
  await su.end()

  await migrar(`postgres://uj_dono:${SENHAS_TESTE.dono}@localhost:${porta}/uj_modelo`)

  projeto.provide('pgPorta', porta)

  return async () => {
    await servidor.stop()
    await rm(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(
      () => undefined,
    )
  }
}
