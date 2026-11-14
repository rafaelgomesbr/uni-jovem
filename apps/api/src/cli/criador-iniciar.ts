/**
 * Uso (no servidor, com o .env do ambiente carregado):
 *   DATABASE_URL_DONO=... URL_PUBLICA=https://... \
 *     npx tsx apps/api/src/cli/criador-iniciar.ts --nome "Seu nome" --email voce@exemplo.com
 *
 * Imprime UM link de uso único, válido por 30 minutos. Abra no navegador para
 * definir a senha e o autenticador (2FA). O link não vai para log nem e-mail.
 */
import { parseArgs } from 'node:util'
import pg from 'pg'
import { iniciarCriador } from './criador.ts'

const { values } = parseArgs({
  options: { nome: { type: 'string' }, email: { type: 'string' } },
})
const url = process.env['DATABASE_URL_DONO']
const urlPublica = process.env['URL_PUBLICA']
if (!values.nome || !values.email || !url || !urlPublica) {
  console.error(
    'Informe --nome e --email, e as variáveis DATABASE_URL_DONO e URL_PUBLICA no ambiente.',
  )
  process.exit(1)
}

const dono = new pg.Pool({ connectionString: url, max: 1 })
try {
  const { link } = await iniciarCriador(dono, {
    nome: values.nome,
    email: values.email,
    urlPublica,
  })
  console.warn('\nLink de primeiro acesso (uso único, 30 minutos):\n')
  console.warn(`  ${link}\n`)
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await dono.end()
}
