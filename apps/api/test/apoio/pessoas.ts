import { randomBytes } from 'node:crypto'
import { cifrar, hashDeSenha } from '../../src/autenticacao/cripto.ts'
import { codigoTotp, contadorAtual, gerarSegredoTotp } from '../../src/autenticacao/totp.ts'
import type { Config } from '../../src/config.ts'
import type { criarServidor } from '../../src/servidor.ts'
import type { BancoDeTeste } from './banco.ts'

export const SENHA_PADRAO = 'senha comprida de teste 2026'
let hashPadrao: Promise<string> | undefined

export interface Pessoa {
  id: string
  email: string
  acesso: string
  auth: { authorization: string }
}

/**
 * Conta com senha, já autenticada pela API de verdade. Com `criador`, a conta
 * é a proprietária, tem 2FA, e o token traz a prova de plataforma.
 */
export async function pessoaComSessao(
  b: BancoDeTeste,
  app: ReturnType<typeof criarServidor>,
  config: Config,
  nome: string,
  opcoes: { criador?: boolean; doisFatores?: boolean } = {},
): Promise<Pessoa> {
  hashPadrao ??= hashDeSenha(SENHA_PADRAO)
  const email = `${nome.toLowerCase().replace(/\W+/g, '.')}.${randomBytes(3).toString('hex')}@exemplo.test`
  const { rows } = await b.su.query<{ id: string }>(
    `insert into uj.contas (nome, email, email_verificado_em, senha_hash, plataforma_proprietario)
     values ($1, $2, now(), $3, false) returning id`,
    [nome, email, await hashPadrao],
  )
  const id = rows[0]!.id
  let segredo: string | null = null
  if (opcoes.criador || opcoes.doisFatores) {
    segredo = gerarSegredoTotp()
    await b.su.query(
      `update uj.contas set totp_segredo_cifrado = $2, totp_ativado_em = now(),
              plataforma_proprietario = $3 where id = $1`,
      [
        id,
        cifrar(Buffer.from(config.TOTP_CHAVE, 'base64'), segredo, `totp:${id}`),
        opcoes.criador === true,
      ],
    )
  }
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/entrar',
    payload: { email, senha: SENHA_PADRAO, plataforma: 'ios' },
  })
  let acesso = login.json().acesso as string | undefined
  if (segredo) {
    const sf = await app.inject({
      method: 'POST',
      url: '/api/auth/segundo-fator',
      payload: { desafio: login.json().desafio, codigo: codigoTotp(segredo, contadorAtual()) },
    })
    acesso = sf.json().acesso as string
  }
  if (!acesso) throw new Error(`falha ao autenticar ${nome}: ${login.body}`)
  return { id, email, acesso, auth: { authorization: `Bearer ${acesso}` } }
}
