import cookie from '@fastify/cookie'
import formbody from '@fastify/formbody'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import type pg from 'pg'
import { ErroHttp } from './http.ts'
import type { Config } from './config.ts'
import type { Correio } from './correio/correio.ts'
import { registrarRotasDeAutenticacao } from './rotas/autenticacao.ts'
import { registrarRotasDeComunidade } from './rotas/comunidades.ts'
import { registrarRotasDeEventos } from './rotas/eventos.ts'
import { registrarRotasDeSeries } from './rotas/series.ts'
import { registrarRotasDeEscalas } from './rotas/escalas.ts'
import { registrarRotaDeInicio } from './rotas/inicio.ts'
import { registrarRotasAoVivo } from './rotas/ao-vivo.ts'
import { registrarPaginasPublicas } from './publico/rotas.ts'
import { registrarRotasDeInscricoes } from './rotas/inscricoes.ts'
import { registrarContextoDeComunidade } from './rotas/contexto.ts'
import { registrarRotasDePlataforma } from './rotas/plataforma.ts'
import { registrarRotasDeOracao } from './rotas/oracao.ts'
import { registrarRotasDeSugestoes } from './rotas/sugestoes.ts'
import { registrarRotasDeConteudos } from './rotas/conteudos.ts'
import { registrarRotasDeAvisos } from './rotas/avisos.ts'
import { registrarRotasDeRelatorios } from './rotas/relatorios.ts'

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
): FastifyInstance & {
  emAndamento: () => Promise<void>
  rotas: () => { metodo: string; url: string }[]
} {
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
    // Só o proxy configurado (o Caddy) pode informar o IP do cliente.
    trustProxy: config.PROXIES_CONFIAVEIS,
    bodyLimit: 64 * 1024,
  })

  // Inventário de rotas: a suíte de isolamento percorre todas as rotas de
  // comunidade e reprova a que não tiver caso de teste.
  const rotas: { metodo: string; url: string }[] = []
  app.addHook('onRoute', (r) => {
    for (const m of [r.method].flat()) {
      if (m !== 'HEAD') rotas.push({ metodo: m, url: r.url })
    }
  })

  // Cabeçalhos de segurança em toda resposta da API. Respostas com tokens e
  // dados pessoais nunca ficam em cache (navegador, proxy ou CDN).
  app.addHook('onSend', async (_pedido, resposta) => {
    resposta.header('Cache-Control', 'no-store')
    resposta.header('X-Content-Type-Options', 'nosniff')
    resposta.header('Referrer-Policy', 'no-referrer')
    resposta.header('X-Frame-Options', 'DENY')
    resposta.header('Cross-Origin-Resource-Policy', 'same-origin')
    if (config.UJ_AMBIENTE !== 'desenvolvimento') {
      // Com includeSubDomains e sem preload, como o resto de *.solerte.com.br.
      resposta.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
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

  app.setErrorHandler((erro: FastifyError | ErroHttp, _pedido, resposta) => {
    if (erro instanceof ErroHttp) {
      // Conflito de edição leva a versão atual, para o app mostrar as duas.
      const atual = (erro as ErroHttp & { atual?: unknown }).atual
      return resposta.code(erro.status).send({
        erro: erro.codigo,
        mensagem: erro.message,
        ...(atual === undefined ? {} : { atual }),
      })
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
    void app.register(formbody, { bodyLimit: 16 * 1024 })
    app.after(() => {
      registrarRotasDeAutenticacao(
        app,
        { config, auth: recursos.auth, correio: recursos.correio, emSegundoPlano },
        recursos.fatorDeLimitePorIp === undefined
          ? {}
          : { fatorDeLimitePorIp: recursos.fatorDeLimitePorIp },
      )
      registrarContextoDeComunidade(app, recursos.api)
      const deps = { config, api: recursos.api, correio: recursos.correio, emSegundoPlano }
      registrarRotasDeComunidade(app, deps)
      registrarRotasDePlataforma(app, deps)
      registrarRotasDeEventos(app, recursos.api)
      registrarRotasDeSeries(app, recursos.api)
      registrarRotasDeEscalas(app, recursos.api)
      registrarRotaDeInicio(app, recursos.api)
      registrarRotasAoVivo(app, recursos.api)
      registrarRotasDeInscricoes(app, recursos.api)
      registrarRotasDeOracao(app, { api: recursos.api, config })
      registrarRotasDeSugestoes(app, recursos.api)
      registrarRotasDeConteudos(app, recursos.api)
      registrarRotasDeAvisos(app, recursos.api)
      registrarRotasDeRelatorios(app, recursos.api)
      registrarPaginasPublicas(app, {
        config,
        api: recursos.api,
        ...(config.TURNSTILE_CHAVE_DO_SITE
          ? { chaveDoSiteTurnstile: config.TURNSTILE_CHAVE_DO_SITE }
          : {}),
        ...(recursos.fatorDeLimitePorIp === undefined
          ? {}
          : { fatorDeLimitePorIp: recursos.fatorDeLimitePorIp }),
      })
    })
  }

  return Object.assign(app, {
    emAndamento: async () => {
      await Promise.all([...pendentes])
    },
    rotas: () => [...rotas],
  })
}
