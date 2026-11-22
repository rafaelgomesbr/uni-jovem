/**
 * Capturas da fundação visual da direção A "Aurora Viva" (D65 e D67), tiradas do catálogo de
 * componentes (`/_catalogo`), que só existe em desenvolvimento (`__DEV__`): por isso o alvo é o
 * servidor de desenvolvimento do Expo, não a prévia exportada.
 *
 *   cd apps/app && CI=1 npx expo start --web --port 8085      (em outro terminal)
 *   node --import tsx scripts/apresentacao/capturas-da-fundacao.ts [base] [pasta]
 *
 * Gera `scripts/apresentacao/telas/fundacao-*.jpg`, no escuro e no claro. Só localhost: nada
 * sai desta máquina e o catálogo só usa dados fictícios.
 */
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Browser, type Locator, type Page } from 'playwright'

const RAIZ = join(import.meta.dirname, '..', '..')
const BASE = process.argv[2] ?? 'http://localhost:8085'
const SAIDA = resolve(process.argv[3] ?? join(RAIZ, 'scripts', 'apresentacao', 'telas'))

type Tema = 'escuro' | 'claro'
const TEMAS: readonly Tema[] = ['escuro', 'claro']

async function novaPagina(navegador: Browser, tema: Tema, reduzir = false): Promise<Page> {
  const contexto = await navegador.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    colorScheme: tema === 'escuro' ? 'dark' : 'light',
    reducedMotion: reduzir ? 'reduce' : 'no-preference',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  const page = await contexto.newPage()
  // O servidor de desenvolvimento não tem API: a sessão ausente (401) basta para o catálogo abrir.
  await page.route('**/api/**', (r) =>
    r.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        erro: { codigo: 'nao_autenticado', mensagem: 'Entre para continuar.' },
      }),
    }),
  )
  page.on('pageerror', (e) => console.log(`erro de página: ${e.message.split('\n')[0]}`))
  return page
}

async function abrir(page: Page, tema: Tema) {
  await page.goto(`${BASE}/_catalogo`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.getByText('Catálogo', { exact: true }).first().waitFor({ timeout: 180_000 })
  await dispensarAvisosDeDesenvolvimento(page)
  if (tema === 'claro') await page.getByRole('radio', { name: 'Claro', exact: true }).click()
  await page.waitForTimeout(1200)
}

/**
 * O servidor de desenvolvimento mostra a notificação do LogBox (avisos de props do react-native-web
 * que o app já tinha) por cima da barra de baixo. Ela não é do produto: é dispensada uma vez, pelo
 * "x" dela, e não volta (nenhum aviso novo aparece).
 */
async function dispensarAvisosDeDesenvolvimento(page: Page) {
  const aviso = page.getByText(/React does not recognize|non-boolean attribute/).first()
  const visivel = await aviso
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  if (!visivel) return
  const caixa = await aviso.boundingBox()
  if (!caixa) return
  await page.mouse.click(309, caixa.y + caixa.height / 2)
  await page.waitForTimeout(400)
}

async function foto(page: Page, nome: string) {
  await page.screenshot({ path: join(SAIDA, `fundacao-${nome}.jpg`), type: 'jpeg', quality: 88 })
  console.log(`ok fundacao-${nome}.jpg`)
}

/** Leva o título de um grupo do catálogo ao topo da janela e espera a rolagem assentar. */
async function irPara(page: Page, titulo: string | RegExp, folga = 96) {
  const alvo: Locator = page.getByText(titulo).first()
  await alvo.scrollIntoViewIfNeeded()
  await alvo.evaluate((el, f) => {
    let pai: HTMLElement | null = el.parentElement
    while (pai && pai.scrollHeight <= pai.clientHeight + 2) pai = pai.parentElement
    if (!pai) return
    const topo = el.getBoundingClientRect().top - pai.getBoundingClientRect().top
    pai.scrollTop += topo - f
  }, folga)
  await page.waitForTimeout(900)
}

async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo()
  } catch (e) {
    console.log(`pulou ${nome}: ${(e as Error).message.split('\n')[0]}`)
  }
}

async function capturar(navegador: Browser, tema: Tema) {
  const page = await novaPagina(navegador, tema)
  await abrir(page, tema)
  const t = (n: string) => `${n}-${tema === 'escuro' ? 'escuro' : 'claro'}`

  await tentar('sol', async () => {
    await irPara(page, 'O sol nascendo: as cinco poses')
    await foto(page, t('sol-cinco-poses'))
  })

  const momentos: [string, string][] = [
    ['Longe', 'longe'],
    ['No dia', 'dia'],
    ['Agora', 'agora'],
    ['Terminou', 'fim'],
  ]
  for (const [rotulo, nome] of momentos) {
    await tentar(`momento ${nome}`, async () => {
      await irPara(page, 'Momento: o sol e a luz de fundo falam juntos', 72)
      await page.getByRole('radio', { name: rotulo, exact: true }).click()
      await page.waitForTimeout(1600)
      await foto(page, t(`momento-${nome}`))
    })
  }

  await tentar('cartoes', async () => {
    await irPara(page, 'Cartão do momento: confirmado e sem sol (vazio)')
    await foto(page, t('cartoes'))
  })
  await tentar('linhas', async () => {
    await irPara(page, 'Linha de lista: 56 pt, ladrilho quente, estados')
    await foto(page, t('linhas'))
  })
  await tentar('checkin', async () => {
    await irPara(page, /Linha do check-in/)
    await page.getByRole('checkbox', { name: /Camila Nunes/ }).click()
    await page.waitForTimeout(500)
    await foto(page, t('checkin'))
  })
  await tentar('chips e esqueleto', async () => {
    await irPara(page, /Chip: situações/)
    await foto(page, t('chips-e-esqueleto'))
  })
  await tentar('toast', async () => {
    await irPara(page, /Toast com Desfazer/)
    await page.getByRole('button', { name: 'Publicar e avisar 11 pessoas' }).click()
    await page.waitForTimeout(3300)
    await foto(page, t('toast-com-desfazer'))
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await page.waitForTimeout(400)
  })
  await tentar('deslizar', async () => {
    await irPara(page, /Deslizar para responder/)
    await foto(page, t('deslizar-repouso'))
    const linha = page.getByTestId('frente-da-resposta').first()
    const caixa = await linha.boundingBox()
    if (!caixa) throw new Error('linha de resposta não achada')
    const y = caixa.y + caixa.height - 10
    await page.mouse.move(caixa.x + 40, y)
    await page.mouse.down()
    await page.mouse.move(caixa.x + 120, y, { steps: 8 })
    await page.mouse.move(caixa.x + 190, y, { steps: 8 })
    await page.waitForTimeout(300)
    await foto(page, t('deslizar-arrastando'))
    await page.mouse.move(caixa.x + 40, y, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(500)
  })
  await tentar('folha', async () => {
    await irPara(page, /Folha: alça/)
    await page.getByRole('button', { name: 'Abrir a folha' }).click()
    await page.waitForTimeout(900)
    await foto(page, t('folha'))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })
  await tentar('barra', async () => {
    await irPara(page, /Barra de abas flutuante/)
    await page
      .getByRole('link', { name: 'Comunidade' })
      .first()
      .click()
      .catch(() => undefined)
    await page.waitForTimeout(700)
    await foto(page, t('barra-de-abas'))
  })
  await tentar('movimento', async () => {
    await irPara(page, /Movimento: cascata/)
    await foto(page, t('movimento'))
  })
  await tentar('icones', async () => {
    await irPara(page, /Ícones: traço/)
    await foto(page, t('icones'))
  })
  await page.context().close()
}

async function main() {
  mkdirSync(SAIDA, { recursive: true })
  const navegador = await chromium.launch()
  try {
    for (const tema of TEMAS) await capturar(navegador, tema)
    // Reduzir movimento: o sol já no lugar e a luz sem deslocar (uma captura de conferência).
    const page = await novaPagina(navegador, 'escuro', true)
    await abrir(page, 'escuro')
    await tentar('reduzir movimento', async () => {
      await irPara(page, 'Momento: o sol e a luz de fundo falam juntos', 72)
      await page.getByRole('radio', { name: 'Agora', exact: true }).click()
      await page.waitForTimeout(600)
      await foto(page, 'momento-agora-reduzir-movimento')
    })
  } finally {
    await navegador.close()
  }
}

await main()
