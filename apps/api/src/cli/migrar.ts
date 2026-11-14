/**
 * Aplica as migrações pendentes com o papel dono (`uj_dono`).
 *
 * Uso (no servidor, com o .env do ambiente carregado):
 *   DATABASE_URL_DONO=... npx tsx apps/api/src/cli/migrar.ts
 *
 * Roda antes de subir uma versão nova da API; a API nunca migra sozinha,
 * porque o papel dela (`uj_api`) não é dono das tabelas.
 */
import { migrar } from '../banco/migrar.ts'

const url = process.env['DATABASE_URL_DONO']
if (!url) {
  console.error('Defina DATABASE_URL_DONO no ambiente.')
  process.exit(1)
}

try {
  const { aplicadas, jaAplicadas } = await migrar(url)
  console.warn(
    `Migrações: ${aplicadas.length} aplicada(s) agora, ${jaAplicadas.length} já estavam aplicadas.`,
  )
  for (const nome of aplicadas) console.warn(`  + ${nome}`)
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
}
