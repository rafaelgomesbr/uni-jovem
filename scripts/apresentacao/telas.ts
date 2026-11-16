/**
 * Telas reais do app para a apresentação ao dono, tiradas da prévia local
 * (`npm run previa`) com os dados fictícios da semente. Diferente das capturas
 * das lojas, sem moldura nem legenda: é o app como ele aparece no iPhone.
 *
 *   npm run previa            (em outro terminal, até "Prévia pronta")
 *   node --import tsx scripts/apresentacao/telas.ts <pasta de saída>
 *
 * As senhas das contas fictícias são lidas de .previa/contas.txt e nunca
 * aparecem no terminal. Nada sai desta máquina: tudo fala com localhost.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const RAIZ = join(import.meta.dirname, '..', '..')
const BASE = 'http://localhost:8090'
const SAIDA = resolve(process.argv[2] ?? join(RAIZ, '.previa', 'telas'))

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
  await page.waitForTimeout(1200)
}

async function novaPagina(navegador: Browser): Promise<Page> {
  const contexto = await navegador.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  return contexto.newPage()
}

async function foto(page: Page, nome: string) {
  await page.screenshot({ path: join(SAIDA, `${nome}.jpg`), type: 'jpeg', quality: 82 })
  console.log(`ok ${nome}`)
}

async function tentar(nome: string, passo: () => Promise<void>) {
  try {
    await passo()
  } catch (e) {
    console.log(`pulou ${nome}: ${(e as Error).message.split('\n')[0]}`)
  }
}

async function entrar(page: Page, email: string) {
  await page.goto(`${BASE}/app/entrar`)
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
  // Admin com o termo pendente: aceita uma vez, como o dono faria.
  const termo = page.getByRole('checkbox', {
    name: 'Li e aceito o Termo do Administrador da Comunidade.',
  })
  if (await termo.isVisible().catch(() => false)) {
    await termo.click()
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click()
    await assentar(page)
  }
  // Aviso dos termos novos: "Entendi" uma vez, para o Início mostrar o resto.
  const entendi = page.getByRole('button', { name: 'Entendi' })
  if (await entendi.isVisible().catch(() => false)) {
    await entendi.click()
    await assentar(page)
  }
}

/** Rola a tela até o texto aparecer acima da barra de abas e tira a foto. */
async function fotoEm(page: Page, texto: RegExp, nome: string) {
  await page
    .getByText(texto)
    .first()
    .evaluate((el) => {
      let pai = el.parentElement
      while (
        pai &&
        !(pai.scrollHeight > pai.clientHeight + 4 && getComputedStyle(pai).overflowY !== 'visible')
      ) {
        pai = pai.parentElement
      }
      if (pai) pai.scrollTop += el.getBoundingClientRect().top - 140
    })
  await page.waitForTimeout(800)
  await foto(page, nome)
}

async function irPara(page: Page, caminho: string) {
  await page.goto(`${BASE}/app${caminho}`)
  await assentar(page)
}

async function main() {
  mkdirSync(SAIDA, { recursive: true })
  const navegador = await chromium.launch()

  const visitante = await novaPagina(navegador)
  await irPara(visitante, '/entrar')
  await foto(visitante, '01-entrar')
  await tentar('criar-conta', async () => {
    await irPara(visitante, '/criar-conta')
    await foto(visitante, '02-criar-conta')
  })

  const admin = await novaPagina(navegador)
  await entrar(admin, 'demo.admin@unijovem.invalid')
  await irPara(admin, '/')
  await foto(admin, '03-inicio')
  await irPara(admin, '/agenda')
  await foto(admin, '04-agenda')
  // A antiga aba Programas é a Agenda no modo Lista (D57).
  await irPara(admin, '/agenda?vista=lista')
  await foto(admin, '05-programas')

  let evento = ''
  await tentar('evento', async () => {
    await admin
      .getByRole('button', { name: /^Sábado Jovem, / })
      .first()
      .click()
    await assentar(admin)
    evento = /\/evento\/([^/?#]+)/.exec(new URL(admin.url()).pathname)?.[1] ?? ''
    await foto(admin, '06-evento')
  })
  await tentar('roteiro', async () => {
    await admin.getByRole('radio', { name: /^Roteiro/ }).click()
    await assentar(admin)
    await foto(admin, '07-roteiro')
  })
  await tentar('convocados', async () => {
    await admin.getByRole('radio', { name: /^Convocados/ }).click()
    await assentar(admin)
    await foto(admin, '08-convocados')
  })
  await tentar('convocar', async () => {
    await admin.getByRole('button', { name: 'Convocar pessoa' }).first().click()
    await assentar(admin)
    await foto(admin, '09-convocar')
  })
  if (evento) {
    await tentar('checkin', async () => {
      await irPara(admin, `/evento/${evento}/checkin`)
      await foto(admin, '10-checkin')
    })
    await tentar('ao-vivo', async () => {
      await irPara(admin, `/evento/${evento}/ao-vivo`)
      await foto(admin, '11-ao-vivo')
    })
  }
  await tentar('nova', async () => {
    await irPara(admin, '/evento/novo')
    await foto(admin, '12-nova-programacao')
  })
  for (const [caminho, nome] of [
    ['/comunidade', '14-equipe'],
    ['/convidar', '15-convidar'],
    ['/avisos', '16-avisos'],
    ['/oracao', '17-oracao'],
    ['/sugestoes', '18-sugestoes'],
    ['/relatorios', '19-relatorios'],
    ['/perfil', '20-perfil'],
    ['/procurar-comunidade', '21-procurar-comunidade'],
    ['/tenho-um-codigo', '22-tenho-um-codigo'],
  ] as const) {
    await tentar(nome, async () => {
      await irPara(admin, caminho)
      await foto(admin, nome)
    })
  }

  const membro = await novaPagina(navegador)
  await entrar(membro, 'demo.membro@unijovem.invalid')
  await irPara(membro, '/')
  await foto(membro, '23-inicio-membro')
  await tentar('convocacao-membro', () =>
    fotoEm(membro, /Você foi convocado/, '23b-voce-foi-convocado'),
  )
  await tentar('escalas', async () => {
    await irPara(membro, '/escalas')
    await foto(membro, '24-minhas-convocacoes')
  })
  await tentar('sino', async () => {
    await irPara(membro, '/caixa-de-notificacoes')
    await foto(membro, '25-sino')
  })

  await navegador.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
