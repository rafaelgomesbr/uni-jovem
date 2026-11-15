/**
 * Dublê do `expo-sqlite` para os testes: SQL de verdade (o SQLite embutido do
 * Node), em memória, com "arquivos" por nome. Simula o comportamento do
 * SQLCipher que importa para o app: o banco fica preso à chave do primeiro
 * `PRAGMA key`, abrir com outra chave (ou sem chave) falha na primeira
 * leitura, e `PRAGMA cipher_version` responde.
 */

interface Instrucao {
  get(...p: unknown[]): unknown
  all(...p: unknown[]): unknown[]
  run(...p: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }
}
interface BancoDoNode {
  exec(sql: string): void
  prepare(sql: string): Instrucao
  close(): void
}

function carregarSqliteDoNode(): { DatabaseSync: new (caminho: string) => BancoDoNode } {
  // O módulo é experimental no Node 22: cala só o aviso dele, nada mais.
  const emitir = process.emitWarning.bind(process)
  process.emitWarning = ((aviso: string | Error, ...resto: unknown[]) => {
    if (String(aviso).includes('SQLite is an experimental')) return
    ;(emitir as (...a: unknown[]) => void)(aviso, ...resto)
  }) as typeof process.emitWarning
  const obter = (process as unknown as { getBuiltinModule: (n: string) => unknown })
    .getBuiltinModule
  return obter('node:sqlite') as { DatabaseSync: new (caminho: string) => BancoDoNode }
}

const { DatabaseSync } = carregarSqliteDoNode()

interface Arquivo {
  banco: BancoDoNode
  chave: string | null
}

/** "Disco" do dublê: nome do arquivo → conteúdo. Exposto para os testes inspecionarem. */
export const __arquivos = new Map<string, Arquivo>()
/** Liga para simular um binário sem SQLCipher (cipher_version vazio). */
export const __opcoes = { semCifragem: false }

const valor = (v: unknown) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v)

function parametros(p: unknown[]): unknown[] {
  const lista = p.length === 1 && Array.isArray(p[0]) ? (p[0] as unknown[]) : p
  return lista.map(valor)
}

class BancoFalso {
  private chaveInformada: string | null = null
  private fechado = false

  constructor(
    readonly nome: string,
    private readonly arquivo: Arquivo,
  ) {}

  private conferir() {
    if (this.fechado) throw new Error('Banco fechado.')
    if (this.arquivo.chave !== null && this.chaveInformada !== this.arquivo.chave) {
      throw new Error('file is not a database')
    }
  }

  async execAsync(sql: string): Promise<void> {
    const chave = /^\s*PRAGMA\s+key\s*=\s*(.+?)\s*;?\s*$/i.exec(sql)
    if (chave) {
      this.chaveInformada = chave[1]!
      // Arquivo novo: a primeira chave passa a ser a dele.
      if (this.arquivo.chave === null && !__opcoes.semCifragem) {
        this.arquivo.chave = this.chaveInformada
      }
      return
    }
    this.conferir()
    this.arquivo.banco.exec(sql)
  }

  async getFirstAsync<T>(sql: string, ...p: unknown[]): Promise<T | null> {
    if (/^\s*PRAGMA\s+cipher_version/i.test(sql)) {
      return (__opcoes.semCifragem ? null : { cipher_version: '4.6.1 community (dublê)' }) as T
    }
    this.conferir()
    return ((this.arquivo.banco.prepare(sql).get(...parametros(p)) as T | undefined) ??
      null) as T | null
  }

  async getAllAsync<T>(sql: string, ...p: unknown[]): Promise<T[]> {
    this.conferir()
    return this.arquivo.banco.prepare(sql).all(...parametros(p)) as T[]
  }

  async runAsync(sql: string, ...p: unknown[]) {
    this.conferir()
    const r = this.arquivo.banco.prepare(sql).run(...parametros(p))
    return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }
  }

  async withTransactionAsync(tarefa: () => Promise<void>): Promise<void> {
    await this.execAsync('begin')
    try {
      await tarefa()
      await this.execAsync('commit')
    } catch (e) {
      await this.execAsync('rollback')
      throw e
    }
  }

  async closeAsync(): Promise<void> {
    this.fechado = true
  }
}

export async function openDatabaseAsync(nome: string): Promise<BancoFalso> {
  let arquivo = __arquivos.get(nome)
  if (!arquivo) {
    arquivo = { banco: new DatabaseSync(':memory:'), chave: null }
    __arquivos.set(nome, arquivo)
  }
  return new BancoFalso(nome, arquivo)
}

export async function deleteDatabaseAsync(nome: string): Promise<void> {
  __arquivos.get(nome)?.banco.close()
  __arquivos.delete(nome)
}

/** Tudo o que está gravado em todos os "arquivos", como texto (para procurar vazamentos). */
export function __despejar(): string {
  const partes: string[] = []
  for (const [nome, { banco }] of __arquivos) {
    const tabelas = banco.prepare("select name from sqlite_master where type = 'table'").all() as {
      name: string
    }[]
    for (const { name } of tabelas) {
      partes.push(
        `${nome}/${name}: ${JSON.stringify(banco.prepare(`select * from ${name}`).all())}`,
      )
    }
  }
  return partes.join('\n')
}

export function __limpar(): void {
  for (const { banco } of __arquivos.values()) banco.close()
  __arquivos.clear()
  __opcoes.semCifragem = false
}
