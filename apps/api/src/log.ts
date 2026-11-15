import type { FastifyServerOptions } from 'fastify'
import { truncarIp } from './autenticacao/limitador.ts'

/**
 * Registro técnico do servidor sem dado pessoal (mapa de dados, seção 9):
 * IP truncado (/24 no IPv4, /48 no IPv6), caminho sem a consulta, nenhum
 * cabeçalho, e redação de e-mail, telefone e token em qualquer texto que
 * chegue ao log (mensagens de erro inclusive).
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// Telefone em E.164 ou com DDD brasileiro, com ou sem separadores.
const TELEFONE = /(?:\+\d[\d\s().-]{7,18}\d)|(?:\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b)/g
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g
// Sequência longa que parece token (base64url, hexadecimal): 24 caracteres ou mais,
// com letra E número (nome_de_funcao_comprido não é token).
const TOKEN = /\b[A-Za-z0-9_-]{24,}\b/g
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

/** Redige o texto: identificadores (UUID) ficam, porque não identificam pessoa. */
export function redigir(texto: string): string {
  const uuids: string[] = []
  const protegido = texto.replace(UUID, (u) => {
    uuids.push(u)
    return `\u0000${uuids.length - 1}\u0000`
  })
  const limpo = protegido
    .replace(JWT, '[token]')
    .replace(EMAIL, '[e-mail]')
    .replace(TOKEN, (m) => (/\d/.test(m) && /[A-Za-z]/.test(m) ? '[token]' : m))
    .replace(TELEFONE, '[telefone]')
  // eslint-disable-next-line no-control-regex
  return limpo.replace(/\u0000(\d+)\u0000/g, (_, i: string) => uuids[Number(i)] ?? '')
}

/** Aplica `redigir` em todo texto de um objeto de log (cópia, sem mexer no original). */
export function redigirObjeto(valor: unknown, profundidade = 0): unknown {
  if (typeof valor === 'string') return redigir(valor)
  if (profundidade > 5 || valor === null || typeof valor !== 'object') return valor
  if (Array.isArray(valor)) return valor.map((v) => redigirObjeto(v, profundidade + 1))
  // Objetos com classe (pedido, resposta, erro) seguem intactos: quem os trata
  // são os serializadores abaixo, que já devolvem só campos seguros.
  const prototipo = Object.getPrototypeOf(valor) as unknown
  if (prototipo !== Object.prototype && prototipo !== null) return valor
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
      k,
      redigirObjeto(v, profundidade + 1),
    ]),
  )
}

export function caminhoSemConsulta(url: string | undefined): string {
  const caminho = (url ?? '').split('?')[0]!.split('#')[0]!
  // O código da comunidade (ADR 0007) tem 8 caracteres: curto demais para a
  // redação de tokens, e dá entrada na comunidade. Sai do registro.
  return redigir(caminho.replace(/^(\/(?:app\/)?entrar\/)[^/]+/i, '$1[codigo]'))
}

interface PedidoDoLog {
  method?: string
  url?: string
  ip?: string
  socket?: { remoteAddress?: string }
}

export const serializadores = {
  req(pedido: PedidoDoLog) {
    const ip = pedido.ip ?? pedido.socket?.remoteAddress ?? ''
    return {
      metodo: pedido.method,
      caminho: caminhoSemConsulta(pedido.url),
      ip: ip ? truncarIp(ip) : null,
    }
  },
  res(resposta: { statusCode?: number }) {
    return { status: resposta.statusCode }
  },
  err(erro: { name?: string; message?: string; code?: string }) {
    // Sem pilha: caminhos e valores de variáveis não precisam ir para o registro.
    return {
      type: erro.name ?? 'Error',
      message: redigir(erro.message ?? ''),
      stack: '',
      codigo: erro.code,
    }
  },
}

/** Opções do pino para o Fastify (homologação e produção). */
export function opcoesDoLog(
  extra: { stream?: { write(msg: string): void } } = {},
): Exclude<FastifyServerOptions['logger'], boolean | undefined> {
  return {
    level: 'info',
    // Cabeçalhos nunca entram (os serializadores não os copiam); a lista
    // abaixo é a segunda barreira, caso algum código registre o pedido inteiro.
    redact: ['req.headers', 'res.headers', 'headers', '*.authorization', '*.cookie'],
    serializers: serializadores,
    formatters: {
      log: (objeto: Record<string, unknown>) => redigirObjeto(objeto) as Record<string, unknown>,
    },
    hooks: {
      logMethod(this: unknown, argumentos: unknown[], metodo: (...a: unknown[]) => void) {
        metodo.apply(
          this,
          argumentos.map((a) => (typeof a === 'string' ? redigir(a) : a)),
        )
      },
    },
    ...(extra.stream ? { stream: extra.stream } : {}),
  } as unknown as Exclude<FastifyServerOptions['logger'], boolean | undefined>
}
