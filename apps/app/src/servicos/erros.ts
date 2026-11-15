/**
 * Erros que as telas sabem mostrar. A API sempre responde `{ erro, mensagem }`
 * com a mensagem pronta para a tela; aqui ela só é carregada adiante.
 */

export class ErroDaApi extends Error {
  readonly status: number
  readonly codigo: string
  readonly mensagem: string
  /** Estado atual do servidor, quando a API manda junto (conflito de versão, 409). */
  readonly atual: unknown
  /**
   * Campos a mais do corpo do erro, quando a API oferece uma saída (ex.:
   * `{ acao: 'nomear_admin', comunidades }` ao excluir a conta).
   */
  readonly extra: Readonly<Record<string, unknown>>

  constructor(
    status: number,
    codigo: string,
    mensagem: string,
    atual?: unknown,
    extra: Record<string, unknown> = {},
  ) {
    super(mensagem)
    this.name = 'ErroDaApi'
    this.status = status
    this.codigo = codigo
    this.mensagem = mensagem
    this.atual = atual
    this.extra = extra
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

/** 429 ao abrir o app (renovar a sessão) num encontro com muita gente na mesma rede (D44). */
export const MENSAGEM_MUITA_GENTE = 'Muita gente entrando agora. Tente de novo em instantes.'

/**
 * Erro do próprio aparelho com texto pronto para a tela (ex.: ação sem
 * internet num evento que não foi preparado para uso offline).
 */
export class ErroLocal extends Error {
  readonly mensagem: string

  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroLocal'
    this.mensagem = mensagem
  }
}

/** Texto humano para qualquer erro que chegue a uma tela. */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDaApi || erro instanceof SemConexao || erro instanceof ErroLocal) {
    return erro.mensagem
  }
  return MENSAGEM_GENERICA
}

export function ehErroDaApi(erro: unknown, codigo?: string): erro is ErroDaApi {
  return erro instanceof ErroDaApi && (codigo === undefined || erro.codigo === codigo)
}

/** Pedido cancelado de propósito (AbortController): não é erro para mostrar. */
export function ehCancelamento(erro: unknown): boolean {
  return erro instanceof Error && erro.name === 'AbortError'
}
