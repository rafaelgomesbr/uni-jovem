/**
 * QA visual do app v3 (direção A, D65): capturas de todas as telas principais da prévia local, nos
 * temas escuro e claro e em 390x844 e 375x667, mais a auditoria automática de cada tela (rolagem
 * horizontal, alvos de toque menores que 44, texto cortado, erro de console, requisição falha).
 *
 *   npm run previa                      (outro terminal, até "Prévia pronta")
 *   node --import tsx scripts/apresentacao/capturas-v3.ts [variante] [pasta]
 *
 * `variante`: 390-escuro, 390-claro, 375-escuro, 375-claro ou `todas` (uma depois da outra).
 * Só localhost, só contas fictícias (senhas lidas de .previa/contas.txt, nunca impressas).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const RAIZ = join(import.meta.dirname, '..', '..')
const BASE = 'http://localhost:8090'
const COMUNIDADE = readFileSync(join(RAIZ, '.previa', 'contas.txt'), 'utf8').match(
  /Comunidade A: ([0-9a-f-]{36})/,
)![1]!

const VARIANTES = {
  '390-escuro': { largura: 390, altura: 844, tema: 'dark' },
  '390-claro': { largura: 390, altura: 844, tema: 'light' },
  '375-escuro': { largura: 375, altura: 667, tema: 'dark' },
  '375-claro': { largura: 375, altura: 667, tema: 'light' },
} as const
type IdDaVariante = keyof typeof VARIANTES

const ESCOLHA = process.argv[2] ?? 'todas'
const SAIDA = resolve(process.argv[3] ?? join(RAIZ, 'docs', 'qa', 'v3'))

interface Evento {
  id: string
  titulo: string
  inicio: string
  status: string
}

interface Achado {
  tela: string
  tipo: string
  detalhe: string
}

function senhaDe(email: string): string {
  const contas = readFileSync(join(RAIZ, '.previa', 'contas.txt'), 'utf8')
  const linha = contas.split(/\r?\n/).find((l) => l.includes(email) && l.includes('senha:'))
  if (!linha) throw new Error(`Conta ${email} não encontrada em .previa/contas.txt`)
  return linha.split('senha:')[1]!.trim()
}

async function assentar(page: Page, extra = 1300) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, {
      timeout: 8000,
    })
    .catch(() => undefined)
  await page.waitForTimeout(extra)
}

async function entrar(page: Page, email: string) {
  await page.goto(`${BASE}/app/entrar?modo=email`)
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senhaDe(email))
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/entrar'), { timeout: 20000 })
  await assentar(page)
  for (let i = 0; i < 3; i++) {
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
}

// O código que roda dentro da página vai como texto: o tsx injeta `__name` nas funções e o
// navegador não o conhece.
const CODIGO_DA_AUDITORIA = `(() => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const visivel = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' &&
      Number(cs.opacity) > 0.05 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
  }
  const rotulo = (el) =>
    (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') ||
      el.getAttribute('role') || el.tagName).split(String.fromCharCode(10)).join(' ').trim().slice(0, 60)
  const rolagemHorizontal = (el) => {
    let p = el.parentElement
    while (p) {
      const cs = getComputedStyle(p)
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) return true
      p = p.parentElement
    }
    return false
  }
  const alvosPequenos = []
  const seletor = 'button, a[href], [role=button], [role=link], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=menuitem], input, select, textarea'
  const vistos = new Set()
  for (const el of document.querySelectorAll(seletor)) {
    if (!visivel(el) || el.closest('[aria-hidden="true"]')) continue
    const r = el.getBoundingClientRect()
    // O link "Pular para o conteúdo" só aparece com foco do teclado; os 40 pt de altura dos
    // segmentos e das pílulas são o compacto do projeto (40 mais 4 de folga de toque).
    if (el.getAttribute('href') === '#main' || /^Pular para/.test(rotulo(el))) continue
    if (r.width < 39.5 || r.height < 39.5) {
      const chave = rotulo(el) + '|' + Math.round(r.width) + 'x' + Math.round(r.height)
      if (!vistos.has(chave)) { vistos.add(chave); alvosPequenos.push(rotulo(el) + ' (' + Math.round(r.width) + 'x' + Math.round(r.height) + ')') }
    }
  }
  const vazando = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right > vw + 1.5 && r.left < vw && visivel(el) && !rolagemHorizontal(el)) {
      // Só o que tem texto ou é controle: os brilhos decorativos da Aurora sangram de propósito.
      if (el.innerText && el.innerText.trim() && el.children.length < 3 && !el.closest('[aria-hidden="true"]'))
        vazando.push(el.tagName.toLowerCase() + ' "' + rotulo(el) + '" até ' + Math.round(r.right))
    }
  }
  const cortados = []
  for (const el of document.querySelectorAll('body *')) {
    if (!el.innerText || el.children.length > 0 || !visivel(el)) continue
    const cs = getComputedStyle(el)
    const corta = (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') ||
      (el.scrollHeight > el.clientHeight + 2 && cs.overflow !== 'visible')
    if (corta) cortados.push('"' + rotulo(el) + '" (' + el.scrollWidth + 'x' + el.scrollHeight + ' em ' + el.clientWidth + 'x' + el.clientHeight + ')')
  }
  const corpo = document.body.innerText || ''
  return {
    rolagemHorizontalDoDocumento: document.documentElement.scrollWidth > vw + 1,
    larguraDoDocumento: document.documentElement.scrollWidth,
    alvosPequenos: alvosPequenos.slice(0, 40),
    vazando: vazando.slice(0, 15),
    cortados: cortados.slice(0, 20),
    naoEncontrada: /não encontrad|página não existe|Unmatched Route/i.test(corpo),
    emBranco: corpo.trim().length < 5,
  }
})()`

interface ResultadoDaAuditoria {
  rolagemHorizontalDoDocumento: boolean
  larguraDoDocumento: number
  alvosPequenos: string[]
  vazando: string[]
  cortados: string[]
  naoEncontrada: boolean
  emBranco: boolean
}

async function auditar(page: Page): Promise<ResultadoDaAuditoria> {
  return (await page.evaluate(CODIGO_DA_AUDITORIA)) as ResultadoDaAuditoria
}

/** Rola o maior contêiner de rolagem vertical (o app rola dentro da Tela, não no body). */
async function rolar(page: Page, passo: number): Promise<{ moveu: boolean; restante: boolean }> {
  return (await page.evaluate(`(() => {
    let melhor = null
    let maior = 0
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight + 40 && el.clientHeight > 200 && el.scrollHeight > maior) {
        maior = el.scrollHeight
        melhor = el
      }
    }
    if (!melhor) return { moveu: false, restante: false }
    const antes = melhor.scrollTop
    melhor.scrollTop = antes + melhor.clientHeight * ${passo}
    return { moveu: melhor.scrollTop > antes + 2, restante: melhor.scrollTop + melhor.clientHeight < melhor.scrollHeight - 4 }
  })()`)) as { moveu: boolean; restante: boolean }
}

async function voltarAoTopo(page: Page) {
  await page.evaluate(`(() => {
    for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0
  })()`)
}

class Sessao {
  achados: Achado[] = []
  capturadas: { nome: string; arquivos: string[] }[] = []
  puladas: { nome: string; motivo: string }[] = []
  telaAtual = 'inicio'
  constructor(
    readonly id: IdDaVariante,
    readonly extras: boolean,
  ) {}

  vigiar(page: Page) {
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') {
        const t = m.text()
        if (m.type() === 'warning' && !/deprecat|accessib|aria|prop|Reanimated|reduced/i.test(t))
          return
        this.achados.push({
          tela: this.telaAtual,
          tipo: `console.${m.type()}`,
          detalhe: t.slice(0, 300),
        })
      }
    })
    page.on('pageerror', (e) =>
      this.achados.push({
        tela: this.telaAtual,
        tipo: 'excecao',
        detalhe: e.message.slice(0, 300),
      }),
    )
    page.on('requestfailed', (r) => {
      const f = r.failure()?.errorText ?? ''
      if (/ABORTED/.test(f)) return
      this.achados.push({
        tela: this.telaAtual,
        tipo: 'requisicao-falhou',
        detalhe: `${r.method()} ${r.url().replace(BASE, '')} ${f}`,
      })
    })
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().includes('/favicon')) {
        this.achados.push({
          tela: this.telaAtual,
          tipo: `http-${r.status()}`,
          detalhe: `${r.request().method()} ${r.url().replace(BASE, '')}`,
        })
      }
    })
  }

  async foto(page: Page, nome: string, opcoes: { auditar?: boolean; rolagem?: boolean } = {}) {
    this.telaAtual = nome
    const arquivos: string[] = []
    const base = `${nome}--${this.id}`
    await page.screenshot({ path: join(SAIDA, `${base}.jpg`), type: 'jpeg', quality: 72 })
    arquivos.push(`${base}.jpg`)
    if (opcoes.auditar !== false) {
      const a = await auditar(page)
      if (a.rolagemHorizontalDoDocumento)
        this.achados.push({
          tela: nome,
          tipo: 'rolagem-horizontal',
          detalhe: `documento com ${a.larguraDoDocumento}px`,
        })
      for (const v of a.vazando)
        this.achados.push({ tela: nome, tipo: 'vaza-na-horizontal', detalhe: v })
      for (const t of a.alvosPequenos)
        this.achados.push({ tela: nome, tipo: 'alvo-menor-que-44', detalhe: t })
      for (const c of a.cortados)
        this.achados.push({ tela: nome, tipo: 'texto-cortado', detalhe: c })
      if (a.naoEncontrada)
        this.achados.push({ tela: nome, tipo: 'rota-nao-encontrada', detalhe: page.url() })
      if (a.emBranco) this.achados.push({ tela: nome, tipo: 'tela-em-branco', detalhe: page.url() })
    }
    if (this.extras && opcoes.rolagem !== false) {
      for (let i = 2; i <= 4; i++) {
        const { moveu, restante } = await rolar(page, 0.85)
        // Tela sem rolagem (ou já no fim): não repete a mesma foto.
        if (!moveu) break
        await page.waitForTimeout(500)
        const arq = `${base}-p${i}.jpg`
        await page.screenshot({ path: join(SAIDA, arq), type: 'jpeg', quality: 72 })
        arquivos.push(arq)
        if (!restante) break
      }
      await voltarAoTopo(page)
    }
    this.capturadas.push({ nome, arquivos })
    console.log(`[${this.id}] ok ${nome} (${arquivos.length})`)
  }

  async tentar(nome: string, passo: () => Promise<void>) {
    this.telaAtual = nome
    try {
      await passo()
    } catch (e) {
      const motivo = (e as Error).message.split('\n')[0]!
      this.puladas.push({ nome, motivo })
      console.log(`[${this.id}] PULOU ${nome}: ${motivo}`)
    }
  }
}

async function irPara(page: Page, caminho: string) {
  await page.goto(`${BASE}/app${caminho}`)
  await assentar(page)
}

async function novoContexto(
  navegador: Browser,
  v: (typeof VARIANTES)[IdDaVariante],
  estado?: string,
): Promise<BrowserContext> {
  const contexto = await navegador.newContext({
    viewport: { width: v.largura, height: v.altura },
    deviceScaleFactor: 1.5,
    colorScheme: v.tema,
    reducedMotion: 'no-preference',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    ...(estado ? { storageState: estado } : {}),
  })
  contexto.setDefaultTimeout(5000)
  return contexto
}

interface MomentoSimulado {
  evento?: { inicio: string } | null
  estado?: string
  minutosParaInicio?: number
  agora?: string
}

const CIFRA_DE_EXEMPLO = [
  '[Verso 1]',
  '[G]Chegamos juntos [D]nesta manhã',
  '[Em]trazendo o que [C]temos nas mãos',
  '[G]Cada voz se [D]une ao louvor',
  '[C]e o céu se enche de [G]cor',
  '',
  '[Refrão]',
  '[C]Sobe o sol, sobe a [G]canção',
  '[D]Toda a terra em [Em]adoração',
  '[C]Sobe o sol, sobe a [G]canção',
  '[D]Somos um só [G]coração',
  '',
  '[Verso 2]',
  '[G]Quem estava [D]longe voltou',
  '[Em]quem estava só se [C]abraçou',
  '[G]Nada nos [D]separa mais',
  '[C]o amor nos traz a [G]paz',
  '',
  '[Ponte]',
  '[Em]Tudo o que somos, [C]tudo o que há',
  '[G]entregamos no [D]altar',
]

type EstadoDoCartao = 'longe' | 'vespera' | 'no_dia' | 'acontecendo' | 'terminou'

/** O servidor decide o momento pelo relógio real; aqui o cartão é forçado para ver cada estado. */
async function forcarMomento(page: Page, estado: EstadoDoCartao | null) {
  await page.unroute('**/api/v1/c/*/inicio').catch(() => undefined)
  if (!estado || estado === 'longe') return
  await page.route('**/api/v1/c/*/inicio', async (route) => {
    const resposta = await route.fetch()
    const json = (await resposta.json()) as { momento?: MomentoSimulado }
    const m = json.momento
    if (m?.evento) {
      const minutos = { vespera: 20 * 60, no_dia: 180, acontecendo: -30, terminou: -150 }[estado]
      m.estado = estado
      m.minutosParaInicio = minutos
      m.agora = new Date(new Date(m.evento.inicio).getTime() - minutos * 60_000).toISOString()
    }
    await route.fulfill({ response: resposta, json })
  })
}

async function rodarVariante(navegador: Browser, id: IdDaVariante) {
  const v = VARIANTES[id]
  const s = new Sessao(id, id === '390-escuro' || id === '375-claro')
  mkdirSync(SAIDA, { recursive: true })
  const pastaEstado = join(RAIZ, '.previa')
  const estadoAdmin = join(pastaEstado, `qa-admin-${id}.json`)
  const estadoMembro = join(pastaEstado, `qa-membro-${id}.json`)

  // ---------------------------------------------------------------- visitante
  {
    const ctx = await novoContexto(navegador, v)
    const p = await ctx.newPage()
    s.vigiar(p)
    await s.tentar('login', async () => {
      await irPara(p, '/entrar')
      await s.foto(p, '01-login')
    })
    await s.tentar('login-email', async () => {
      await irPara(p, '/entrar?modo=email')
      await s.foto(p, '02-login-com-email', { rolagem: false })
    })
    await s.tentar('criar-conta', async () => {
      await irPara(p, '/criar-conta')
      await s.foto(p, '03-criar-conta')
    })
    await s.tentar('tenho-um-codigo-publico', async () => {
      await irPara(p, '/entrar/ABCD-EFGH')
      await s.foto(p, '04-link-do-codigo-invalido')
    })
    await ctx.close()
  }

  // ---------------------------------------------------------------- admin
  const ctxA = await novoContexto(navegador, v)
  const admin = await ctxA.newPage()
  s.vigiar(admin)
  await entrar(admin, 'demo.admin@unijovem.invalid')
  await ctxA.storageState({ path: estadoAdmin })

  // ---------------------------------------------------------------- membro
  const ctxM = await novoContexto(navegador, v)
  const membro = await ctxM.newPage()
  s.vigiar(membro)
  await entrar(membro, 'demo.membro@unijovem.invalid')
  await ctxM.storageState({ path: estadoMembro })

  // Descobre os encontros pela API (o acesso vai em memória no app: pega do cabeçalho dele).
  const pedido = admin.waitForRequest(
    (r) => r.url().includes('/api/v1/c/') && Boolean(r.headers()['authorization']),
  )
  await irPara(admin, '/agenda')
  const autorizacao = (await pedido).headers()['authorization']!
  const lista = (await (
    await admin.request.get(`${BASE}/api/v1/c/${COMUNIDADE}/eventos`, {
      headers: { authorization: autorizacao },
    })
  ).json()) as { eventos?: Evento[] }
  const eventos: Evento[] = lista.eventos ?? []
  const agora = Date.now()
  const futuros = eventos
    .filter((e) => new Date(e.inicio).getTime() > agora && e.status !== 'cancelado')
    .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())
  const proximo = futuros.find((e) => e.status === 'publicado') ?? futuros[0]
  const passado = eventos
    .filter((e) => new Date(e.inicio).getTime() < agora)
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())[0]
  const eventoId = proximo?.id ?? passado?.id
  if (!eventoId) throw new Error('A prévia não tem nenhum encontro: rode a semente.')
  console.log(`[${id}] eventos=${eventos.length} proximo=${proximo?.titulo} ${proximo?.inicio}`)

  // ---------------------------------------------------------------- dados de música (prévia)
  // A semente não traz repertório. Sem ele, Meu repertório, o leitor de cifra e o Modo palco
  // ficariam sem prova: monta três músicas no próximo encontro e a Carla aceita o Louvor.
  await s.tentar('preparar-repertorio', async () => {
    const api = (caminho: string) => `${BASE}/api/v1/c/${COMUNIDADE}${caminho}`
    const cab = { authorization: autorizacao }
    const atual = (await (
      await admin.request.get(api(`/eventos/${eventoId}/repertorio`), { headers: cab })
    ).json()) as { itens?: unknown[] }
    const musicas = (await (
      await admin.request.get(api('/conteudos/musicas'), { headers: cab })
    ).json()) as { itens?: { id: string }[]; musicas?: { id: string }[] }
    const ids = (musicas.itens ?? musicas.musicas ?? []).slice(0, 3).map((m) => m.id)
    if ((atual.itens ?? []).length === 0) {
      for (const musicaId of ids) {
        await admin.request.post(api(`/eventos/${eventoId}/repertorio`), {
          headers: cab,
          data: { musicaId },
        })
      }
    }
    // Letra e cifra inventadas (direitos confirmados): o leitor e o palco precisam de texto.
    const CIFRA = CIFRA_DE_EXEMPLO.join(String.fromCharCode(10))
    for (const musicaId of ids.slice(0, 2)) {
      const d = (await (
        await admin.request.get(api(`/conteudos/musicas/${musicaId}`), { headers: cab })
      ).json()) as { versao?: number; item?: { versao: number } }
      const versao = d.versao ?? d.item?.versao ?? 1
      await admin.request.patch(api(`/conteudos/musicas/${musicaId}`), {
        headers: cab,
        data: { versao, cifra: CIFRA, direitosConfirmados: true },
      })
    }
    const pedidoM = membro.waitForRequest(
      (r) => r.url().includes('/api/v1/c/') && Boolean(r.headers()['authorization']),
    )
    await irPara(membro, '/agenda')
    const cabM = { authorization: (await pedidoM).headers()['authorization']! }
    const escalas = (await (
      await membro.request.get(api('/minhas-escalas'), { headers: cabM })
    ).json()) as {
      escalas?: {
        id: string
        funcao: string
        estado: string
        eventoId: string
        etapaTitulo: string | null
      }[]
    }
    const doLouvor = (escalas.escalas ?? []).find(
      (e) =>
        e.eventoId === eventoId &&
        e.estado === 'pendente' &&
        /louvor|vocal/i.test(`${e.funcao} ${e.etapaTitulo ?? ''}`),
    )
    if (doLouvor)
      await membro.request.post(api(`/atribuicoes/${doLouvor.id}/confirmar`), { headers: cabM })
  })

  // ---------------------------------------------------------------- Início
  for (const [papel, pagina] of [
    ['membro', membro],
    ['lider', admin],
  ] as const) {
    for (const estado of ['longe', 'vespera', 'no_dia', 'acontecendo', 'terminou'] as const) {
      await s.tentar(`inicio-${papel}-${estado}`, async () => {
        await forcarMomento(pagina, estado)
        await irPara(pagina, '/')
        await s.foto(pagina, `10-inicio-${papel}-${estado}`, { rolagem: estado === 'longe' })
      })
    }
    await forcarMomento(pagina, null)
  }

  await s.tentar('sino', async () => {
    await irPara(membro, '/caixa-de-notificacoes')
    await s.foto(membro, '11-sino')
  })
  await s.tentar('sino-lider', async () => {
    await irPara(admin, '/caixa-de-notificacoes')
    await s.foto(admin, '11b-sino-lider', { rolagem: false })
  })

  // ---------------------------------------------------------------- Agenda
  await s.tentar('agenda-lista', async () => {
    await irPara(membro, '/agenda')
    await s.foto(membro, '20-agenda-membro')
  })
  await s.tentar('agenda-lider', async () => {
    await irPara(admin, '/agenda')
    await s.foto(admin, '21-agenda-lider')
  })
  await s.tentar('agenda-so-o-meu', async () => {
    await irPara(membro, '/agenda?vista=lista&filtro=meu')
    await s.foto(membro, '22-agenda-so-o-que-e-meu')
  })
  await s.tentar('agenda-so-o-meu-clique', async () => {
    await irPara(membro, '/agenda')
    await membro.getByRole('radio', { name: /Só o que é meu/ }).click()
    await assentar(membro, 700)
    await s.foto(membro, '22b-agenda-filtro-clicado', { rolagem: false })
  })
  await s.tentar('agenda-calendario', async () => {
    await irPara(membro, '/agenda')
    await membro
      .getByRole('button', { name: /Calend[aá]rio/ })
      .first()
      .click()
    await assentar(membro, 900)
    await s.foto(membro, '23-agenda-calendario-em-folha', { rolagem: false })
  })
  await s.tentar('agenda-calendario-lider', async () => {
    await irPara(admin, '/agenda')
    await admin
      .getByRole('button', { name: /Calend[aá]rio/ })
      .first()
      .click()
    await assentar(admin, 900)
    await s.foto(admin, '23b-agenda-calendario-lider', { rolagem: false })
  })
  await s.tentar('agenda-novo-encontro', async () => {
    await irPara(admin, '/agenda')
    await admin
      .getByRole('button', { name: /Novo encontro/ })
      .first()
      .click()
    await assentar(admin, 900)
    await s.foto(admin, '25-agenda-novo-encontro', { rolagem: false })
  })

  // ---------------------------------------------------------------- Encontro
  await s.tentar('encontro-membro', async () => {
    await irPara(membro, `/evento/${eventoId}`)
    await s.foto(membro, '30-encontro-membro')
  })
  await s.tentar('encontro-org-resumo', async () => {
    await irPara(admin, `/evento/${eventoId}`)
    await s.foto(admin, '31-encontro-organizacao-resumo')
  })
  await s.tentar('encontro-org-roteiro', async () => {
    await admin.getByRole('radio', { name: /^Roteiro/ }).click()
    await assentar(admin, 700)
    await s.foto(admin, '32-encontro-organizacao-roteiro')
  })
  await s.tentar('encontro-org-convocados', async () => {
    await admin.getByRole('radio', { name: /^Quem vai/ }).click()
    await assentar(admin, 700)
    await s.foto(admin, '33-encontro-organizacao-convocados')
  })
  await s.tentar('convocar', async () => {
    await admin
      .getByRole('button', { name: /^Convocar/ })
      .first()
      .click()
    await assentar(admin, 1000)
    await s.foto(admin, '34-convocar-em-lote', { rolagem: false })
  })
  await s.tentar('igual-ao-ultimo', async () => {
    await irPara(admin, '/evento/igual-ao-ultimo')
    await s.foto(admin, '35-igual-ao-ultimo-sabado')
  })
  await s.tentar('novo-encontro', async () => {
    await irPara(admin, '/evento/novo')
    await s.foto(admin, '36-novo-encontro')
  })
  await s.tentar('editar-encontro', async () => {
    await irPara(admin, `/evento/${eventoId}/editar`)
    await s.foto(admin, '37-editar-encontro')
  })

  // ---------------------------------------------------------------- Comunidade
  await s.tentar('comunidade-membro', async () => {
    await irPara(membro, '/comunidade')
    await s.foto(membro, '40-comunidade-membro')
  })
  await s.tentar('comunidade-lider', async () => {
    await irPara(admin, '/comunidade')
    await s.foto(admin, '41-comunidade-lider')
  })
  await s.tentar('comunidade-lider-organizacao', async () => {
    await admin
      .getByRole('button', { name: /Organiza[cç][aã]o/ })
      .first()
      .click()
    await assentar(admin, 700)
    await s.foto(admin, '42-comunidade-lider-organizacao-aberta')
  })
  await s.tentar('pessoas', async () => {
    await irPara(admin, '/pessoas')
    await s.foto(admin, '43-pessoas')
  })

  // ---------------------------------------------------------------- Perfil
  await s.tentar('perfil-membro', async () => {
    await irPara(membro, '/perfil')
    await s.foto(membro, '50-perfil-membro')
  })
  await s.tentar('perfil-lider', async () => {
    await irPara(admin, '/perfil')
    await s.foto(admin, '51-perfil-lider')
  })
  await s.tentar('perfil-mais-opcoes', async () => {
    await membro
      .getByRole('button', { name: /Mais op[cç][oõ]es/ })
      .first()
      .click()
    await assentar(membro, 700)
    await s.foto(membro, '52-perfil-mais-opcoes')
  })

  // ---------------------------------------------------------------- avisos e oração
  await s.tentar('avisos', async () => {
    await irPara(admin, '/avisos')
    await s.foto(admin, '60-avisos')
  })
  await s.tentar('aviso-novo', async () => {
    await irPara(admin, '/avisos/novo')
    await s.foto(admin, '61-aviso-novo')
  })
  await s.tentar('oracao', async () => {
    await irPara(membro, '/oracao')
    await s.foto(membro, '62-oracao-lista')
  })
  await s.tentar('oracao-novo', async () => {
    await irPara(membro, '/oracao/novo')
    await s.foto(membro, '63-pedir-oracao')
  })

  // ---------------------------------------------------------------- dia do encontro
  await s.tentar('checkin', async () => {
    await irPara(admin, `/evento/${eventoId}/checkin`)
    await s.foto(admin, '70-checkin')
  })
  await s.tentar('ao-vivo-lider', async () => {
    await irPara(admin, `/evento/${eventoId}/ao-vivo`)
    await s.foto(admin, '71-ao-vivo-lider')
  })
  await s.tentar('ao-vivo-membro', async () => {
    await irPara(membro, `/evento/${eventoId}/ao-vivo`)
    await s.foto(membro, '72-ao-vivo-membro')
  })

  // ---------------------------------------------------------------- música
  await s.tentar('meu-repertorio', async () => {
    await irPara(membro, '/meu-repertorio')
    await s.foto(membro, '80-meu-repertorio')
  })
  await s.tentar('meu-repertorio-lider', async () => {
    await irPara(admin, '/meu-repertorio')
    await s.foto(admin, '80b-meu-repertorio-lider')
  })
  await s.tentar('repertorio-do-encontro', async () => {
    await irPara(admin, `/evento/${eventoId}/repertorio`)
    await s.foto(admin, '81-repertorio-do-encontro')
  })
  await s.tentar('leitor-de-cifra', async () => {
    await irPara(membro, '/meu-repertorio')
    const musica = membro.getByRole('button', { name: /^Música 1 de/ }).first()
    await musica.waitFor({ timeout: 4000 })
    await musica.click()
    await assentar(membro, 1000)
    await s.foto(membro, '82-leitor-de-cifra')
    await s.tentar('modo-palco', async () => {
      await membro
        .getByRole('button', { name: /Modo palco/ })
        .first()
        .click()
      await assentar(membro, 1000)
      await s.foto(membro, '83-modo-palco', { rolagem: false })
    })
  })
  await s.tentar('louvor', async () => {
    await irPara(admin, '/louvor')
    await s.foto(admin, '84-louvor')
  })
  await s.tentar('biblioteca', async () => {
    await irPara(admin, '/conteudos')
    await s.foto(admin, '85-biblioteca')
  })
  await s.tentar('biblioteca-membro', async () => {
    await irPara(membro, '/conteudos')
    await s.foto(membro, '85b-biblioteca-membro', { rolagem: false })
  })

  // ---------------------------------------------------------------- entrada e primeira experiência
  await s.tentar('comece-por-aqui', async () => {
    await irPara(membro, '/comece-por-aqui')
    await s.foto(membro, '90-comece-por-aqui')
  })
  await s.tentar('tenho-um-codigo', async () => {
    await irPara(membro, '/tenho-um-codigo')
    await s.foto(membro, '91-tenho-um-codigo')
  })
  await s.tentar('boas-vindas', async () => {
    await irPara(membro, '/boas-vindas')
    await s.foto(membro, '92-boas-vindas')
  })
  await s.tentar('procurar-comunidade', async () => {
    await irPara(membro, '/procurar-comunidade')
    await s.foto(membro, '93-procurar-comunidade', { rolagem: false })
  })

  // ---------------------------------------------------------------- rotas antigas
  await s.tentar('redirect-escalas', async () => {
    await irPara(membro, '/escalas')
    await s.foto(membro, '95-redirecionou-escalas', { rolagem: false })
    s.achados.push({ tela: '95-redirecionou-escalas', tipo: 'info-url', detalhe: membro.url() })
  })
  await s.tentar('redirect-programacoes', async () => {
    await irPara(membro, '/programacoes')
    await s.foto(membro, '96-redirecionou-programacoes', { rolagem: false })
    s.achados.push({
      tela: '96-redirecionou-programacoes',
      tipo: 'info-url',
      detalhe: membro.url(),
    })
  })
  await s.tentar('rota-inexistente', async () => {
    await irPara(membro, '/nao-existe-esta-tela')
    await s.foto(membro, '97-rota-inexistente', { rolagem: false })
  })

  await ctxA.close()
  await ctxM.close()
  writeFileSync(
    join(SAIDA, `relatorio-${id}.json`),
    JSON.stringify(
      { variante: id, capturadas: s.capturadas, puladas: s.puladas, achados: s.achados },
      null,
      2,
    ),
  )
  console.log(
    `[${id}] fim: ${s.capturadas.length} telas, ${s.puladas.length} puladas, ${s.achados.length} achados`,
  )
}

async function main() {
  if (!existsSync(join(RAIZ, '.previa', 'contas.txt'))) throw new Error('Suba a prévia antes.')
  const ids = (ESCOLHA === 'todas' ? Object.keys(VARIANTES) : [ESCOLHA]) as IdDaVariante[]
  const navegador = await chromium.launch()
  try {
    for (const id of ids) await rodarVariante(navegador, id)
  } finally {
    await navegador.close()
  }
}

await main()
