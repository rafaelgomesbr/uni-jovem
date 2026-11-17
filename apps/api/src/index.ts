import pg from 'pg'
import { carregarConfig, ConfigInvalida, type Config } from './config.ts'
import {
  correioDesligado,
  correioEmArquivo,
  correioResend,
  correioSmtp,
  type Correio,
} from './correio/correio.ts'
import { criarServidor } from './servidor.ts'
import { conferirPaginasPublicas } from './publico/documentos.ts'
import { criarTransporteDePush } from './notificacoes/configurar.ts'
import { aoNotificar } from './notificacoes/ganchos.ts'
import { TrabalhadorDePush } from './notificacoes/trabalhador.ts'

function criarCorreio(c: Config): Correio {
  switch (c.EMAIL_MODO) {
    case 'smtp':
      return correioSmtp({
        host: c.SMTP_HOST!,
        porta: c.SMTP_PORTA,
        usuario: c.SMTP_USUARIO!,
        senha: c.SMTP_SENHA!,
        remetente: c.EMAIL_REMETENTE!,
      })
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

const api = new pg.Pool({
  connectionString: config.DATABASE_URL_API,
  max: 10,
  connectionTimeoutMillis: 5_000,
})
const auth = new pg.Pool({
  connectionString: config.DATABASE_URL_AUTH,
  max: 5,
  connectionTimeoutMillis: 5_000,
})
const app = criarServidor(config, { api, auth, correio: criarCorreio(config) })

// Fila de push no próprio processo (papel uj_auth, só pelas funções push_*).
const transporte = await criarTransporteDePush(config)
const trabalhador = transporte
  ? new TrabalhadorDePush(auth, transporte, {
      aoRegistrar: (evento, detalhes) => app.log.warn(detalhes, evento),
    })
  : null
aoNotificar('aviso_publicado', () => trabalhador?.acordar())

const encerrar = async () => {
  await app.close()
  await app.emAndamento()
  await trabalhador?.parar()
  await Promise.all([api.end(), auth.end()])
  process.exit(0)
}
process.once('SIGTERM', () => void encerrar())
process.once('SIGINT', () => void encerrar())

// Páginas legais e de suporte com [PREENCHER]: em produção a API não sobe;
// nos outros ambientes, fica o aviso no log da partida.
try {
  const aviso = await conferirPaginasPublicas(app, config.UJ_AMBIENTE)
  if (aviso) app.log.warn(aviso)
} catch (erro) {
  console.error((erro as Error).message)
  await Promise.all([api.end(), auth.end()])
  process.exit(1)
}

await app.listen({ port: config.PORTA, host: config.HOST })
trabalhador?.iniciar()
