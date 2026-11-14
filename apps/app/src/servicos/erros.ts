/**
 * Erros que as telas sabem mostrar. A API sempre responde `{ erro, mensagem }`
 * com a mensagem pronta para a tela; aqui ela só é carregada adiante.
 */

export class ErroDaApi extends Error {
  readonly status: number
  readonly codigo: string
  readonly mensagem: string

  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem)
    this.name = 'ErroDaApi'
    this.status = status
    this.codigo = codigo
    this.mensagem = mensagem
  }
}

export const MENSAGEM_SEM_CONEXAO = 'Sem conexão com a internet. Confira sua rede e tente de novo.'

export class SemConexao extends Error {
  readonly mensagem = MENSAGEM_SEM_CONEXAO

  constructor() {
    super(MENSAGEM_SEM_CONEXAO)
    this.name = 'SemConexao'
  }
}

export const MENSAGEM_GENERICA = 'Algo deu errado. Tente de novo em instantes.'

/** Texto humano para qualquer erro que chegue a uma tela. */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDaApi || erro instanceof SemConexao) return erro.mensagem
  return MENSAGEM_GENERICA
}

export function ehErroDaApi(erro: unknown, codigo?: string): erro is ErroDaApi {
  return erro instanceof ErroDaApi && (codigo === undefined || erro.codigo === codigo)
}
