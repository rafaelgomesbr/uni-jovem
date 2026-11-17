import cookie from '@fastify/cookie'
import formbody from '@fastify/formbody'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import type pg from 'pg'
import { NOME_DO_APP } from '@uj/dominio'
import { ErroHttp } from './http.ts'
import { CSP_PUBLICA, html, pagina } from './publico/html.ts'
import { opcoesDoLog } from './log.ts'
import type { Config } from './config.ts'
import { EmailDesligado, FalhaNoEnvio, type Correio } from './correio/correio.ts'
import {
  criarVerificadorDeProvedores,
  type ChavesDosProvedores,
} from './autenticacao/provedores.ts'
import { registrarRotasDeAutenticacao } from './rotas/autenticacao.ts'
import { registrarRotasDeComunidade } from './rotas/comunidades.ts'
import { registrarRotasDeAbertura } from './rotas/abertura.ts'
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
import { registrarRotasDeNotificacoes } from './rotas/notificacoes.ts'
import { registrarRotasDePrivacidade } from './rotas/privacidade.ts'
import { registrarRotasDeSincronizacao } from './rotas/sincronizacao.ts'
import { registrarRotasDeImagens } from './rotas/imagens.ts'
import { registrarRotasDeBloqueios } from './rotas/bloqueios.ts'
import { registrarDocumentosPublicos } from './publico/documentos.ts'

export interface Recursos {
  api: pg.Pool
  auth: pg.Pool
  correio: Correio
  /** Só testes: todos os pedidos saem do mesmo IP. Nunca usado em produção. */
  fatorDeLimitePorIp?: number
  /** Só testes: chaves locais no lugar do JWKS de Google e Apple. */
  chavesDosProvedores?: ChavesDosProvedores
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
    // Fora de desenvolvimento: IP truncado, sem cabeçalho, consulta ou corpo, e
    // redação de e-mail, telefone e token (src/log.ts).
    logger: config.UJ_AMBIENTE === 'desenvolvimento' ? false : opcoesDoLog(),
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
  // dados pessoais nunca ficam em cache (navegador, proxy ou CDN). Exceção: a
  // rota que define o próprio Cache-Control: as imagens de rotas/imagens.ts
  // (private, no-cache: revalida a cada uso) e o CSS público (cache curto).
  app.addHook('onSend', async (_pedido, resposta) => {
    if (!resposta.hasHeader('Cache-Control')) resposta.header('Cache-Control', 'no-store')
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
      // `extra`: o que a tela precisa para oferecer a saída (ex.: nomear admin).
      const extra = (erro as ErroHttp & { extra?: Record<string, unknown> }).extra
      return resposta.code(erro.status).send({
        ...(extra ?? {}),
        erro: erro.codigo,
        mensagem: erro.message,
        ...(atual === undefined ? {} : { atual }),
      })
    }
    if ((erro as FastifyError).statusCode === 413) {
      // Corpo acima do limite da rota (ex.: imagem acima de 2 MB em base64).
      return resposta.code(413).send({
        erro: 'grande_demais',
        mensagem: 'O envio passou do tamanho permitido. Use um arquivo menor e tente de novo.',
      })
    }
    if ((erro as FastifyError).statusCode && (erro as FastifyError).statusCode! < 500) {
      return resposta
        .code((erro as FastifyError).statusCode!)
        .send({ erro: 'pedido_invalido', mensagem: 'Não entendemos este pedido.' })
    }
    if (erro instanceof FalhaNoEnvio || erro instanceof EmailDesligado) {
      app.log.error({ erro: erro.message }, 'falha no envio de e-mail')
      return resposta.code(503).send({
        erro: 'email_indisponivel',
        mensagem: 'Não conseguimos enviar o e-mail agora. Tente de novo em instantes.',
      })
    }
    app.log.error({ erro: erro.message }, 'erro interno')
    return resposta.code(500).send({
      erro: 'interno',
      mensagem: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
    })
  })

  // Endereço que não existe: mensagem em português, JSON para a API e página
  // para quem chegou pelo navegador (com a mesma CSP das páginas públicas).
  app.setNotFoundHandler((pedido, resposta) => {
    const caminho = pedido.url.split('?')[0] ?? ''
    if (caminho === '/api' || caminho.startsWith('/api/')) {
      return resposta.code(404).send({
        erro: 'nao_encontrado',
        mensagem: 'Não encontramos este endereço. Confira o link ou atualize o app.',
      })
    }
    return resposta
      .code(404)
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Content-Security-Policy', CSP_PUBLICA)
      .send(
        pagina(
          html`<h1>Página não encontrada</h1>
            <p>
              O endereço pode ter sido digitado errado ou a página não existe mais. Confira o link
              com quem compartilhou.
            </p>
            <p><a href="/">Ir para o início do ${NOME_DO_APP}</a></p>`,
          { titulo: 'Página não encontrada', indexavel: false },
        ),
      )
  })

  // Vivo: o processo responde (o healthcheck do contêiner usa esta).
  app.get('/api/saude', async () => ({ ok: true, ambiente: config.UJ_AMBIENTE }))

  if (recursos) {
    // Pronto: além de vivo, alcança o banco com os dois papéis. Sem detalhe
    // técnico na resposta (o motivo vai para o log).
    app.get('/api/pronto', async (_pedido, resposta) => {
      try {
        await Promise.all([recursos.api.query('select 1'), recursos.auth.query('select 1')])
        return { ok: true }
      } catch (e) {
        app.log.error({ erro: (e as Error).message }, 'banco indisponível')
        return resposta.code(503).send({
          ok: false,
          erro: 'indisponivel',
          mensagem: 'O serviço está iniciando ou em manutenção. Tente de novo em instantes.',
        })
      }
    })

    void app.register(cookie)
    void app.register(formbody, { bodyLimit: 16 * 1024 })
    app.after(() => {
      const verificador = criarVerificadorDeProvedores(config, recursos.chavesDosProvedores)
      registrarRotasDeAutenticacao(
        app,
        { config, auth: recursos.auth, correio: recursos.correio, emSegundoPlano },
        {
          verificador,
          ...(recursos.fatorDeLimitePorIp === undefined
            ? {}
            : { fatorDeLimitePorIp: recursos.fatorDeLimitePorIp }),
        },
      )
      registrarContextoDeComunidade(app, recursos.api)
      const deps = { config, api: recursos.api, correio: recursos.correio, emSegundoPlano }
      registrarRotasDeComunidade(app, deps)
      registrarRotasDeAbertura(app, {
        ...deps,
        ...(recursos.fatorDeLimitePorIp === undefined
          ? {}
          : { fatorDeLimitePorIp: recursos.fatorDeLimitePorIp }),
      })
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
      registrarRotasDeNotificacoes(app, recursos.api)
      registrarRotasDePrivacidade(app, {
        config,
        api: recursos.api,
        auth: recursos.auth,
        correio: recursos.correio,
        emSegundoPlano,
        verificador,
      })
      registrarRotasDeSincronizacao(app, recursos.api)
      registrarRotasDeImagens(app, recursos.api)
      registrarRotasDeBloqueios(app, recursos.api)
      registrarDocumentosPublicos(app, { config })
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
