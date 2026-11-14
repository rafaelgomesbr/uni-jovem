/**
 * Regras de senha (NIST SP 800-63B): comprimento mínimo, sem regras de
 * composição forçada, recusando senhas comuns e as que repetem nome ou e-mail.
 * A lista é local: a senha nunca sai do servidor para ser conferida em terceiros.
 */

export const SENHA_MINIMO = 10
export const SENHA_MAXIMO = 128

// Senhas mais comuns em vazamentos públicos, com variantes em português.
const COMUNS = new Set(
  `123456 1234567 12345678 123456789 1234567890 0123456789 9876543210 111111 000000 123123
  password password1 password123 senha senha123 senha1234 senha12345 minhasenha mudar123
  qwerty qwerty123 qwertyuiop asdfghjkl zxcvbnm abc123 abcd1234 abcdef1234 iloveyou teamo
  admin admin123 administrador root welcome bemvindo 1q2w3e4r 1q2w3e4r5t q1w2e3r4t5 aa123456
  princesa flamengo corinthians palmeiras vasco gremio saopaulo brasil brasil123 deusefiel
  jesus jesus123 jesuscristo deus deus123 deusefiel123 jesusteama jesusmeama gloria aleluia
  futebol batman superman dragon monkey sunshine football baseball letmein trustno1
  unijovem unijovem123 jovens jovens123 igreja igreja123 louvor oracao sabado`
    .split(/\s+/)
    .filter(Boolean),
)

export type ProblemaDeSenha =
  'curta' | 'longa' | 'comum' | 'repetitiva' | 'contem_nome' | 'contem_email'

export function problemasDaSenha(
  senha: string,
  dados: { nome?: string; email?: string } = {},
): ProblemaDeSenha[] {
  const problemas: ProblemaDeSenha[] = []
  const tamanho = [...senha].length
  if (tamanho < SENHA_MINIMO) problemas.push('curta')
  if (tamanho > SENHA_MAXIMO) problemas.push('longa')
  const normal = senha.toLowerCase()
  if (COMUNS.has(normal) || COMUNS.has(normal.replace(/[^a-z0-9]/g, ''))) problemas.push('comum')
  if (/^(.)\1+$/.test(senha) || new Set(senha).size <= 2) problemas.push('repetitiva')
  const primeiroNome = dados.nome?.trim().split(/\s+/)[0]?.toLowerCase()
  if (primeiroNome && primeiroNome.length >= 4 && normal.includes(primeiroNome)) {
    problemas.push('contem_nome')
  }
  const usuario = dados.email?.split('@')[0]?.toLowerCase()
  if (usuario && usuario.length >= 4 && normal.includes(usuario)) problemas.push('contem_email')
  return problemas
}

export const MENSAGEM_DO_PROBLEMA: Readonly<Record<ProblemaDeSenha, string>> = {
  curta: `Use pelo menos ${SENHA_MINIMO} caracteres. Uma frase curta funciona bem.`,
  longa: `Use no máximo ${SENHA_MAXIMO} caracteres.`,
  comum: 'Essa senha aparece em listas de senhas vazadas. Escolha outra.',
  repetitiva: 'Evite repetir o mesmo caractere.',
  contem_nome: 'Evite usar o seu nome na senha.',
  contem_email: 'Evite usar o seu e-mail na senha.',
}
