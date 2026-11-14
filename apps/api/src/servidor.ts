import Fastify, { type FastifyInstance } from 'fastify'
import type { Config } from './config.ts'

/** Monta o servidor sem abrir porta, para que os testes usem `inject`. */
export function criarServidor(config: Config): FastifyInstance {
  const app = Fastify({
    logger:
      config.UJ_AMBIENTE === 'desenvolvimento'
        ? false
        : {
            level: 'info',
            // Nada de cabeçalho de autorização, cookie ou corpo em log.
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
          },
    trustProxy: true,
  })

  app.get('/api/saude', async () => ({ ok: true, ambiente: config.UJ_AMBIENTE }))

  return app
}
