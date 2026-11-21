import { ehErroDaApi, ErroLocal, SemConexao } from '@/servicos/erros'

/**
 * Erros da entrada em linguagem humana (UX 5.5): dizem o que houve e o que
 * fazer, sem código e sem "algo deu errado". Senha errada e conta não
 * encontrada têm o MESMO texto, de propósito: dizer que o e-mail não existe
 * revelaria quem usa o app (a lista de pessoas de uma igreja é dado sensível).
 */
export type TipoDeErroDaEntrada = 'credencial' | 'rede' | 'tentativas' | 'geral'

export interface ErroDaEntrada {
  tipo: TipoDeErroDaEntrada
  /** A frase que abre a mensagem, em destaque. */
  titulo: string
  /** O que fazer, na sequência. */
  detalhe: string
}

export const TEXTO_DO_E_MAIL_VAZIO = 'Digite seu e-mail.'
export const TEXTO_DA_SENHA_VAZIA = 'Digite sua senha.'
export const TEXTO_DO_E_MAIL_INCOMPLETO =
  'Esse e-mail parece incompleto. Confira se tem @ e o final, como nome@exemplo.com.'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** O e-mail digitado tem cara de e-mail? (a conferência de verdade é a do servidor). */
export function emailParecido(email: string): boolean {
  return EMAIL.test(email.trim())
}

/** Texto da falha de um provedor (Apple ou Google) que não foi cancelamento. */
export function textoDaFalhaDoProvedor(provedor: 'apple' | 'google'): string {
  return `Não deu para entrar com ${provedor === 'apple' ? 'a Apple' : 'o Google'} agora. Tente de novo ou use outro jeito de entrar.`
}

/** Dica (não é erro) depois de cancelar a folha do provedor 2 vezes seguidas. */
export const DICA_DE_CANCELAMENTO = 'Prefere entrar com e-mail? Toque em Entrar com e-mail.'

/** Erro da entrada por e-mail e senha. */
export function erroDaEntrada(erro: unknown): ErroDaEntrada {
  if (erro instanceof SemConexao) {
    return {
      tipo: 'rede',
      titulo: 'Sem internet.',
      detalhe: 'Confira o Wi-Fi ou os dados do celular e tente de novo.',
    }
  }
  if (ehErroDaApi(erro, 'credenciais_invalidas')) {
    return {
      tipo: 'credencial',
      titulo: 'E-mail ou senha não conferem.',
      detalhe:
        'Confira os dois e tente de novo. Se você criou a conta com a Apple ou o Google, use o botão deles.',
    }
  }
  if (ehErroDaApi(erro, 'muitas_tentativas') || (ehErroDaApi(erro) && erro.status === 429)) {
    return {
      tipo: 'tentativas',
      titulo: 'Muitas tentativas seguidas.',
      detalhe: 'Espere alguns minutos e tente de novo, ou crie uma senha nova.',
    }
  }
  if (ehErroDaApi(erro) || erro instanceof ErroLocal) {
    return { tipo: 'geral', titulo: erro.mensagem, detalhe: '' }
  }
  return {
    tipo: 'geral',
    titulo: 'Não deu para entrar agora.',
    detalhe: 'Tente de novo em instantes.',
  }
}

/**
 * Texto do erro de um acesso por provedor: a mensagem pronta da API quando ela
 * existe (por exemplo, "Não encontramos uma conta ligada a este Google"); sem
 * internet, o texto da rede; qualquer outra falha, o texto do provedor.
 */
export function textoDoErroDoProvedor(erro: unknown, provedor: 'apple' | 'google'): string {
  if (erro instanceof SemConexao) {
    return 'Sem internet. Confira o Wi-Fi ou os dados do celular e tente de novo.'
  }
  if (ehErroDaApi(erro) || erro instanceof ErroLocal) return erro.mensagem
  return textoDaFalhaDoProvedor(provedor)
}
