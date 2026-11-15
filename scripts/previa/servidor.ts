import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import http from 'node:http'
import { extname, resolve, sep } from 'node:path'

/**
 * Servidor da prévia: faz localmente o papel do Caddy da homologação
 * (infra/hml/caddy-extras.conf). Serve `/app` como SPA a partir da web
 * exportada, aplica os mesmos redirecionamentos e manda todo o resto para a API.
 */

export interface ServidorDaPrevia {
  parar(): Promise<void>
}

// Links que a API e os e-mails geram sem o prefixo /app. O navegador mantém o
// fragmento (#t=...) no redirecionamento, então o token não passa pelo servidor.
const REDIRECIONAMENTOS = new Map([
  ['/convite', '/app/convite'],
  ['/primeiro-acesso', '/app/primeiro-acesso'],
  ['/redefinir-senha', '/app/redefinir-senha'],
])

const TIPOS: Readonly<Partial<Record<string, string>>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
}

// Cabeçalhos de uma conexão só (RFC 9110), que um proxy não repassa.
const DE_UM_SALTO = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function responderTexto(res: http.ServerResponse, status: number, texto: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
  })
  res.end(texto)
}

/** `handle /app*` do Caddy: strip_prefix /app, try_files {path} {path}.html /index.html. */
async function servirApp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  caminhoDaUrl: string,
  pastaWeb: string,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    res.end()
    return
  }
  let caminho: string
  try {
    caminho = decodeURIComponent(caminhoDaUrl.slice('/app'.length))
  } catch {
    responderTexto(res, 400, 'Endereço inválido.')
    return
  }
  if (!caminho.startsWith('/')) caminho = `/${caminho}`
  for (const candidato of [caminho, `${caminho}.html`, '/index.html']) {
    const arquivo = resolve(pastaWeb, `.${candidato}`)
    // Nada fora da pasta exportada (../, barras invertidas, etc.).
    if (!arquivo.startsWith(pastaWeb + sep)) continue
    const info = await stat(arquivo).catch(() => null)
    if (!info?.isFile()) continue
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(arquivo).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // Igual ao Caddy para /_expo (nomes com hash). O resto revalida sempre,
      // para uma exportação nova aparecer sem limpar o cache do navegador.
      'Cache-Control': candidato.startsWith('/_expo/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(arquivo)
      .on('error', () => res.destroy())
      .pipe(res)
    return
  }
  responderTexto(res, 404, 'Não encontrado.')
}

/** Proxy para a API: mesmo método, corpo e cabeçalhos (inclusive Cookie e Set-Cookie). */
function encaminhar(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  portaDaApi: number,
  agente: http.Agent,
): void {
  const listadosEmConnection = String(req.headers.connection ?? '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
  const cabecalhos: http.OutgoingHttpHeaders = {}
  for (const [nome, valor] of Object.entries(req.headers)) {
    if (valor === undefined || DE_UM_SALTO.has(nome) || listadosEmConnection.includes(nome)) {
      continue
    }
    // Como o Caddy faz com cliente que não é proxy confiável: o X-Forwarded-* do
    // cliente é descartado e refeito a partir da conexão real.
    if (nome.startsWith('x-forwarded-')) continue
    cabecalhos[nome] = valor
  }
  cabecalhos['x-forwarded-for'] = req.socket.remoteAddress ?? '127.0.0.1'
  cabecalhos['x-forwarded-proto'] = 'http'
  if (req.headers.host) cabecalhos['x-forwarded-host'] = req.headers.host

  const pedido = http.request(
    {
      host: '127.0.0.1',
      port: portaDaApi,
      method: req.method,
      path: req.url,
      headers: cabecalhos,
      agent: agente,
    },
    (resposta) => {
      const saida: http.OutgoingHttpHeaders = {}
      for (const [nome, valor] of Object.entries(resposta.headers)) {
        if (valor !== undefined && !DE_UM_SALTO.has(nome)) saida[nome] = valor
      }
      res.writeHead(resposta.statusCode ?? 502, resposta.statusMessage, saida)
      resposta.on('error', () => res.destroy())
      resposta.pipe(res)
    },
  )
  pedido.on('error', () => {
    if (res.headersSent) {
      res.destroy()
      return
    }
    const corpo = JSON.stringify({
      erro: 'api_indisponivel',
      mensagem: 'A API da prévia não respondeu. Veja .previa/logs/api.log.',
    })
    res.writeHead(502, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(corpo),
      'Cache-Control': 'no-store',
    })
    res.end(corpo)
  })
  // Cliente desistiu (aba fechada, navegação): libera a conexão com a API.
  res.on('close', () => {
    if (!res.writableFinished) pedido.destroy()
  })
  req.pipe(pedido)
}

function escutar(servidor: http.Server, porta: number, host: string): Promise<void> {
  return new Promise((ok, falha) => {
    servidor.once('error', falha)
    servidor.listen(porta, host, () => {
      servidor.off('error', falha)
      ok()
    })
  })
}

/**
 * Escuta só nesta máquina, em 127.0.0.1 e ::1: `localhost` pode resolver para
 * qualquer um dos dois, e escutar em todas as interfaces exporia a prévia à rede.
 */
export async function iniciarServidor(opcoes: {
  porta: number
  pastaWeb: string
  portaDaApi: number
}): Promise<ServidorDaPrevia> {
  const pastaWeb = resolve(opcoes.pastaWeb)
  const agente = new http.Agent({ keepAlive: true })
  const atender = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const caminho = new URL(req.url ?? '/', 'http://localhost').pathname
    const destino = REDIRECIONAMENTOS.get(caminho)
    if (destino) {
      res.writeHead(302, { Location: destino, 'Content-Length': 0 })
      res.end()
      return
    }
    if (caminho.startsWith('/app')) {
      servirApp(req, res, caminho, pastaWeb).catch(() => {
        if (!res.headersSent) responderTexto(res, 500, 'Falha ao ler a web exportada.')
        else res.destroy()
      })
      return
    }
    encaminhar(req, res, opcoes.portaDaApi, agente)
  }

  const servidores: http.Server[] = []
  for (const host of ['127.0.0.1', '::1']) {
    const servidor = http.createServer(atender)
    try {
      await escutar(servidor, opcoes.porta, host)
      servidores.push(servidor)
    } catch (e) {
      const codigo = (e as NodeJS.ErrnoException).code
      // Máquina sem IPv6: fica só o 127.0.0.1.
      if (host === '::1' && (codigo === 'EADDRNOTAVAIL' || codigo === 'EAFNOSUPPORT')) continue
      await Promise.all(servidores.map((s) => new Promise((ok) => s.close(ok))))
      throw e
    }
  }

  return {
    async parar() {
      await Promise.all(
        servidores.map(
          (s) =>
            new Promise<void>((ok) => {
              s.close(() => ok())
              s.closeAllConnections()
            }),
        ),
      )
      agente.destroy()
    },
  }
}
