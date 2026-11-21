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
 *
 * O ao vivo e a presença precisam de um evento de hoje: o roteiro duplica o
 * Sábado Jovem do próximo sábado para hoje, publica, inicia o ao vivo pela
 * interface, avança até o Louvor (com uns 3 min de atraso) e marca três
 * presenças. Isso escreve no banco, por isso só roda na prévia local; no fim,
 * o ao vivo e a cópia são encerrados, para a próxima rodada começar limpa.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dataNoFuso } from '@uj/dominio'
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright'
import { proximoSabado } from '../../apps/api/src/cli/demonstracao-plano.ts'

const RAIZ = join(import.meta.dirname, '..', '..')
const BASE = process.env['UJ_CAPTURAS_URL'] ?? 'http://localhost:8090'
const SAIDA = join(RAIZ, 'docs', 'lojas', 'capturas', 'cru')
const FUSO = 'America/Sao_Paulo'
/** Só a prévia local aceita a preparação do ao vivo (ela cria e publica um evento). */
const PREVIA_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)

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

async function irPara(page: Page, caminho: string) {
  await page.goto(`${BASE}/app${caminho}`)
  await assentar(page)
}

/** O id do evento na rota `/app/evento/<id>`. */
function idDoEvento(page: Page): string {
  const id = /\/evento\/([^/?#]+)/.exec(new URL(page.url()).pathname)?.[1]
  if (!id) throw new Error(`fora do detalhe do evento: ${page.url()}`)
  return id
}

/** Rola o conteúdo da tela até o fim (o ScrollView da web é um div com overflow). */
async function rolarAteOFim(page: Page) {
  await page.evaluate(() => {
    const rolaveis = [...document.querySelectorAll('div')].filter(
      (d) => d.scrollHeight > d.clientHeight + 4 && getComputedStyle(d).overflowY !== 'visible',
    )
    const tela = rolaveis.sort((a, b) => b.clientHeight - a.clientHeight)[0]
    if (tela) tela.scrollTop = tela.scrollHeight
  })
  await page.waitForTimeout(800)
}

/**
 * Rola o mínimo para o alvo terminar acima da barra de abas flutuante (66 de
 * altura a 12 do fim, mais um respiro). Em tela alta, não rola nada.
 */
async function mostrarAcimaDaBarraDeAbas(page: Page, alvo: Locator) {
  await alvo.evaluate((el) => {
    const folga = 96
    let pai = el.parentElement
    while (
      pai &&
      !(pai.scrollHeight > pai.clientHeight + 4 && getComputedStyle(pai).overflowY !== 'visible')
    ) {
      pai = pai.parentElement
    }
    const falta = el.getBoundingClientRect().bottom - (window.innerHeight - folga)
    if (pai && falta > 0) pai.scrollTop += falta
  })
  await page.waitForTimeout(800)
}

/** "sábado, 21 de novembro": o começo do nome do dia na grade da Agenda (`rotuloDoDia`). */
function nomeDoSabado(sabado: string): RegExp {
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(`${sabado}T12:00:00Z`),
  )
  return new RegExp(`^sábado, ${Number(sabado.slice(8, 10))} de ${mes}`)
}

/** Agenda no próximo sábado com eventos: a lista do dia aparece abaixo do mês. */
async function agendaNoSabado(page: Page, sabado: string) {
  await irPara(page, '/agenda')
  await page
    .getByRole('button', { name: nomeDoSabado(sabado) })
    .first()
    .click()
  await assentar(page)
}

/** O Sábado Jovem do próximo sábado, aberto pela lista do dia na Agenda (nunca uma cópia de hoje). */
async function abrirSabadoJovem(page: Page, sabado: string): Promise<string> {
  await agendaNoSabado(page, sabado)
  await page
    .getByRole('button', { name: /^Sábado Jovem, / })
    .first()
    .click()
  await page.waitForURL(/\/evento\/[^/]+$/, { timeout: 15000 })
  await assentar(page)
  return idDoEvento(page)
}

/** HH:MM no fuso da comunidade. */
function horaNoFuso(instante: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instante)
}

async function confirmarNoDialogo(page: Page, botao: string) {
  await page.getByRole('alertdialog').getByRole('button', { name: botao, exact: true }).click()
  await assentar(page)
}

/**
 * O dia do evento, só na prévia: cópia de hoje do Sábado Jovem, publicada,
 * com o ao vivo no Louvor e três presenças. O início fica 8 min antes de
 * agora: as Boas-vindas (5 min) já deveriam ter acabado e o Louvor começa
 * com uns 3 min de atraso, como no roteiro (docs/lojas/capturas.md, 4.3).
 */
async function prepararODiaDoEvento(page: Page, origem: string): Promise<string> {
  const agora = Date.now()
  await irPara(page, `/evento/${origem}/duplicar`)
  await page.getByLabel('Data', { exact: true }).fill(dataNoFuso(new Date(agora), FUSO))
  // Arredonda para o minuto mais próximo, contando os ~15 s até o Louvor começar.
  const inicio = new Date(Math.round((agora + 15_000 - 8 * 60_000) / 60_000) * 60_000)
  await page.getByLabel('Hora', { exact: true }).fill(horaNoFuso(inicio))
  await page.getByRole('button', { name: 'Criar a cópia', exact: true }).click()
  await page.waitForURL((u) => /\/evento\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith(origem))
  await assentar(page)
  const copia = idDoEvento(page)

  await page.getByRole('button', { name: 'Publicar', exact: true }).first().click()
  await confirmarNoDialogo(page, 'Publicar')
  await page.getByRole('button', { name: 'Abrir ao vivo', exact: true }).waitFor()

  await irPara(page, `/evento/${copia}/ao-vivo`)
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await assentar(page)
  await page.getByRole('button', { name: 'Avançar etapa', exact: true }).click()
  await assentar(page)

  await irPara(page, `/evento/${copia}/checkin`)
  for (const nome of ['Beatriz Moraes', 'Camila Nunes', 'Davi Monteiro']) {
    await page
      .getByRole('button', { name: `Chegou: ${nome}. Marcar presença`, exact: true })
      .click()
    await page.waitForTimeout(900)
  }
  return copia
}

/** Encerra o ao vivo e a cópia: na próxima rodada, o Início não mostra um evento de hoje. */
async function encerrarODiaDoEvento(page: Page, copia: string) {
  await irPara(page, `/evento/${copia}/ao-vivo`)
  await page.getByRole('button', { name: 'Mais ações', exact: true }).click()
  await page.getByRole('button', { name: /^Encerrar o ao vivo/ }).click()
  await confirmarNoDialogo(page, 'Encerrar')
  await irPara(page, `/evento/${copia}`)
  await page.getByRole('button', { name: 'Mais ações', exact: true }).last().click()
  // O item da folha é lido como "Encerrar. O encontro já aconteceu".
  await page.getByRole('button', { name: /^Encerrar\. / }).click()
  await confirmarNoDialogo(page, 'Encerrar encontro')
}

/**
 * Nome da comunidade nas capturas (docs/lojas/capturas.md, seção 4.1). Troca
 * pela tela de Configurações, só no banco local da prévia.
 */
async function renomearComunidade(page: Page, nome: string) {
  await irPara(page, '/configurar-comunidade')
  const campo = page.getByLabel('Nome da comunidade', { exact: true })
  if ((await campo.inputValue()) === nome) return
  await campo.fill(nome)
  await page.getByRole('button', { name: /^Salvar/ }).click()
  await assentar(page)
}

interface Contexto {
  /** O próximo sábado (AAAA-MM-DD), o da agenda da semente. */
  sabado: string
  /** A cópia de hoje do Sábado Jovem, com o ao vivo e a presença (só na prévia local). */
  copia: string | null
}

interface Tela {
  arquivo: string
  /** Abre a tela a partir de uma sessão já autenticada. */
  abrir: (page: Page, c: Contexto) => Promise<void>
}

/**
 * A ordem da seção 2 de docs/lojas/capturas.md: as oito primeiras vão para as
 * duas lojas (o Google aceita até 8); a 9 e a 10, só para a Apple.
 */
export const TELAS: Tela[] = [
  { arquivo: '01-inicio', abrir: (p) => irPara(p, '/') },
  {
    arquivo: '02-programacao',
    abrir: async (p, c) => {
      await abrirSabadoJovem(p, c.sabado)
      await p.getByRole('radio', { name: 'Roteiro', exact: true }).click()
      await assentar(p)
    },
  },
  {
    arquivo: '03-ao-vivo',
    abrir: async (p, c) => {
      if (!c.copia)
        throw new Error('sem a cópia de hoje (o ao vivo só é preparado na prévia local)')
      await irPara(p, `/evento/${c.copia}/ao-vivo`)
    },
  },
  { arquivo: '04-escalas', abrir: (p) => irPara(p, '/escalas') },
  {
    arquivo: '05-presenca',
    abrir: async (p, c) => {
      if (!c.copia)
        throw new Error('sem a cópia de hoje (a presença só é preparada na prévia local)')
      await irPara(p, `/evento/${c.copia}/checkin`)
    },
  },
  {
    arquivo: '06-novo-pedido',
    abrir: async (p) => {
      await irPara(p, '/oracao/novo')
      // O que importa é o "Quem vai ver" com a explicação por extenso, logo acima da barra.
      await rolarAteOFim(p)
    },
  },
  {
    arquivo: '07-agenda',
    abrir: async (p, c) => {
      await agendaNoSabado(p, c.sabado)
      // Em 360 × 640 a lista do dia fica abaixo do mês: sobe só o que falta.
      const fimDaLista = p.getByRole('button', { name: /^Ver a linha do tempo de / }).first()
      await mostrarAcimaDaBarraDeAbas(p, fimDaLista)
    },
  },
  { arquivo: '08-equipe', abrir: (p) => irPara(p, '/comunidade') },
  { arquivo: '09-avisos', abrir: (p) => irPara(p, '/avisos') },
  { arquivo: '10-convidar', abrir: (p) => irPara(p, '/convidar') },
]

/** Telas que não dependem do evento de hoje: capturadas antes de ele existir. */
const ANTES_DO_DIA = new Set(['01-inicio', '02-programacao'])

interface Sessao {
  nome: string
  pasta: string
  contexto: BrowserContext
  page: Page
  erros: string[]
}

async function capturar(s: Sessao, telas: readonly Tela[], c: Contexto) {
  for (const tela of telas) {
    try {
      await tela.abrir(s.page, c)
      if (s.erros.length > 0) {
        throw new Error(`erro na página: ${s.erros.splice(0).join(' | ')}`)
      }
      await s.page.screenshot({ path: join(s.pasta, `${tela.arquivo}.png`) })
      console.log(`${s.nome}/${tela.arquivo}.png`)
    } catch (e) {
      console.error(`${s.nome}/${tela.arquivo}: ${(e as Error).message.split('\n')[0]}`)
    }
  }
}

async function principal() {
  const email = process.env['UJ_CAPTURAS_EMAIL'] ?? 'demo.admin@unijovem.invalid'
  const comunidade = process.env['UJ_CAPTURAS_COMUNIDADE'] ?? 'Jovens Esperança'
  const c: Contexto = { sabado: proximoSabado(dataNoFuso(new Date(), FUSO)), copia: null }
  const navegador = await chromium.launch()
  const sessoes: Sessao[] = []
  try {
    for (const aparelho of APARELHOS) {
      const pasta = join(SAIDA, aparelho.nome)
      mkdirSync(pasta, { recursive: true })
      // Captura de uma lista antiga (o Perfil, a lista de oração) não pode ir para a loja por engano.
      for (const arquivo of readdirSync(pasta)) {
        if (arquivo.endsWith('.png') && !TELAS.some((t) => `${t.arquivo}.png` === arquivo)) {
          rmSync(join(pasta, arquivo))
        }
      }
      const contexto = await navegador.newContext({
        viewport: { width: aparelho.largura, height: aparelho.altura },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        locale: 'pt-BR',
        timezoneId: FUSO,
      })
      const page = await contexto.newPage()
      // Erro de execução na web derruba a captura: tela em branco não vai para loja.
      const erros: string[] = []
      page.on('pageerror', (e) => erros.push(e.message))
      await entrar(page, email)
      sessoes.push({ nome: aparelho.nome, pasta, contexto, page, erros })
    }
    await renomearComunidade(sessoes[0]!.page, comunidade)

    for (const s of sessoes)
      await capturar(
        s,
        TELAS.filter((t) => ANTES_DO_DIA.has(t.arquivo)),
        c,
      )

    if (PREVIA_LOCAL) {
      const origem = await abrirSabadoJovem(sessoes[0]!.page, c.sabado)
      c.copia = await prepararODiaDoEvento(sessoes[0]!.page, origem)
    } else {
      console.error(`Ao vivo e presença ficam de fora: ${BASE} não é a prévia local.`)
    }

    for (const s of sessoes)
      await capturar(
        s,
        TELAS.filter((t) => !ANTES_DO_DIA.has(t.arquivo)),
        c,
      )

    if (c.copia) {
      await encerrarODiaDoEvento(sessoes[0]!.page, c.copia).catch((e: Error) =>
        console.error(`A cópia de hoje ficou aberta: ${e.message.split('\n')[0]}`),
      )
    }
  } finally {
    for (const s of sessoes) await s.contexto.close()
    await navegador.close()
  }
}

// Só como programa: o molduras.ts importa os APARELHOS daqui sem disparar as capturas.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await principal()
}
