import { spawn, type ChildProcess } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join, relative, resolve } from 'node:path'

/**
 * Caminhos, portas e utilitários de processo da prévia local. Tudo o que a
 * prévia grava fica em `.previa/` (ignorada pelo git).
 */

export const RAIZ = resolve(import.meta.dirname, '..', '..')
export const PASTA_DA_PREVIA = join(RAIZ, '.previa')

export const CAMINHOS = {
  banco: join(PASTA_DA_PREVIA, 'banco'),
  web: join(PASTA_DA_PREVIA, 'web'),
  webNova: join(PASTA_DA_PREVIA, 'web-nova'),
  logs: join(PASTA_DA_PREVIA, 'logs'),
  ambiente: join(PASTA_DA_PREVIA, '.env'),
  contas: join(PASTA_DA_PREVIA, 'contas.txt'),
  criador: join(PASTA_DA_PREVIA, 'criador.json'),
  correio: join(PASTA_DA_PREVIA, 'correio.txt'),
  push: join(PASTA_DA_PREVIA, 'push.jsonl'),
} as const

export const PORTA_DA_API = 3333
export const PORTA_DA_WEB = 8090
export const ENDERECO_DA_API = `http://127.0.0.1:${PORTA_DA_API}`

/** Falha esperada: a mensagem já é para gente ler; `detalhe` costuma ser o fim de um log. */
export class ErroDaPrevia extends Error {
  readonly detalhe: string | undefined

  constructor(mensagem: string, detalhe?: string) {
    super(mensagem)
    this.name = 'ErroDaPrevia'
    this.detalhe = detalhe
  }
}

export function avisar(texto: string): void {
  console.log(texto)
}

/** Caminho relativo à raiz, para mensagens curtas. */
export function naRaiz(caminho: string): string {
  return relative(RAIZ, caminho)
}

export const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms))

/**
 * Opções de todo processo filho da prévia.
 *
 * No Windows, `windowsHide` com toda a saída em pipe faz o filho nascer com um
 * console próprio e invisível: o Ctrl+C do terminal chega só ao orquestrador,
 * que para cada peça na ordem certa (servidor, API, banco). Sem `detached`, o
 * filho fica no job do Node e morre junto se o orquestrador cair à força, então
 * não sobra órfão. Fora do Windows, `detached` põe o filho em outro grupo de
 * processos, o que tem o mesmo efeito sobre o Ctrl+C.
 */
const FORA_DO_CONSOLE = { windowsHide: true, detached: process.platform !== 'win32' } as const

export interface Resultado {
  codigo: number | null
  saida: string
  erros: string
}

/** Roda um comando curto e devolve a saída inteira. */
export function rodar(
  comando: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = RAIZ,
): Promise<Resultado> {
  return new Promise((ok, falha) => {
    const filho = spawn(comando, args, { ...FORA_DO_CONSOLE, cwd, env, stdio: 'pipe' })
    let saida = ''
    let erros = ''
    filho.stdout.setEncoding('utf8').on('data', (t: string) => {
      saida += t
    })
    filho.stderr.setEncoding('utf8').on('data', (t: string) => {
      erros += t
    })
    filho.once('error', falha)
    filho.once('close', (codigo) => ok({ codigo, saida, erros }))
  })
}

/** Roda um arquivo TypeScript do repositório com o tsx, como os scripts do projeto. */
export function rodarTs(arquivo: string, args: string[], env: NodeJS.ProcessEnv) {
  return rodar(process.execPath, ['--import', 'tsx', join(RAIZ, arquivo), ...args], env)
}

/** Processo de longa duração, com stdout e stderr num arquivo de log. */
export function iniciarComLog(
  comando: string,
  args: string[],
  opcoes: { log: string; env?: NodeJS.ProcessEnv; cwd?: string; ipc?: boolean },
): ChildProcess {
  const destino = createWriteStream(opcoes.log, { flags: 'w' })
  const filho = spawn(comando, args, {
    ...FORA_DO_CONSOLE,
    cwd: opcoes.cwd ?? RAIZ,
    env: opcoes.env ?? process.env,
    stdio: opcoes.ipc ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'],
  })
  filho.stdout?.pipe(destino, { end: false })
  filho.stderr?.pipe(destino, { end: false })
  filho.once('close', () => destino.end())
  return filho
}

export function terminou(filho: ChildProcess): boolean {
  return filho.exitCode !== null || filho.signalCode !== null
}

/** Espera o processo sair; devolve false se o prazo acabar antes. */
export function esperarSaida(filho: ChildProcess, prazoMs: number): Promise<boolean> {
  if (terminou(filho)) return Promise.resolve(true)
  return new Promise((ok) => {
    const prazo = setTimeout(() => ok(false), prazoMs)
    filho.once('exit', () => {
      clearTimeout(prazo)
      ok(true)
    })
  })
}

export function portaLivre(porta: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((ok) => {
    const teste = createServer()
    teste.once('error', () => ok(false))
    teste.listen(porta, host, () => teste.close(() => ok(true)))
  })
}

/** Últimas linhas de um log, para mostrar junto do erro. */
export async function finalDoLog(caminho: string, linhas = 30): Promise<string> {
  try {
    const texto = await readFile(caminho, 'utf8')
    return texto.trimEnd().split(/\r?\n/).slice(-linhas).join('\n')
  } catch {
    return ''
  }
}
