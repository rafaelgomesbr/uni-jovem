import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CAMINHOS, ErroDaPrevia, PORTA_DA_API, PORTA_DA_WEB, portaLivre } from './apoio.ts'

/**
 * `.previa/.env`: gerado uma vez, com segredos aleatórios que só existem nesta
 * máquina. Tem tudo o que a API precisa e, nas chaves `PREVIA_*`, o que só a
 * prévia usa (porta e senhas do Postgres embutido).
 */

export interface AmbienteDaPrevia {
  portaDoBanco: number
  senhas: { superusuario: string; dono: string; api: string; auth: string }
  urlDoSuperusuario: string
  urlDoDono: string
  urlPublica: string
  /** Só o que a API lê: sem as chaves `PREVIA_*` e sem a URL do dono do banco. */
  daApi: Record<string, string>
}

const PORTAS_DO_BANCO = { primeira: 54433, ultima: 54532 }
const NOME_DO_BANCO = 'unijovem' // o mesmo de infra/banco/papeis.sql

/** Segredo aleatório que passa na validação da API (nada de "exemplo" no meio). */
function segredo(bytes: number): string {
  for (;;) {
    const valor = randomBytes(bytes).toString('base64url')
    if (!/troque|exemplo|changeme/i.test(valor)) return valor
  }
}

const chaveDe32Bytes = () => randomBytes(32).toString('base64')

function urlDoBanco(papel: string, senha: string, porta: number, banco = NOME_DO_BANCO): string {
  return `postgres://${papel}:${senha}@127.0.0.1:${porta}/${banco}`
}

async function escolherPortaDoBanco(): Promise<number> {
  for (let p = PORTAS_DO_BANCO.primeira; p <= PORTAS_DO_BANCO.ultima; p++) {
    if (await portaLivre(p)) return p
  }
  throw new ErroDaPrevia('Nenhuma porta livre entre 54433 e 54532 para o Postgres da prévia.')
}

async function gerar(): Promise<string> {
  const porta = await escolherPortaDoBanco()
  const senhas = { su: segredo(24), dono: segredo(24), api: segredo(24), auth: segredo(24) }
  const barras = (caminho: string) => caminho.replaceAll('\\', '/')
  const quando = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  return [
    `# Prévia local do Uni Jovem (scripts/previa), gerado em ${quando}.`,
    '# Segredos aleatórios, só desta máquina. Nunca copie para outro ambiente.',
    '# Apagar este arquivo exige recriar o banco: npm run previa -- --recriar',
    '',
    '# Postgres embutido da prévia (.previa/banco)',
    `PREVIA_PORTA_BANCO=${porta}`,
    `PREVIA_SENHA_SUPERUSUARIO=${senhas.su}`,
    `PREVIA_SENHA_DONO=${senhas.dono}`,
    `PREVIA_SENHA_API=${senhas.api}`,
    `PREVIA_SENHA_AUTH=${senhas.auth}`,
    '',
    '# API (apps/api/src/config.ts)',
    'UJ_AMBIENTE=desenvolvimento',
    `PORTA=${PORTA_DA_API}`,
    'HOST=127.0.0.1',
    // O servidor da prévia (proxy) fala com a API a partir da própria máquina.
    'PROXIES_CONFIAVEIS=127.0.0.1,::1',
    `URL_PUBLICA=http://localhost:${PORTA_DA_WEB}`,
    `DATABASE_URL_API=${urlDoBanco('uj_api', senhas.api, porta)}`,
    `DATABASE_URL_AUTH=${urlDoBanco('uj_auth', senhas.auth, porta)}`,
    `DATABASE_URL_DONO=${urlDoBanco('uj_dono', senhas.dono, porta)}`,
    `JWT_SEGREDO=${segredo(48)}`,
    `CONVITE_SEGREDO=${segredo(48)}`,
    `ORACAO_CHAVE=${chaveDe32Bytes()}`,
    `TOTP_CHAVE=${chaveDe32Bytes()}`,
    'EMAIL_MODO=arquivo',
    `NOTIFICADOR_ARQUIVO=${barras(CAMINHOS.correio)}`,
    'PUSH_MODO=arquivo',
    `PUSH_ARQUIVO=${barras(CAMINHOS.push)}`,
    '',
  ].join('\n')
}

function lerPares(texto: string): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const linha of texto.split(/\r?\n/)) {
    const limpa = linha.trim()
    if (!limpa || limpa.startsWith('#')) continue
    const igual = limpa.indexOf('=')
    if (igual <= 0) continue
    valores[limpa.slice(0, igual).trim()] = limpa.slice(igual + 1).trim()
  }
  return valores
}

function interpretar(texto: string): AmbienteDaPrevia {
  const v = lerPares(texto)
  const exigir = (chave: string): string => {
    const valor = v[chave]
    if (!valor) {
      throw new ErroDaPrevia(
        `O arquivo .previa/.env está sem ${chave}. Para gerar tudo de novo: npm run previa -- --recriar`,
      )
    }
    return valor
  }
  const portaDoBanco = Number(exigir('PREVIA_PORTA_BANCO'))
  const senhas = {
    superusuario: exigir('PREVIA_SENHA_SUPERUSUARIO'),
    dono: exigir('PREVIA_SENHA_DONO'),
    api: exigir('PREVIA_SENHA_API'),
    auth: exigir('PREVIA_SENHA_AUTH'),
  }
  const daApi = Object.fromEntries(
    Object.entries(v).filter(([k]) => !k.startsWith('PREVIA_') && k !== 'DATABASE_URL_DONO'),
  )
  return {
    portaDoBanco,
    senhas,
    urlDoSuperusuario: urlDoBanco('postgres', senhas.superusuario, portaDoBanco, 'postgres'),
    urlDoDono: exigir('DATABASE_URL_DONO'),
    urlPublica: exigir('URL_PUBLICA'),
    daApi,
  }
}

/** Lê `.previa/.env`, gerando na primeira vez. */
export async function garantirAmbiente(): Promise<AmbienteDaPrevia> {
  if (!existsSync(CAMINHOS.ambiente)) {
    if (existsSync(join(CAMINHOS.banco, 'PG_VERSION'))) {
      throw new ErroDaPrevia(
        'Existe um banco em .previa/banco, mas o .previa/.env (com as senhas dele) sumiu. ' +
          'Para começar do zero: npm run previa -- --recriar',
      )
    }
    await writeFile(CAMINHOS.ambiente, await gerar(), { encoding: 'utf8', mode: 0o600 })
  }
  return interpretar(await readFile(CAMINHOS.ambiente, 'utf8'))
}
