import { carregarConfig, ConfigInvalida } from './config.ts'
import { criarServidor } from './servidor.ts'

try {
  const config = carregarConfig(process.env)
  const app = criarServidor(config)
  await app.listen({ port: config.PORTA, host: '0.0.0.0' })
} catch (erro) {
  if (erro instanceof ConfigInvalida) {
    console.error(erro.message)
    process.exit(1)
  }
  throw erro
}
