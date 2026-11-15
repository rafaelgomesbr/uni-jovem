/**
 * Capturas de tela das lojas a partir da prévia local (`npm run previa`), com
 * os dados fictícios da semente. Gera as capturas cruas nos três tamanhos que
 * as lojas pedem (docs/lojas/capturas.md, seção 1) em docs/lojas/capturas/cru.
 *
 *   npm run previa            (em outro terminal, até "Prévia pronta")
 *   node --import tsx scripts/lojas/capturas.ts
 *
 * As senhas das contas fictícias são lidas de .previa/contas.txt e nunca
 * aparecem no terminal. Nada sai desta máquina: tudo fala com localhost.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'

const RAIZ = join(import.meta.dirname, '..', '..')
const BASE = process.env['UJ_CAPTURAS_URL'] ?? 'http://localhost:8090'
const SAIDA = join(RAIZ, 'docs', 'lojas', 'capturas', 'cru')

/** Tamanho lógico × escala 3 = tamanho exigido pela loja. */
export const APARELHOS = [
  { nome: 'apple-6.3', largura: 402, altura: 874 }, // 1206 × 2622 (obrigatório)
  { nome: 'apple-6.9', largura: 440, altura: 956 }, // 1320 × 2868
  { nome: 'play', largura: 360, altura: 640 }, // 1080 × 1920
] as const

function senhaDe(email: string): string {
  const contas = readFileSync(join(RAIZ, '.previa', 'contas.txt'), 'utf8')
  const linha = contas.split(/\r?\n/).find((l) => l.includes(email) && l.includes('senha:'))
  if (!linha) throw new Error(`Conta ${email} não encontrada em .previa/contas.txt`)
  return linha.split('senha:')[1]!.trim()
}

/** Espera a tela assentar: rede parada, sem esqueleto e sem animação (movimento reduzido). */
async function assentar(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, {
      timeout: 8000,
    })
    .catch(() => undefined)
  await page.waitForTimeout(1200)
}

async function entrar(page: Page, email: string) {
  await page.goto(`${BASE}/app/entrar`)
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senhaDe(email))
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/entrar'), { timeout: 20000 })
  await assentar(page)
  // Primeira entrada pode abrir o mapa da missão: pula para chegar ao Início.
  const pular = page.getByRole('button', { name: /Pular/ })
  if (await pular.isVisible().catch(() => false)) {
    await pular.click()
    await assentar(page)
  }
}

interface Tela {
  arquivo: string
  /** Abre a tela a partir de uma sessão já autenticada. */
  abrir: (page: Page) => Promise<void>
}

async function irPara(page: Page, caminho: string) {
  await page.goto(`${BASE}/app${caminho}`)
  await assentar(page)
}

async function abrirEvento(page: Page, titulo: RegExp) {
  await irPara(page, '/programacoes')
  await page.getByText(titulo).first().click()
  await assentar(page)
}

export const TELAS: Tela[] = [
  { arquivo: '01-inicio', abrir: (p) => irPara(p, '/') },
  {
    arquivo: '02-programacao',
    abrir: async (p) => {
      await abrirEvento(p, /Sábado Jovem/)
      const etapas = p.getByRole('tab', { name: /Etapas/ })
      if (await etapas.isVisible().catch(() => false)) {
        await etapas.click()
        await assentar(p)
      }
    },
  },
  { arquivo: '03-escalas', abrir: (p) => irPara(p, '/escalas') },
  { arquivo: '04-agenda', abrir: (p) => irPara(p, '/agenda') },
  { arquivo: '05-oracao', abrir: (p) => irPara(p, '/oracao') },
  { arquivo: '06-novo-pedido', abrir: (p) => irPara(p, '/oracao/novo') },
  { arquivo: '07-equipe', abrir: (p) => irPara(p, '/comunidade') },
  { arquivo: '08-perfil', abrir: (p) => irPara(p, '/perfil') },
  { arquivo: '09-avisos', abrir: (p) => irPara(p, '/avisos') },
  { arquivo: '10-convidar', abrir: (p) => irPara(p, '/convidar') },
]

async function principal() {
  const email = process.env['UJ_CAPTURAS_EMAIL'] ?? 'demo.admin@unijovem.invalid'
  const navegador = await chromium.launch()
  try {
    for (const aparelho of APARELHOS) {
      const pasta = join(SAIDA, aparelho.nome)
      mkdirSync(pasta, { recursive: true })
      const contexto = await navegador.newContext({
        viewport: { width: aparelho.largura, height: aparelho.altura },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
      })
      const page = await contexto.newPage()
      await entrar(page, email)
      for (const tela of TELAS) {
        try {
          await tela.abrir(page)
          await page.screenshot({ path: join(pasta, `${tela.arquivo}.png`) })
          console.log(`${aparelho.nome}/${tela.arquivo}.png`)
        } catch (e) {
          console.error(`${aparelho.nome}/${tela.arquivo}: ${(e as Error).message.split('\n')[0]}`)
        }
      }
      await contexto.close()
    }
  } finally {
    await navegador.close()
  }
}

await principal()
