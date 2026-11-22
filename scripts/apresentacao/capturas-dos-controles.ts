/**
 * Capturas dos controles v2 (D64: botões e campos de texto), tiradas da prévia
 * local com o Playwright do projeto, para o dono ver sem aparelho. Telas com
 * muitos controles: entrada (SE 375x667, que tem de caber sem rolar), criar
 * conta, novo pedido de oração, nova programação, convidar, procurar comunidade
 * e perfil, no escuro e no claro, mais o foco e o erro de um campo.
 *
 *   npm run previa            (em outro terminal, até "Prévia pronta")
 *   node --import tsx scripts/apresentacao/capturas-dos-controles.ts [base] [pasta]
 *
 * As senhas das contas fictícias são lidas de .previa/contas.txt e nunca
 * aparecem no terminal. Só localhost: nada sai desta máquina.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const RAIZ = join(import.meta.dirname, '..', '..')
const BASE = process.argv[2] ?? 'http://localhost:8090'
const SAIDA = resolve(process.argv[3] ?? join(RAIZ, 'scripts', 'apresentacao', 'telas'))

type Tema = 'dark' | 'light'

function senhaDe(email: string): string {
  const contas = readFileSync(join(RAIZ, '.previa', 'contas.txt'), 'utf8')
  const linha = contas.split(/\r?\n/).find((l) => l.includes(email) && l.includes('senha:'))
  if (!linha) throw new Error(`Conta ${email} não encontrada em .previa/contas.txt`)
  return linha.split('senha:')[1]!.trim()
}

async function assentar(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, {
      timeout: 8000,
    })
    .catch(() => undefined)
  await page.waitForTimeout(1500)
}

async function novaPagina(
  navegador: Browser,
  tema: Tema,
  largura = 402,
  altura = 874,
): Promise<Page> {
  const contexto = await navegador.newContext({
    viewport: { width: largura, height: altura },
    deviceScaleFactor: 2,
    colorScheme: tema,
    reducedMotion: 'no-preference',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  return contexto.newPage()
}

async function foto(page: Page, nome: string, paginaInteira = false) {
  await page.screenshot({
    path: join(SAIDA, `controles-${nome}.jpg`),
    type: 'jpeg',
    quality: 86,
    fullPage: paginaInteira,
  })
  console.log(`ok controles-${nome}.jpg`)
}

async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo()
  } catch (e) {
    console.log(`pulou ${nome}: ${(e as Error).message.split('\n')[0]}`)
  }
}

async function entrar(page: Page, email: string) {
  await page.goto(`${BASE}/app/entrar?modo=email`)
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senhaDe(email))
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/entrar'), { timeout: 20000 })
  await assentar(page)
  const pular = page.getByRole('button', { name: /Pular/ })
  if (await pular.isVisible().catch(() => false)) {
    await pular.click()
    await assentar(page)
  }
  const termo = page.getByRole('checkbox', {
    name: 'Li e aceito o Termo do Administrador da Comunidade.',
  })
  if (await termo.isVisible().catch(() => false)) {
    await termo.click()
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click()
    await assentar(page)
  }
  const entendi = page.getByRole('button', { name: 'Entendi' })
  if (await entendi.isVisible().catch(() => false)) {
    await entendi.click()
    await assentar(page)
  }
}

async function irPara(page: Page, caminho: string) {
  await page.goto(`${BASE}/app${caminho}`)
  await assentar(page)
}

async function main() {
  mkdirSync(SAIDA, { recursive: true })
  const navegador = await chromium.launch()
  try {
    // Entrada no iPhone SE (375x667): o aperto que tem de caber sem rolar.
    for (const tema of ['dark', 'light'] as const) {
      const sufixo = tema === 'light' ? '-claro' : ''
      const page = await novaPagina(navegador, tema, 375, 667)
      await tentar(`login${sufixo}`, async () => {
        await irPara(page, '/entrar?modo=email')
        await foto(page, `login-email${sufixo}`)
        await page.getByLabel('E-mail', { exact: true }).click()
        await page.waitForTimeout(500)
        await foto(page, `login-foco${sufixo}`)
        await page.getByLabel('E-mail', { exact: true }).fill('ana@exemplo.test')
        await page.getByLabel('Senha', { exact: true }).fill('uma frase que nao confere 1')
        await page.getByRole('button', { name: 'Entrar', exact: true }).click()
        await page
          .getByText('E-mail ou senha não conferem.')
          .waitFor({ timeout: 10_000 })
          .catch(() => undefined)
        await page.waitForTimeout(700)
        await foto(page, `login-erro${sufixo}`)
      })
      await tentar(`login-inicio${sufixo}`, async () => {
        await irPara(page, '/entrar')
        await foto(page, `login-inicio${sufixo}`)
      })
      await tentar(`criar-conta${sufixo}`, async () => {
        await irPara(page, '/criar-conta')
        await foto(page, `criar-conta${sufixo}`)
      })
      await page.context().close()
    }

    // Telas de quem está dentro: administradora da prévia.
    for (const tema of ['dark', 'light'] as const) {
      const sufixo = tema === 'light' ? '-claro' : ''
      const page = await novaPagina(navegador, tema)
      await entrar(page, 'demo.admin@unijovem.invalid')
      for (const [caminho, nome] of [
        ['/oracao/novo', 'novo-pedido-de-oracao'],
        ['/evento/novo', 'nova-programacao'],
        ['/convidar', 'convidar'],
        ['/procurar-comunidade', 'procurar-comunidade'],
        ['/perfil', 'perfil'],
      ] as const) {
        await tentar(`${nome}${sufixo}`, async () => {
          await irPara(page, caminho)
          await foto(page, `${nome}${sufixo}`)
        })
      }
      // A nova programação inteira (formulário longo, com a barra de ação).
      await tentar(`nova-programacao-inteira${sufixo}`, async () => {
        await irPara(page, '/evento/novo')
        await page.evaluate(() => {
          const rolavel = [...document.querySelectorAll<HTMLElement>('*')].find(
            (el) =>
              el.scrollHeight > el.clientHeight + 200 &&
              getComputedStyle(el).overflowY !== 'visible',
          )
          if (rolavel) rolavel.scrollTop = rolavel.scrollHeight
        })
        await page.waitForTimeout(700)
        await foto(page, `nova-programacao-fim${sufixo}`)
      })
      await page.context().close()
    }
  } finally {
    await navegador.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
