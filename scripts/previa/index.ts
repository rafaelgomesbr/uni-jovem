import type { ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { codigoTotp, contadorAtual } from '../../apps/api/src/autenticacao/totp.ts'
import { garantirAmbiente, type AmbienteDaPrevia } from './ambiente.ts'
import {
  avisar,
  CAMINHOS,
  ENDERECO_DA_API,
  ErroDaPrevia,
  esperar,
  esperarSaida,
  finalDoLog,
  iniciarComLog,
  PORTA_DA_API,
  PORTA_DA_WEB,
  portaLivre,
  RAIZ,
  rodarTs,
  terminou,
} from './apoio.ts'
import { binariosDoPostgres, pararSobra, subirBanco, type BancoDaPrevia } from './banco.ts'
import { iniciarServidor, type ServidorDaPrevia } from './servidor.ts'

/**
 * Prévia local completa do Uni Jovem: Postgres embutido, API e web exportada,
 * servidos juntos em http://localhost:8090 como na homologação, com dados
 * fictícios. Uso e opções em scripts/previa/LEIA-ME.md.
 */

const AJUDA = `Prévia local do Uni Jovem

Uso: npm run previa [-- opções]

  --sem-exportar     reaproveita a última exportação da web (.previa/web)
  --recriar          apaga banco, contas e segredos da prévia e começa do zero
  --codigo-criador   mostra o código de 6 dígitos do Criador e sai
  --parar            para um Postgres da prévia que tenha sobrado e sai
  --ajuda            mostra esta ajuda`

const CRIADOR = { nome: 'Criador Demonstração', email: 'demo.criador@unijovem.invalid' }
const MARCA_DA_SEMENTE = '== Semente (apps/api/src/cli/semear.ts) =='
const MARCA_DO_CRIADOR = '== Criador (dono da plataforma) =='

interface DadosDoCriador {
  nome: string
  email: string
  senha: string
  segredoTotp: string
  uri: string
  codigosDeRecuperacao: string[]
}

interface Peca {
  parar(): Promise<void>
}
interface PecaQuePodeCair extends Peca {
  /** Chamado se o processo terminar sem a prévia ter pedido. */
  aoCair(acao: () => void): void
}
interface Exportacao extends Peca {
  concluida: Promise<void>
}

/** Fim pedido pelo Ctrl+C no meio da subida (não é erro). */
class Interrompida extends Error {}

function lerOpcoes() {
  try {
    return parseArgs({
      options: {
        'sem-exportar': { type: 'boolean', default: false },
        recriar: { type: 'boolean', default: false },
        'codigo-criador': { type: 'boolean', default: false },
        parar: { type: 'boolean', default: false },
        ajuda: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values
  } catch {
    console.error(`Opção não reconhecida.\n\n${AJUDA}`)
    process.exit(2)
  }
}

const opcoes = lerOpcoes()

// ------------------------------------------------------------ encerramento

const pecas: {
  exportacao?: Exportacao
  banco?: BancoDaPrevia
  api?: PecaQuePodeCair
  servidor?: ServidorDaPrevia
} = {}
let interrompido = false

/** Entre um passo e outro da subida: para cedo se o Ctrl+C já chegou. */
function seguir(): void {
  if (interrompido) throw new Interrompida()
}

async function pararPeca(nome: string, peca: Peca | undefined): Promise<void> {
  if (!peca) return
  try {
    await peca.parar()
  } catch (e) {
    console.error(`Falha ao parar ${nome}: ${(e as Error).message}`)
  }
}

/** Ordem inversa da subida: ninguém fica sem a peça de que depende enquanto para. */
async function pararTudo(): Promise<void> {
  await pararPeca('o servidor web', pecas.servidor)
  await pararPeca('a exportação', pecas.exportacao)
  await pararPeca('a API', pecas.api)
  await pararPeca('o Postgres', pecas.banco)
}

function mostrarErro(e: unknown): void {
  if (e instanceof ErroDaPrevia) {
    console.error(`\nErro na prévia: ${e.message}`)
    if (e.detalhe) console.error(`\n${e.detalhe}\n`)
    return
  }
  console.error('\nFalha inesperada na prévia:', e)
}

// A subida inteira; o encerramento sempre espera ela assentar, para não parar
// uma peça enquanto outra ainda está nascendo.
type Desfecho = { ok: true } | { ok: false; erro: unknown }
let subida: Promise<Desfecho> = Promise.resolve({ ok: true })

function interromper(codigo: number, motivo?: string): void {
  if (interrompido) {
    if (!motivo) avisar('Já estou encerrando; aguarde.')
    return
  }
  interrompido = true
  if (motivo) console.error(`\n${motivo}`)
  // Erro antes de qualquer peça subir: só a mensagem do erro basta.
  const contarParada = codigo === 0 || Object.values(pecas).some(Boolean)
  if (contarParada) avisar('\nEncerrando a prévia...')
  // A exportação é a única espera longa: parar agora destrava a subida.
  void pecas.exportacao?.parar()
  void subida.then(async () => {
    await pararTudo()
    if (contarParada) avisar('Prévia encerrada.')
    process.exit(codigo)
  })
}

for (const sinal of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'] as const) {
  process.on(sinal, () => interromper(0))
}

// ------------------------------------------------------------ passos

async function recriar(): Promise<void> {
  avisar('Recriando: apagando banco, contas e segredos da prévia (a web exportada fica).')
  await rm(CAMINHOS.banco, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  for (const arquivo of [
    CAMINHOS.ambiente,
    CAMINHOS.contas,
    CAMINHOS.criador,
    CAMINHOS.correio,
    CAMINHOS.push,
  ]) {
    await rm(arquivo, { force: true })
  }
}

async function renomear(de: string, para: string): Promise<void> {
  // No Windows, o antivírus às vezes segura por instantes os arquivos recém-gravados.
  for (let tentativa = 1; ; tentativa++) {
    try {
      await rename(de, para)
      return
    } catch (e) {
      if (tentativa >= 10) throw e
      await esperar(300)
    }
  }
}

/** `npx expo export --platform web`, numa pasta nova que só substitui a anterior se der certo. */
function exportarWeb(): Exportacao {
  const cli = join(RAIZ, 'node_modules', 'expo', 'bin', 'cli')
  const log = join(CAMINHOS.logs, 'exportar.log')
  const inicio = Date.now()
  let processo: ChildProcess | null = null
  let parada = false
  avisar('Web: exportando o app em segundo plano (log em .previa/logs/exportar.log).')

  const concluida = (async () => {
    if (!existsSync(cli)) {
      throw new ErroDaPrevia('Não achei o Expo em node_modules/expo. Rode npm install na raiz.')
    }
    await rm(CAMINHOS.webNova, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
    if (parada) throw new Interrompida()
    const filho = iniciarComLog(
      process.execPath,
      [cli, 'export', '--platform', 'web', '--output-dir', CAMINHOS.webNova],
      {
        log,
        cwd: join(RAIZ, 'apps', 'app'),
        env: { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' },
      },
    )
    processo = filho
    const codigo = await new Promise<number | null>((ok, falha) => {
      filho.once('error', falha)
      filho.once('close', ok)
    })
    if (parada) throw new Interrompida()
    if (codigo !== 0 || !existsSync(join(CAMINHOS.webNova, 'index.html'))) {
      throw new ErroDaPrevia('A exportação da web falhou.', await finalDoLog(log))
    }
    await rm(CAMINHOS.web, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
    await renomear(CAMINHOS.webNova, CAMINHOS.web)
    avisar(`Web: exportada em ${Math.round((Date.now() - inicio) / 1000)} s.`)
  })()
  // Quem trata a falha é quem espera a exportação, no fim da subida.
  concluida.catch(() => undefined)

  return {
    concluida,
    async parar() {
      parada = true
      const filho: ChildProcess | null = processo
      if (filho && !terminou(filho)) {
        filho.kill()
        await esperarSaida(filho, 5_000)
      }
    },
  }
}

async function migrar(amb: AmbienteDaPrevia): Promise<void> {
  const r = await rodarTs('apps/api/src/cli/migrar.ts', [], {
    ...process.env,
    DATABASE_URL_DONO: amb.urlDoDono,
  })
  const texto = `${r.erros}${r.saida}`.trim()
  if (r.codigo !== 0) {
    const dica = texto.includes('foi alterada')
      ? ' Uma migração já aplicada mudou no código. Para recomeçar o banco da prévia: npm run previa -- --recriar'
      : ''
    throw new ErroDaPrevia(`As migrações falharam.${dica}`, texto)
  }
  avisar(`Banco: ${texto.split(/\r?\n/)[0] || 'migrações em dia.'}`)
}

async function garantirCabecalhoDasContas(amb: AmbienteDaPrevia): Promise<void> {
  if (existsSync(CAMINHOS.contas)) return
  const quando = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const cabecalho = [
    'Prévia local do Uni Jovem: contas fictícias',
    `Criado em ${quando}. Só valem no banco local da prévia (.previa/banco).`,
    `Entre em ${amb.urlPublica}/app com qualquer uma destas contas.`,
    '',
  ].join('\n')
  await writeFile(CAMINHOS.contas, cabecalho, { encoding: 'utf8', mode: 0o600 })
}

/** Roda a semente uma vez e guarda as senhas que ela imprime (ela não as mostra de novo). */
async function semear(amb: AmbienteDaPrevia): Promise<void> {
  const contas = existsSync(CAMINHOS.contas) ? await readFile(CAMINHOS.contas, 'utf8') : ''
  if (contas.includes(MARCA_DA_SEMENTE)) return
  const r = await rodarTs('apps/api/src/cli/semear.ts', [], {
    ...process.env,
    DATABASE_URL_DONO: amb.urlDoDono,
    UJ_AMBIENTE: 'desenvolvimento',
    // A semente cifra os pedidos de oração com a mesma chave que a API usa para lê-los.
    ORACAO_CHAVE: amb.daApi['ORACAO_CHAVE'] ?? '',
  })
  if (r.codigo !== 0) {
    throw new ErroDaPrevia('A semente de dados fictícios falhou.', r.erros.trim())
  }
  if (!r.saida.trim()) {
    console.warn(
      'Aviso: a semente já estava no banco, mas as senhas não estão em .previa/contas.txt. ' +
        'Para gerar contas novas: npm run previa -- --recriar',
    )
    return
  }
  await garantirCabecalhoDasContas(amb)
  await appendFile(CAMINHOS.contas, `\n${MARCA_DA_SEMENTE}\n${r.saida.trimEnd()}\n`, 'utf8')
  avisar('Banco: dados fictícios semeados.')
}

async function esperarApi(filho: ChildProcess, log: string): Promise<void> {
  const limite = Date.now() + 90_000
  for (;;) {
    if (terminou(filho)) {
      throw new ErroDaPrevia('A API da prévia não subiu.', await finalDoLog(log))
    }
    try {
      const r = await fetch(`${ENDERECO_DA_API}/api/saude`, { signal: AbortSignal.timeout(2_000) })
      if (r.ok) return
    } catch {
      // Ainda subindo.
    }
    if (Date.now() > limite) {
      throw new ErroDaPrevia(
        'A API da prévia demorou demais para responder.',
        await finalDoLog(log),
      )
    }
    await esperar(300)
  }
}

async function subirApi(amb: AmbienteDaPrevia): Promise<PecaQuePodeCair> {
  const log = join(CAMINHOS.logs, 'api.log')
  const filho = iniciarComLog(
    process.execPath,
    ['--import', 'tsx', join(RAIZ, 'scripts', 'previa', 'api.ts')],
    { log, env: { ...process.env, ...amb.daApi }, ipc: true },
  )
  let pedimosParada = false
  let aoCair: (() => void) | null = null
  filho.once('exit', () => {
    if (!pedimosParada) aoCair?.()
  })
  const api: PecaQuePodeCair = {
    aoCair: (acao) => {
      aoCair = acao
    },
    async parar() {
      if (terminou(filho)) return
      pedimosParada = true
      try {
        if (filho.connected) filho.send('parar')
      } catch {
        // Canal já fechado: o prazo abaixo resolve.
      }
      if (!(await esperarSaida(filho, 10_000))) {
        filho.kill()
        await esperarSaida(filho, 5_000)
      }
    },
  }
  try {
    await esperarApi(filho, log)
  } catch (e) {
    await api.parar()
    throw e
  }
  return api
}

async function postar<T>(caminho: string, corpo: unknown): Promise<T> {
  const r = await fetch(`${ENDERECO_DA_API}${caminho}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(15_000),
  })
  const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) {
    const motivo = typeof dados['mensagem'] === 'string' ? dados['mensagem'] : String(r.status)
    throw new ErroDaPrevia(`A API recusou ${caminho}: ${motivo}`)
  }
  return dados as T
}

function secaoDoCriador(d: DadosDoCriador): string {
  return [
    '',
    MARCA_DO_CRIADOR,
    `Nome: ${d.nome}`,
    `E-mail: ${d.email}`,
    `Senha: ${d.senha}`,
    `Segredo do autenticador (TOTP, base32): ${d.segredoTotp}`,
    `URI para o autenticador: ${d.uri}`,
    'Código de 6 dígitos agora: npm run previa -- --codigo-criador',
    'O login do Criador não pede o código; as ações de plataforma pedem.',
    'Códigos de recuperação (uso único):',
    ...d.codigosDeRecuperacao.map((c) => `  ${c}`),
    '',
  ].join('\n')
}

/**
 * Conta de Criador fictícia pelo fluxo real: `criador:iniciar` emite o link de
 * uso único e o primeiro acesso, pela API, define a senha e confirma o
 * autenticador com um código calculado aqui a partir do segredo devolvido.
 */
async function prepararCriador(amb: AmbienteDaPrevia): Promise<void> {
  if (existsSync(CAMINHOS.criador)) return
  const r = await rodarTs(
    'apps/api/src/cli/criador-iniciar.ts',
    ['--nome', CRIADOR.nome, '--email', CRIADOR.email],
    { ...process.env, DATABASE_URL_DONO: amb.urlDoDono, URL_PUBLICA: amb.urlPublica },
  )
  const texto = `${r.erros}${r.saida}`
  if (r.codigo !== 0) {
    if (/já existe um criador/i.test(texto)) {
      console.warn(
        'Aviso: o banco já tem um Criador (talvez criado pela semente); a prévia não criou outro. ' +
          'Para começar do zero: npm run previa -- --recriar',
      )
      return
    }
    throw new ErroDaPrevia('Não consegui criar o Criador da prévia.', texto.trim())
  }
  const token = /#t=([\w-]+)/.exec(texto)?.[1]
  if (!token) {
    throw new ErroDaPrevia('O criador:iniciar não devolveu o link de primeiro acesso.')
  }
  const inicio = await postar<{ segredo: string; uri: string }>(
    '/api/auth/primeiro-acesso/iniciar',
    { token },
  )
  const senha = randomBytes(15).toString('base64url')
  const fim = await postar<{ codigosDeRecuperacao: string[] }>(
    '/api/auth/primeiro-acesso/concluir',
    { token, senha, codigo: codigoTotp(inicio.segredo, contadorAtual()) },
  )
  const dados: DadosDoCriador = {
    ...CRIADOR,
    senha,
    segredoTotp: inicio.segredo,
    uri: inicio.uri,
    codigosDeRecuperacao: fim.codigosDeRecuperacao,
  }
  await writeFile(CAMINHOS.criador, `${JSON.stringify(dados, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  await garantirCabecalhoDasContas(amb)
  await appendFile(CAMINHOS.contas, secaoDoCriador(dados), 'utf8')
  avisar('Criador: conta criada com senha e autenticador.')
}

async function mostrarCodigoDoCriador(): Promise<void> {
  if (!existsSync(CAMINHOS.criador)) {
    throw new ErroDaPrevia('Ainda não há Criador na prévia. Rode npm run previa uma vez.')
  }
  const dados = JSON.parse(await readFile(CAMINHOS.criador, 'utf8')) as Partial<DadosDoCriador>
  if (!dados.segredoTotp) throw new ErroDaPrevia('O arquivo .previa/criador.json está incompleto.')
  const agora = Date.now()
  const restam = 30 - (Math.floor(agora / 1000) % 30)
  avisar(
    `Código do Criador (${dados.email ?? 'sem e-mail'}): ${codigoTotp(dados.segredoTotp, contadorAtual(agora))}`,
  )
  avisar(`Vale por mais ${restam} s. Código já usado não vale de novo; espere o próximo.`)
}

// ------------------------------------------------------------ subida

async function principal(): Promise<void> {
  if (opcoes.ajuda) {
    avisar(AJUDA)
    return
  }
  if (opcoes['codigo-criador']) {
    await mostrarCodigoDoCriador()
    return
  }
  await mkdir(CAMINHOS.logs, { recursive: true })
  const bin = await binariosDoPostgres()
  if (opcoes.parar) {
    const parou = await pararSobra(bin)
    avisar(parou ? 'Postgres da prévia parado.' : 'Nenhum Postgres da prévia estava rodando.')
    return
  }

  for (const [porta, quem] of [
    [PORTA_DA_WEB, 'do servidor da prévia'],
    [PORTA_DA_API, 'da API'],
  ] as const) {
    if (!(await portaLivre(porta))) {
      throw new ErroDaPrevia(
        `A porta ${porta} (${quem}) está ocupada. Se for outra prévia aberta, ` +
          'encerre-a com Ctrl+C; se não, feche o programa que usa essa porta.',
      )
    }
  }
  await pararSobra(bin)
  if (opcoes.recriar) await recriar()
  if (opcoes['sem-exportar'] && !existsSync(join(CAMINHOS.web, 'index.html'))) {
    throw new ErroDaPrevia('Não há exportação anterior em .previa/web. Rode sem --sem-exportar.')
  }
  const amb = await garantirAmbiente()
  if (!(await portaLivre(amb.portaDoBanco))) {
    throw new ErroDaPrevia(
      `A porta ${amb.portaDoBanco}, do Postgres da prévia, está ocupada por outro programa. ` +
        'Para a prévia escolher outra: npm run previa -- --recriar',
    )
  }
  seguir()

  // A exportação é a parte lenta: corre enquanto banco e API sobem.
  if (opcoes['sem-exportar']) {
    avisar('Web: reaproveitando a exportação anterior (.previa/web).')
  } else {
    pecas.exportacao = exportarWeb()
  }

  avisar(`Banco: subindo o Postgres na porta ${amb.portaDoBanco}.`)
  const banco = await subirBanco(bin, amb)
  pecas.banco = banco
  banco.aoCair(() =>
    interromper(1, 'O Postgres da prévia parou sozinho. Veja .previa/logs/postgres.log.'),
  )
  seguir()
  await migrar(amb)
  seguir()
  await semear(amb)
  seguir()

  avisar(`API: subindo em ${ENDERECO_DA_API}.`)
  const api = await subirApi(amb)
  pecas.api = api
  api.aoCair(() => interromper(1, 'A API da prévia parou sozinha. Veja .previa/logs/api.log.'))
  seguir()
  await prepararCriador(amb)
  seguir()

  if (pecas.exportacao) {
    avisar('Web: esperando a exportação terminar.')
    await pecas.exportacao.concluida
  }
  seguir()
  pecas.servidor = await iniciarServidor({
    porta: PORTA_DA_WEB,
    pastaWeb: CAMINHOS.web,
    portaDaApi: PORTA_DA_API,
  })
  seguir()

  avisar('')
  avisar(`Prévia pronta: http://localhost:${PORTA_DA_WEB}/app`)
  avisar(`Contas fictícias: ${CAMINHOS.contas}`)
  avisar(`Logs: ${CAMINHOS.logs}`)
  avisar('Código do Criador: npm run previa -- --codigo-criador')
  avisar('Ctrl+C encerra tudo (servidor, API e banco).')
}

subida = principal().then(
  (): Desfecho => ({ ok: true }),
  (erro: unknown): Desfecho => ({ ok: false, erro }),
)
void subida.then((desfecho) => {
  // Falha durante um encerramento pedido (exportação interrompida etc.) não é erro.
  if (desfecho.ok || interrompido || desfecho.erro instanceof Interrompida) return
  mostrarErro(desfecho.erro)
  interromper(1)
})
