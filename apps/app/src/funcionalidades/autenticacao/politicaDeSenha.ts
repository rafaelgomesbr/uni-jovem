/**
 * Regras de senha mostradas ANTES do envio, espelhando a API (NIST 800-63B:
 * comprimento, sem regras de composição forçada). A lista de senhas vazadas
 * só a API confere; aqui ela aparece como orientação.
 */

export const SENHA_MINIMO = 10
export const SENHA_MAXIMO = 128

export interface RegraDaSenha {
  id: 'tamanho' | 'repeticao' | 'pessoal' | 'comum'
  texto: string
  /** `null` quando só dá para saber ao enviar. */
  atendida: boolean | null
}

export function avaliarSenha(
  senha: string,
  dados: { nome?: string | undefined; email?: string | undefined } = {},
): RegraDaSenha[] {
  const tamanho = [...senha].length
  const normal = senha.toLowerCase()
  const primeiroNome = dados.nome?.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const usuario = dados.email?.split('@')[0]?.toLowerCase() ?? ''
  const contemPessoal =
    (primeiroNome.length >= 4 && normal.includes(primeiroNome)) ||
    (usuario.length >= 4 && normal.includes(usuario))

  return [
    {
      id: 'tamanho',
      texto: `Pelo menos ${SENHA_MINIMO} caracteres (uma frase curta funciona bem)`,
      atendida: tamanho >= SENHA_MINIMO && tamanho <= SENHA_MAXIMO,
    },
    {
      id: 'repeticao',
      texto: 'Sem repetir o mesmo caractere (como "aaaaaaaaaa")',
      atendida: senha.length > 0 && new Set(senha).size > 2,
    },
    {
      id: 'pessoal',
      texto: 'Sem o seu nome ou o seu e-mail',
      atendida: senha.length > 0 && !contemPessoal,
    },
    {
      id: 'comum',
      texto: 'Que não seja uma senha comum (conferimos ao enviar)',
      atendida: null,
    },
  ]
}

/** Primeiro problema que já dá para apontar antes de enviar, ou `null`. */
export function problemaDaSenha(
  senha: string,
  confirmacao: string,
  dados: { nome?: string | undefined; email?: string | undefined } = {},
): string | null {
  if (!senha) return 'Crie uma senha.'
  const falha = avaliarSenha(senha, dados).find((r) => r.atendida === false)
  if (falha) return `A senha precisa atender: ${falha.texto.toLowerCase()}.`
  if (senha !== confirmacao) return 'As duas senhas não são iguais.'
  return null
}

/**
 * Status vivo da senha nova (D63), numa linha só, em texto: sem lista longa de
 * regras. Vazio, a ajuda; abaixo do mínimo, quanto já foi; no mínimo, "Senha boa."
 */
export function statusDaSenha(senha: string): { texto: string; ok: boolean } {
  const tamanho = [...senha].length
  if (tamanho === 0) {
    return {
      texto: `Pelo menos ${SENHA_MINIMO} caracteres. Uma frase curta funciona bem.`,
      ok: false,
    }
  }
  if (tamanho < SENHA_MINIMO)
    return { texto: `${tamanho} de ${SENHA_MINIMO} caracteres`, ok: false }
  return { texto: 'Senha boa.', ok: true }
}

/**
 * O erro da senha nova ao continuar (D63), em linguagem humana e sem pedir a
 * senha duas vezes (o botão Mostrar substitui a confirmação). Espelha a API:
 * comprimento, repetição e senha que lembra o e-mail ou o nome.
 */
export function erroDaSenhaNova(
  senha: string,
  dados: { nome?: string | undefined; email?: string | undefined } = {},
): string | null {
  if (!senha) return 'Crie uma senha.'
  const tamanho = [...senha].length
  if (tamanho < SENHA_MINIMO) {
    const falta = SENHA_MINIMO - tamanho
    return `Faltam ${falta} ${falta === 1 ? 'caractere' : 'caracteres'}. Use pelo menos ${SENHA_MINIMO}; uma frase curta funciona.`
  }
  if (tamanho > SENHA_MAXIMO) return `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.`
  const regras = avaliarSenha(senha, dados)
  if (regras.find((r) => r.id === 'repeticao')?.atendida === false) {
    return 'Misture letras ou palavras. Repetir o mesmo caractere é fácil de adivinhar.'
  }
  if (regras.find((r) => r.id === 'pessoal')?.atendida === false) {
    return 'Essa senha lembra seu e-mail ou seu nome. Escolha uma que só você saiba.'
  }
  return null
}
