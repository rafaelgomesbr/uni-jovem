import cookie from '@fastify/cookie'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import type pg from 'pg'
import { ErroDeAuth } from './autenticacao/servico.ts'
import type { Config } from './config.ts'
import type { Correio } from './correio/correio.ts'
import { registrarRotasDeAutenticacao } from './rotas/autenticacao.ts'

export interface Recursos {
  api: pg.Pool
  auth: pg.Pool
  correio: Correio
  /** Só testes: todos os pedidos saem do mesmo IP. Nunca usado em produção. */
  fatorDeLimitePorIp?: number
}

/**
 * Monta o servidor sem abrir porta, para que os testes usem `inject`.
 * Sem `recursos`, só a rota de saúde (útil para testar a configuração).
 */
export function criarServidor(
  config: Config,
  recursos?: Recursos,
): FastifyInstance & { emAndamento: () => Promise<void> } {
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
    bodyLimit: 64 * 1024,
  })

  // Trabalho depois da resposta (e-mail). Guardado para os testes e o desligamento.
  const pendentes = new Set<Promise<unknown>>()
  const emSegundoPlano = (trabalho: Promise<unknown>) => {
    const p = trabalho
      .catch((e: unknown) =>
        app.log.error({ erro: (e as Error).message }, 'falha em segundo plano'),
      )
      .finally(() => pendentes.delete(p))
    pendentes.add(p)
  }

  app.setErrorHandler((erro: FastifyError | ErroDeAuth, _pedido, resposta) => {
    if (erro instanceof ErroDeAuth) {
      return resposta.code(erro.status).send({ erro: erro.codigo, mensagem: erro.message })
    }
    if ((erro as FastifyError).statusCode && (erro as FastifyError).statusCode! < 500) {
      return resposta
        .code((erro as FastifyError).statusCode!)
        .send({ erro: 'pedido_invalido', mensagem: 'Não entendemos este pedido.' })
    }
    app.log.error({ erro: erro.message }, 'erro interno')
    return resposta.code(500).send({
      erro: 'interno',
      mensagem: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
    })
  })

  app.get('/api/saude', async () => ({ ok: true, ambiente: config.UJ_AMBIENTE }))

  if (recursos) {
    void app.register(cookie)
    app.after(() => {
      registrarRotasDeAutenticacao(
        app,
        { config, auth: recursos.auth, correio: recursos.correio, emSegundoPlano },
        recursos.fatorDeLimitePorIp === undefined
          ? {}
          : { fatorDeLimitePorIp: recursos.fatorDeLimitePorIp },
      )
    })
  }

  return Object.assign(app, {
    emAndamento: async () => {
      await Promise.all([...pendentes])
    },
  })
}
