/**
 * Capturas da tela de entrada (D63), tiradas da prévia local com o Playwright
 * do projeto, para o dono ver a tela sem aparelho. Mostra `entrada.inicio`,
 * `entrada.email` e o erro de senha, no iPhone SE (375x667) e no iPhone 15
 * (393x852), nos temas escuro e claro. A web não tem a Apple: o primário aqui é
 * o Google; a Apple no iOS só aparece no aparelho ou no simulador.
 *
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=ficticio.apps.googleusercontent.com npm run previa
 *   node --import tsx scripts/apresentacao/capturas-do-login.ts [base] [pasta]
 *
 * Sem o ID do Google no ambiente da prévia, a web não tem nenhum provedor e a
 * entrada já abre no painel de e-mail (o desenho manda), então `entrada.inicio`
 * não aparece. Só localhost: nada sai desta máquina, e nenhuma senha real é usada.
 */
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Page } from 'playwright'

const RAIZ = join(import.meta.dirname, '..', '..')
const BASE = process.argv[2] ?? 'http://localhost:8090'
const SAIDA = resolve(process.argv[3] ?? join(RAIZ, 'scripts', 'apresentacao', 'telas'))

const APARELHOS = [
  { id: 'se', largura: 375, altura: 667 },
  { id: '15', largura: 393, altura: 852 },
] as const

const TEMAS = ['dark', 'light'] as const

/** A cascata de abertura termina em 780 ms; sobra folga para o último quadro assentar. */
async function assentar(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(1600)
}

async function foto(page: Page, nome: string) {
  await page.screenshot({ path: join(SAIDA, `login-${nome}.jpg`), type: 'jpeg', quality: 86 })
  console.log(`ok login-${nome}.jpg`)
}

async function main() {
  mkdirSync(SAIDA, { recursive: true })
  const navegador = await chromium.launch()
  try {
    for (const aparelho of APARELHOS) {
      for (const tema of TEMAS) {
        // O claro só no iPhone 15: o escuro é o da captura reprovada, e o SE prova o aperto.
        if (tema === 'light' && aparelho.id === 'se') continue
        const sufixo = tema === 'light' ? '-claro' : ''
        const contexto = await navegador.newContext({
          viewport: { width: aparelho.largura, height: aparelho.altura },
          deviceScaleFactor: 2,
          colorScheme: tema,
          reducedMotion: 'no-preference',
          locale: 'pt-BR',
          timezoneId: 'America/Sao_Paulo',
        })
        const page = await contexto.newPage()
        const erros: string[] = []
        page.on('pageerror', (e) => erros.push(e.message))

        await page.goto(`${BASE}/app/entrar`)
        await assentar(page)
        await foto(page, `${aparelho.id}-inicio${sufixo}`)

        await page.goto(`${BASE}/app/entrar?modo=email`)
        await assentar(page)
        await foto(page, `${aparelho.id}-email${sufixo}`)

        // Erro: senha que não confere (a API da prévia responde 401 como a real).
        await page.getByLabel('E-mail', { exact: true }).fill('ana@exemplo.test')
        await page.getByLabel('Senha', { exact: true }).fill('uma frase que nao confere 1')
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        await page
          .getByText('E-mail ou senha não conferem.')
          .waitFor({ timeout: 10_000 })
          .catch(() => undefined)
        await page.waitForTimeout(600)
        await foto(page, `${aparelho.id}-erro${sufixo}`)

        if (erros.length > 0) console.error(`erros na página: ${erros.join(' | ')}`)
        await contexto.close()
      }
    }
  } finally {
    await navegador.close()
  }
}

await main()
