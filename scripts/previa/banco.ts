import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'
import type { AmbienteDaPrevia } from './ambiente.ts'
import {
  avisar,
  CAMINHOS,
  ErroDaPrevia,
  esperar,
  esperarSaida,
  finalDoLog,
  iniciarComLog,
  PASTA_DA_PREVIA,
  RAIZ,
  rodar,
  terminou,
} from './apoio.ts'

/**
 * Postgres 17 embutido da prévia, com os binários do pacote `embedded-postgres`
 * (o mesmo dos testes), mas com dados persistentes em `.previa/banco` e parada
 * limpa pelo `pg_ctl stop -m fast`: a classe do pacote mata o processo à força
 * no Windows e instala ganchos de saída próprios, então só os binários são usados.
 */

export interface Binarios {
  initdb: string
  pg_ctl: string
  postgres: string
}

export interface BancoDaPrevia {
  parar(): Promise<void>
  /** Chamado se o Postgres terminar sem a prévia ter pedido. */
  aoCair(acao: () => void): void
}

const LOG = join(CAMINHOS.logs, 'postgres.log')

const PACOTES: Readonly<Partial<Record<string, string>>> = {
  'win32-x64': '@embedded-postgres/windows-x64',
  'darwin-arm64': '@embedded-postgres/darwin-arm64',
  'darwin-x64': '@embedded-postgres/darwin-x64',
  'linux-x64': '@embedded-postgres/linux-x64',
  'linux-arm64': '@embedded-postgres/linux-arm64',
}

export async function binariosDoPostgres(): Promise<Binarios> {
  const pacote = PACOTES[`${process.platform}-${process.arch}`]
  if (!pacote) {
    throw new ErroDaPrevia(`Não há Postgres embutido para ${process.platform}-${process.arch}.`)
  }
  try {
    // Nome em variável: cada pacote só existe na plataforma em que foi instalado.
    const m = (await import(pacote)) as Binarios
    return { initdb: m.initdb, pg_ctl: m.pg_ctl, postgres: m.postgres }
  } catch {
    throw new ErroDaPrevia(`Não achei o pacote ${pacote}. Rode npm install na raiz do repositório.`)
  }
}

const normalizar = (caminho: string) => caminho.replaceAll('\\', '/').toLowerCase()

function vivo(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function linhaDeComando(pid: number): Promise<string | null> {
  const r =
    process.platform === 'win32'
      ? await rodar('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
        ]).catch(() => null)
      : await rodar('ps', ['-o', 'command=', '-p', String(pid)]).catch(() => null)
  const texto = r?.saida.trim()
  return texto ? texto : null
}

function pgCtlParar(bin: Binarios) {
  return rodar(bin.pg_ctl, ['stop', '-D', CAMINHOS.banco, '-m', 'fast', '-w', '-t', '25'])
}

/**
 * Para um Postgres da prévia que tenha ficado rodando (por exemplo, depois de
 * um desligamento à força). Só mexe no processo se a linha de comando dele
 * apontar para `.previa/banco`: há outros Postgres nesta máquina que não são da prévia.
 */
export async function pararSobra(bin: Binarios): Promise<boolean> {
  const arquivoPid = join(CAMINHOS.banco, 'postmaster.pid')
  if (!existsSync(arquivoPid)) return false
  const pid = Number.parseInt((await readFile(arquivoPid, 'utf8')).split(/\r?\n/)[0] ?? '', 10)
  if (!Number.isInteger(pid) || pid <= 0 || !vivo(pid)) return false
  const comando = await linhaDeComando(pid)
  // Sem como conferir: o próprio Postgres decide na partida se o arquivo é velho.
  if (comando === null) return false
  if (!normalizar(comando).includes(normalizar(CAMINHOS.banco))) {
    // O número foi reaproveitado por outro processo: o arquivo é de uma
    // execução que caiu, e nenhum Postgres usa .previa/banco agora.
    await rm(arquivoPid, { force: true })
    return false
  }
  avisar('Um Postgres da prévia ficou rodando de uma execução anterior; parando.')
  const r = await pgCtlParar(bin)
  if (r.codigo !== 0) {
    throw new ErroDaPrevia(
      `Não consegui parar o Postgres da prévia que sobrou (processo ${pid}).`,
      (r.erros + r.saida).trim(),
    )
  }
  return true
}

async function initdb(bin: Binarios, amb: AmbienteDaPrevia): Promise<void> {
  const arquivoDaSenha = join(PASTA_DA_PREVIA, `.senha-${process.pid}.tmp`)
  await writeFile(arquivoDaSenha, `${amb.senhas.superusuario}\n`, { mode: 0o600 })
  try {
    const r = await rodar(bin.initdb, [
      `--pgdata=${CAMINHOS.banco}`,
      '--username=postgres',
      `--pwfile=${arquivoDaSenha}`,
      '--auth=scram-sha-256',
      // UTF-8 como em produção; o provedor builtin dá maiúsculas e minúsculas
      // Unicode sem depender dos locales do Windows.
      '--encoding=UTF8',
      '--locale=C',
      '--locale-provider=builtin',
      '--builtin-locale=C.UTF-8',
      '--no-instructions',
    ])
    if (r.codigo !== 0) {
      throw new ErroDaPrevia('O initdb não conseguiu criar o banco da prévia.', r.erros + r.saida)
    }
  } finally {
    await rm(arquivoDaSenha, { force: true })
  }
}

/**
 * Papéis e banco a partir de infra/banco/papeis.sql (a mesma fonte da
 * homologação), trocando as variáveis do psql pelas senhas da prévia.
 */
async function criarPapeis(amb: AmbienteDaPrevia): Promise<void> {
  const sql = await readFile(join(RAIZ, 'infra', 'banco', 'papeis.sql'), 'utf8')
  const su = new pg.Client({ connectionString: amb.urlDoSuperusuario })
  await su.connect()
  try {
    const variaveis: Readonly<Partial<Record<string, string>>> = {
      senha_dono: amb.senhas.dono,
      senha_api: amb.senhas.api,
      senha_auth: amb.senhas.auth,
    }
    const comandos = sql
      .split(/\r?\n/)
      .filter((linha) => !linha.trim().startsWith('--'))
      .join('\n')
      .replace(/:'(\w+)'/g, (_, nome: string) => {
        const valor = variaveis[nome]
        if (valor === undefined) {
          throw new ErroDaPrevia(
            `infra/banco/papeis.sql usa a variável ${nome}, que a prévia não conhece.`,
          )
        }
        return su.escapeLiteral(valor)
      })
      .split(/;\s*(?:\r?\n|$)/)
      .map((c) => c.trim())
      .filter(Boolean)
    // Um por vez: CREATE DATABASE não roda dentro de transação.
    for (const comando of comandos) await su.query(comando)
  } finally {
    await su.end()
  }
}

async function esperarPronto(filho: ChildProcess, url: string): Promise<void> {
  const limite = Date.now() + 90_000
  for (;;) {
    if (terminou(filho)) {
      throw new ErroDaPrevia('O Postgres da prévia não subiu.', await finalDoLog(LOG))
    }
    const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2_000 })
    cliente.on('error', () => undefined)
    try {
      await cliente.connect()
      await cliente.end()
      return
    } catch {
      await cliente.end().catch(() => undefined)
    }
    if (Date.now() > limite) {
      throw new ErroDaPrevia(
        'O Postgres da prévia demorou demais para aceitar conexões.',
        await finalDoLog(LOG),
      )
    }
    await esperar(300)
  }
}

function iniciarPostgres(bin: Binarios, amb: AmbienteDaPrevia) {
  const filho = iniciarComLog(
    bin.postgres,
    ['-D', CAMINHOS.banco, '-p', String(amb.portaDoBanco), '-c', 'listen_addresses=127.0.0.1'],
    { log: LOG },
  )
  let pedimosParada = false
  let aoCair: (() => void) | null = null
  filho.once('exit', () => {
    if (!pedimosParada) aoCair?.()
  })
  const banco: BancoDaPrevia & { processo: ChildProcess } = {
    processo: filho,
    aoCair: (acao) => {
      aoCair = acao
    },
    async parar() {
      if (terminou(filho)) return
      pedimosParada = true
      const saiu = esperarSaida(filho, 30_000)
      await pgCtlParar(bin).catch(() => null)
      if (!(await saiu)) {
        filho.kill()
        await esperarSaida(filho, 5_000)
      }
    },
  }
  return banco
}

/** Sobe o Postgres; na primeira vez cria o cluster, os papéis e o banco. */
export async function subirBanco(bin: Binarios, amb: AmbienteDaPrevia): Promise<BancoDaPrevia> {
  const novo = !existsSync(join(CAMINHOS.banco, 'PG_VERSION'))
  if (novo) {
    await rm(CAMINHOS.banco, { recursive: true, force: true })
    await initdb(bin, amb)
  }
  const banco = iniciarPostgres(bin, amb)
  try {
    await esperarPronto(banco.processo, amb.urlDoSuperusuario)
    if (novo) await criarPapeis(amb)
  } catch (e) {
    await banco.parar()
    // Primeira vez pela metade: apaga, para a próxima execução começar limpa.
    if (novo) {
      await rm(CAMINHOS.banco, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
    }
    throw e
  }
  return banco
}
