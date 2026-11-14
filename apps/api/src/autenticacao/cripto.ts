import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto'
import { hash, verify, type Algorithm } from '@node-rs/argon2'

/**
 * Primitivas de criptografia da autenticação. Nada aqui guarda estado nem lê
 * configuração: chaves entram por parâmetro, para serem testáveis e para que
 * ninguém pegue "a chave global" por engano.
 */

// ------------------------------------------------------------ senhas (argon2id)

/** Parâmetros mínimos recomendados pela OWASP para argon2id (19 MiB, t=2, p=1). */
// `Algorithm` é const enum (não importável com verbatimModuleSyntax): 2 = Argon2id.
const ARGON2ID = 2 as Algorithm
const ARGON2 = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 }

export async function hashDeSenha(senha: string): Promise<string> {
  return hash(senha, ARGON2)
}

export async function senhaConfere(senhaHash: string, senha: string): Promise<boolean> {
  try {
    return await verify(senhaHash, senha)
  } catch {
    return false
  }
}

/**
 * Hash de uma senha qualquer, para gastar o mesmo tempo quando a conta não
 * existe: sem isso, o tempo de resposta do login revelaria quem tem conta.
 */
let hashFicticio: Promise<string> | undefined
export async function gastarTempoDeVerificacao(senha: string): Promise<void> {
  hashFicticio ??= hashDeSenha(randomBytes(16).toString('hex'))
  await senhaConfere(await hashFicticio, senha)
}

// ------------------------------------------------------------ tokens opacos

/** Token aleatório de 256 bits em base64url (vai em link ou cookie). */
export function gerarToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** O que o banco guarda de um token de alta entropia: só o SHA-256. */
export function hashDeToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

/**
 * HMAC com segredo do servidor. Usado no convite: mesmo quem ler o banco não
 * consegue forjar um token que bata, sem o segredo que fica fora do banco.
 */
export function hmacDeToken(token: string, segredo: string): Buffer {
  return createHmac('sha256', segredo).update(token, 'utf8').digest()
}

export function iguais(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

// ------------------------------------------------------------ código de 6 dígitos

export function gerarCodigoNumerico(digitos = 6): string {
  return randomInt(0, 10 ** digitos)
    .toString()
    .padStart(digitos, '0')
}

/**
 * Código curto tem pouca entropia: o hash leva um "sal" (o id da verificação)
 * e o servidor limita tentativas. Não é segredo forte; é prova de posse do e-mail.
 */
export function hashDeCodigo(codigo: string, sal: string): Buffer {
  return createHash('sha256').update(`${sal}:${codigo}`, 'utf8').digest()
}

// ------------------------------------------------------------ cifragem em repouso

const VERSAO_CIFRA = 1

/**
 * AES-256-GCM. Formato: [versão 1 byte][iv 12][tag 16][texto cifrado].
 * `contexto` entra como dado autenticado: um texto cifrado para "totp" não
 * decifra como "oracao", então trocar colunas de lugar não funciona.
 */
export function cifrar(chave: Buffer, texto: string, contexto: string): Buffer {
  if (chave.length !== 32) throw new Error('chave de cifragem precisa de 32 bytes')
  const iv = randomBytes(12)
  const cifra = createCipheriv('aes-256-gcm', chave, iv)
  cifra.setAAD(Buffer.from(contexto, 'utf8'))
  const corpo = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()])
  return Buffer.concat([Buffer.from([VERSAO_CIFRA]), iv, cifra.getAuthTag(), corpo])
}

export function decifrar(chave: Buffer, dado: Buffer, contexto: string): string {
  if (dado[0] !== VERSAO_CIFRA) throw new Error('versão de cifra desconhecida')
  const iv = dado.subarray(1, 13)
  const tag = dado.subarray(13, 29)
  const corpo = dado.subarray(29)
  const decifra = createDecipheriv('aes-256-gcm', chave, iv)
  decifra.setAAD(Buffer.from(contexto, 'utf8'))
  decifra.setAuthTag(tag)
  return Buffer.concat([decifra.update(corpo), decifra.final()]).toString('utf8')
}
