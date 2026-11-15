/**
 * Teste de fumaça da web exportada: exporta o app (`expo export --platform
 * web`), serve como na homologação (/app como SPA, pelo servidor da prévia) e
 * abre telas públicas no Chromium do Playwright. Falha em qualquer erro de
 * execução da página ou se a tela de entrada não desenhar os campos.
 *
 * Existe porque, em 15/11/2026, a web publicada abriu em branco (a Aurora
 * importava a si mesma na web) com todos os testes verdes: o Jest resolve os
 * módulos como no celular e não pega erro que só acontece na web.
 *
 *   npm run fumaca:web
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { iniciarServidor } from './previa/servidor.ts'

const RAIZ = join(import.meta.dirname, '..')
const PORTA = 8097
const PORTA_DA_API_FALSA = 8098

/**
 * API falsa: responde 401 a tudo, como a API real responde a quem não entrou.
 * Assim o app abre as telas públicas de verdade, sem banco nem segredo.
 */
function apiSemSessao(): Promise<http.Server> {
  const servidor = http.createServer((_req, res) => {
    const corpo = JSON.stringify({ erro: 'nao_autenticado' })
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(corpo),
    })
    res.end(corpo)
  })
  return new Promise((ok, falha) => {
    servidor.once('error', falha)
    servidor.listen(PORTA_DA_API_FALSA, '127.0.0.1', () => ok(servidor))
  })
}

/** Telas públicas e o que precisa aparecer em cada uma. */
const TELAS = [
  { caminho: '/app/entrar', seletor: 'input', minimo: 2 },
  { caminho: '/app/recuperar-senha', seletor: 'input', minimo: 1 },
  // ADR 0007: cadastro aberto (nome e e-mail no primeiro passo).
  { caminho: '/app/criar-conta', seletor: 'input', minimo: 2 },
]

function exportar(destino: string) {
  const cli = join(RAIZ, 'node_modules', 'expo', 'bin', 'cli')
  const r = spawnSync(
    process.execPath,
    [cli, 'export', '--platform', 'web', '--output-dir', destino],
    {
      cwd: join(RAIZ, 'apps', 'app'),
      env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
      encoding: 'utf8',
    },
  )
  if (r.status !== 0) {
    throw new Error(`A exportação da web falhou:\n${(r.stderr || r.stdout).slice(-2000)}`)
  }
}

async function principal() {
  const pasta = mkdtempSync(join(tmpdir(), 'uj-fumaca-web-'))
  let falhas = 0
  try {
    console.log('Exportando a web...')
    exportar(pasta)
    const api = await apiSemSessao()
    const servidor = await iniciarServidor({
      porta: PORTA,
      pastaWeb: pasta,
      portaDaApi: PORTA_DA_API_FALSA,
    })
    const navegador = await chromium.launch()
    try {
      for (const tela of TELAS) {
        const page = await navegador.newPage({ viewport: { width: 390, height: 844 } })
        const erros: string[] = []
        page.on('pageerror', (e) => erros.push(e.message))
        await page.goto(`http://127.0.0.1:${PORTA}${tela.caminho}`)
        const desenhou = await page
          .waitForFunction(
            ({ seletor, minimo }) => document.querySelectorAll(seletor).length >= minimo,
            { seletor: tela.seletor, minimo: tela.minimo },
            { timeout: 20_000 },
          )
          .then(() => true)
          .catch(() => false)
        if (erros.length > 0 || !desenhou) {
          falhas++
          console.error(
            `FALHOU ${tela.caminho}: ${erros.join(' | ') || `sem ${tela.minimo} "${tela.seletor}"`}`,
          )
        } else {
          console.log(`ok ${tela.caminho}`)
        }
        await page.close()
      }
    } finally {
      await navegador.close()
      await servidor.parar()
      await new Promise((ok) => api.close(ok))
    }
  } finally {
    rmSync(pasta, { recursive: true, force: true })
  }
  if (falhas > 0) process.exitCode = 1
}

await principal()
