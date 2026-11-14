import pg from 'pg'
import { carregarConfig, ConfigInvalida, type Config } from './config.ts'
import {
  correioDesligado,
  correioEmArquivo,
  correioResend,
  type Correio,
} from './correio/correio.ts'
import { criarServidor } from './servidor.ts'

function criarCorreio(c: Config): Correio {
  switch (c.EMAIL_MODO) {
    case 'resend':
      return correioResend({ chave: c.RESEND_CHAVE!, remetente: c.EMAIL_REMETENTE! })
    case 'arquivo':
      return correioEmArquivo(c.NOTIFICADOR_ARQUIVO!)
    case 'desligado':
      return correioDesligado()
  }
}

let config: Config
try {
  config = carregarConfig(process.env)
} catch (erro) {
  if (erro instanceof ConfigInvalida) {
    console.error(erro.message)
    process.exit(1)
  }
  throw erro
}

const api = new pg.Pool({ connectionString: config.DATABASE_URL_API, max: 10 })
const auth = new pg.Pool({ connectionString: config.DATABASE_URL_AUTH, max: 5 })
const app = criarServidor(config, { api, auth, correio: criarCorreio(config) })

const encerrar = async () => {
  await app.close()
  await app.emAndamento()
  await Promise.all([api.end(), auth.end()])
  process.exit(0)
}
process.once('SIGTERM', () => void encerrar())
process.once('SIGINT', () => void encerrar())

await app.listen({ port: config.PORTA, host: config.HOST })
