import { randomBytes } from 'node:crypto'
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWTPayload,
} from 'jose'
import { CORES_DO_AVATAR, ICONES_DO_AVATAR } from '@uj/tokens'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashDoNonce } from '../../src/autenticacao/provedores.ts'
import { carregarConfig } from '../../src/config.ts'
import type { Correio } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import { criarComunidade, novoBanco, vincular, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, SENHA_PADRAO, type Pessoa } from '../apoio/pessoas.ts'

/**
 * Entrar com Google e Apple (sem conta: cadastro pendente, ADR 0007), vínculos de provedor e avatar.
 * Os JWKS de verdade são trocados por chaves locais: o token é assinado aqui,
 * e a API confere assinatura, emissor, público, validade e nonce como em produção.
 */

const GOOGLE_IOS = 'ios-123.apps.googleusercontent.com'
const GOOGLE_WEB = 'web-456.apps.googleusercontent.com'
const APPLE_APP = 'com.solerte.unijovem.hml'

const config = carregarConfig(
  envDeTeste({ GOOGLE_CLIENT_IDS: `${GOOGLE_IOS}, ${GOOGLE_WEB}`, APPLE_AUDIENCES: APPLE_APP }),
)
const correio: Correio = { modo: 'arquivo', async enviar() {} }

let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let chaveGoogle: CryptoKey
let chaveApple: CryptoKey
let chaveIntrusa: CryptoKey

beforeAll(async () => {
  const google = await generateKeyPair('RS256')
  const apple = await generateKeyPair('RS256')
  chaveGoogle = google.privateKey
  chaveApple = apple.privateKey
  chaveIntrusa = (await generateKeyPair('RS256')).privateKey
  const jwk = async (k: CryptoKey, kid: string) => ({
    ...(await exportJWK(k)),
    kid,
    alg: 'RS256',
    use: 'sig',
  })
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio,
    fatorDeLimitePorIp: 100,
    chavesDosProvedores: {
      google: createLocalJWKSet({ keys: [await jwk(google.publicKey, 'g1')] }),
      apple: createLocalJWKSet({ keys: [await jwk(apple.publicKey, 'a1')] }),
    },
  })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

const sub = () => randomBytes(10).toString('hex')

async function tokenGoogle(
  dados: JWTPayload & { email?: string; email_verified?: boolean },
  opcoes: { aud?: string; expS?: number; chave?: CryptoKey; iss?: string } = {},
): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  return new SignJWT({ email_verified: true, ...dados })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
    .setIssuer(opcoes.iss ?? 'https://accounts.google.com')
    .setAudience(opcoes.aud ?? GOOGLE_IOS)
    .setSubject(String(dados.sub ?? sub()))
    .setIssuedAt(agora - 60)
    .setExpirationTime(opcoes.expS ?? agora + 600)
    .sign(opcoes.chave ?? chaveGoogle)
}

async function tokenApple(
  dados: JWTPayload & { email?: string; nonceHash: string },
  opcoes: { aud?: string } = {},
): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  const { nonceHash, ...resto } = dados
  return new SignJWT({ email_verified: 'true', nonce: nonceHash, nonce_supported: true, ...resto })
    .setProtectedHeader({ alg: 'RS256', kid: 'a1' })
    .setIssuer('https://appleid.apple.com')
    .setAudience(opcoes.aud ?? APPLE_APP)
    .setSubject(String(dados.sub ?? sub()))
    .setIssuedAt(agora - 60)
    .setExpirationTime(agora + 600)
    .sign(chaveApple)
}

const entrarGoogle = (idToken: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/provedor/google',
    payload: { idToken, plataforma: 'ios', aparelho: 'iPhone' },
  })

const entrarApple = (identityToken: string, nonce: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/provedor/apple',
    payload: { identityToken, nonce, plataforma: 'ios' },
  })

const comSessao = (
  p: Pessoa,
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  corpo?: object,
) => app.inject({ method: metodo, url, headers: p.auth, ...(corpo ? { payload: corpo } : {}) })

async function contas(): Promise<number> {
  return Number((await b.su.query('select count(*) from uj.contas')).rows[0].count)
}

describe('entrar com Google', () => {
  it('não conecta por coincidência de e-mail a uma conta ainda não confirmada', async () => {
    const p = await pessoaComSessao(b, app, config, 'Email Nao Confirmado')
    await b.su.query('update uj.contas set email_verificado_em = null where id = $1', [p.id])
    const r = await entrarGoogle(await tokenGoogle({ email: p.email }))
    expect(r.statusCode).toBe(401)
    expect(
      (await b.su.query('select 1 from uj.contas_provedores where conta_id=$1', [p.id])).rows,
    ).toEqual([])
  })

  it('e-mail verificado igual ao da conta: entra, vincula pelo sub e audita sem o token', async () => {
    const p = await pessoaComSessao(b, app, config, 'Gabi Google')
    const s = sub()
    const idToken = await tokenGoogle({ sub: s, email: p.email.toUpperCase() })
    const r = await entrarGoogle(idToken)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ segundoFator: false })
    expect(typeof r.json().refresh).toBe('string')

    const vinculo = await b.su.query(
      'select conta_id, sub, email_informado from uj.contas_provedores where provedor = $1 and sub = $2',
      ['google', s],
    )
    expect(vinculo.rows).toEqual([{ conta_id: p.id, sub: s, email_informado: p.email }])
    const auditoria = await b.su.query<{ detalhes: Record<string, unknown> }>(
      "select detalhes from uj.auditoria where conta_id = $1 and acao = 'conta.provedor_conectado'",
      [p.id],
    )
    expect(auditoria.rows).toEqual([
      { detalhes: { provedor: 'google', origem: 'email_verificado' } },
    ])
    expect(JSON.stringify(auditoria.rows)).not.toContain(idToken.slice(0, 30))

    // Depois, o vínculo pelo sub basta, mesmo com outro e-mail no token.
    const outra = await entrarGoogle(await tokenGoogle({ sub: s, email: 'trocado@exemplo.test' }))
    expect(outra.statusCode).toBe(200)
  })

  it('recusa aud errado, token vencido, assinatura de outra chave e emissor errado', async () => {
    const p = await pessoaComSessao(b, app, config, 'Recusas Google')
    const agora = Math.floor(Date.now() / 1000)
    for (const token of [
      await tokenGoogle({ email: p.email }, { aud: 'outro-app.apps.googleusercontent.com' }),
      await tokenGoogle({ email: p.email }, { expS: agora - 120 }),
      await tokenGoogle({ email: p.email }, { chave: chaveIntrusa }),
      await tokenGoogle({ email: p.email }, { iss: 'https://evil.example' }),
    ]) {
      const r = await entrarGoogle(token)
      expect(r.statusCode).toBe(401)
      expect(r.json().erro).toBe('token_invalido')
    }
  })

  it('aceita o ID de cliente da web também', async () => {
    const p = await pessoaComSessao(b, app, config, 'Web Google')
    const r = await entrarGoogle(await tokenGoogle({ email: p.email }, { aud: GOOGLE_WEB }))
    expect(r.statusCode).toBe(200)
  })

  it('email_verified falso não casa pelo e-mail', async () => {
    const p = await pessoaComSessao(b, app, config, 'Nao Verificado')
    const r = await entrarGoogle(await tokenGoogle({ email: p.email, email_verified: false }))
    expect(r.statusCode).toBe(401)
    expect(r.json().erro).toBe('conta_nao_encontrada')
    const vinculos = await b.su.query('select 1 from uj.contas_provedores where conta_id = $1', [
      p.id,
    ])
    expect(vinculos.rows).toEqual([])
  })

  it('sem conta: devolve o cadastro pendente (ADR 0007) e nenhuma conta é criada ainda', async () => {
    const antes = await contas()
    const r = await entrarGoogle(
      await tokenGoogle({ email: 'ninguem@exemplo.test', name: 'Ninguém Silva' }),
    )
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      cadastroPendente: true,
      nome: 'Ninguém Silva',
      email: 'ninguem@exemplo.test',
    })
    expect(r.json().tokenDeCadastro).toMatch(/^[\w-]{40,}$/)
    expect(r.json().acesso).toBeUndefined()
    expect(await contas()).toBe(antes)
  })

  it('o mesmo token não serve duas vezes', async () => {
    const p = await pessoaComSessao(b, app, config, 'Reuso Google')
    const token = await tokenGoogle({ email: p.email })
    expect((await entrarGoogle(token)).statusCode).toBe(200)
    const deNovo = await entrarGoogle(token)
    expect(deNovo.statusCode).toBe(401)
    expect(deNovo.json().erro).toBe('token_ja_usado')
  })

  it('quem ligou o 2FA recebe o desafio, como no login por senha', async () => {
    const p = await pessoaComSessao(b, app, config, 'Dois Fatores Google', { doisFatores: true })
    const r = await entrarGoogle(await tokenGoogle({ email: p.email }))
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ segundoFator: true })
    expect(r.json().acesso).toBeUndefined()
  })

  it('o Criador entra sem código e a plataforma recusa até a prova recente', async () => {
    const criador = await pessoaComSessao(b, app, config, 'Criador Google', { criador: true })
    const r = await entrarGoogle(await tokenGoogle({ email: criador.email }))
    expect(r.statusCode).toBe(200)
    expect(r.json().segundoFator).toBe(false)
    const plataforma = await app.inject({
      method: 'GET',
      url: '/api/v1/plataforma/saude',
      headers: { authorization: `Bearer ${r.json().acesso}` },
    })
    expect(plataforma.statusCode).toBe(403)
    expect(plataforma.json().erro).toBe('segundo_fator_necessario')
  })

  it('conta desativada não entra', async () => {
    const p = await pessoaComSessao(b, app, config, 'Desativada Google')
    await b.su.query("update uj.contas set estado = 'desativada' where id = $1", [p.id])
    const r = await entrarGoogle(await tokenGoogle({ email: p.email }))
    expect(r.statusCode).toBe(401)
    expect(r.json().erro).toBe('conta_nao_encontrada')
  })
})

describe('entrar com a Apple', () => {
  it('conta nova com e-mail privado: conclui o cadastro e abre a sessão sem depender de envio de e-mail', async () => {
    const nonce = randomBytes(16).toString('hex')
    const email = `${sub()}@privaterelay.appleid.com`
    const entrada = await app.inject({
      method: 'POST',
      url: '/api/auth/provedor/apple',
      payload: {
        identityToken: await tokenApple({
          email,
          is_private_email: 'true',
          nonceHash: hashDoNonce(nonce),
        }),
        nonce,
        plataforma: 'ios',
      },
    })
    expect(entrada.statusCode).toBe(200)
    expect(entrada.json().cadastroPendente).toBe(true)
    const fim = await app.inject({
      method: 'POST',
      url: '/api/auth/provedor/concluir-cadastro',
      payload: {
        tokenDeCadastro: entrada.json().tokenDeCadastro,
        faixaEtaria: '18_mais',
        aceites: { termos: true },
      },
    })
    expect(fim.statusCode).toBe(200)
    const eu = await app.inject({
      method: 'GET',
      url: '/api/v1/eu',
      headers: { authorization: `Bearer ${fim.json().acesso}` },
    })
    expect(eu.statusCode).toBe(200)
    expect(eu.json().conta.email).toBe(email)
    expect(eu.json().conta.nome).toBe('Participante')
  })

  it('nonce certo entra; nonce errado ou ausente é recusado', async () => {
    const p = await pessoaComSessao(b, app, config, 'Ana Apple')
    const nonce = randomBytes(16).toString('hex')
    const errado = await entrarApple(
      await tokenApple({ email: p.email, nonceHash: hashDoNonce(nonce) }),
      `${nonce}x`,
    )
    expect(errado.statusCode).toBe(401)
    expect(errado.json().erro).toBe('token_invalido')
    // Nonce cru no token (sem o hash) também não vale.
    const semHash = await entrarApple(await tokenApple({ email: p.email, nonceHash: nonce }), nonce)
    expect(semHash.statusCode).toBe(401)

    const ok = await entrarApple(
      await tokenApple({ email: p.email, nonceHash: hashDoNonce(nonce) }),
      nonce,
    )
    expect(ok.statusCode).toBe(200)
    expect(ok.json().segundoFator).toBe(false)
  })

  it('aud de outro app (produção num servidor de homologação) é recusado', async () => {
    const p = await pessoaComSessao(b, app, config, 'Apple Outro App')
    const nonce = randomBytes(16).toString('hex')
    const r = await entrarApple(
      await tokenApple(
        { email: p.email, nonceHash: hashDoNonce(nonce) },
        { aud: 'com.solerte.unijovem' },
      ),
      nonce,
    )
    expect(r.statusCode).toBe(401)
  })

  it('e-mail de retransmissão privada não casa; só o vínculo prévio pelo sub', async () => {
    const p = await pessoaComSessao(b, app, config, 'Privada Apple')
    // Mesmo que a conta tivesse esse endereço, o relay nunca casa por e-mail.
    const relay = `${sub()}@privaterelay.appleid.com`
    await b.su.query('update uj.contas set email = $2 where id = $1', [p.id, relay])
    const s = sub()
    const nonce = randomBytes(16).toString('hex')
    const semVinculo = await entrarApple(
      await tokenApple({
        sub: s,
        email: relay,
        is_private_email: 'true',
        nonceHash: hashDoNonce(nonce),
      }),
      nonce,
    )
    expect(semVinculo.statusCode).toBe(401)
    expect(semVinculo.json().erro).toBe('conta_nao_encontrada')

    await b.su.query(
      "insert into uj.contas_provedores (conta_id, provedor, sub) values ($1, 'apple', $2)",
      [p.id, s],
    )
    const nonce2 = randomBytes(16).toString('hex')
    const comVinculo = await entrarApple(
      await tokenApple({
        sub: s,
        email: relay,
        is_private_email: 'true',
        nonceHash: hashDoNonce(nonce2),
      }),
      nonce2,
    )
    expect(comVinculo.statusCode).toBe(200)
  })
})

describe('contas conectadas (logado)', () => {
  it('conectar exige a senha; listar; desconectar fecha também a entrada pelo e-mail', async () => {
    const p = await pessoaComSessao(b, app, config, 'Conecta Google')
    const s = sub()
    const semSenha = await comSessao(p, 'POST', '/api/v1/eu/provedores/google', {
      idToken: await tokenGoogle({ sub: s, email: 'outro.endereco@gmail.test' }),
      senhaAtual: 'senha errada aqui',
    })
    expect(semSenha.statusCode).toBe(401)
    expect(semSenha.json().erro).toBe('senha_incorreta')

    const ok = await comSessao(p, 'POST', '/api/v1/eu/provedores/google', {
      idToken: await tokenGoogle({ sub: s, email: 'outro.endereco@gmail.test' }),
      senhaAtual: SENHA_PADRAO,
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ provedor: 'google', email: 'outro.endereco@gmail.test' })

    const lista = await comSessao(p, 'GET', '/api/v1/eu/provedores')
    expect(lista.json()).toMatchObject({
      provedores: [{ provedor: 'google', email: 'outro.endereco@gmail.test' }],
      disponiveis: ['google', 'apple'],
    })

    // O vínculo pelo sub funciona mesmo com e-mail diferente do da conta.
    expect((await entrarGoogle(await tokenGoogle({ sub: s }))).statusCode).toBe(200)

    expect((await comSessao(p, 'DELETE', '/api/v1/eu/provedores/google')).statusCode).toBe(200)
    expect((await comSessao(p, 'DELETE', '/api/v1/eu/provedores/google')).statusCode).toBe(404)
    expect((await comSessao(p, 'GET', '/api/v1/eu/provedores')).json().provedores).toEqual([])

    // Desconectado: nem o sub nem o e-mail igual abrem a conta.
    expect((await entrarGoogle(await tokenGoogle({ sub: s }))).statusCode).toBe(401)
    expect((await entrarGoogle(await tokenGoogle({ email: p.email }))).statusCode).toBe(401)

    const acoes = await b.su.query<{ acao: string; detalhes: Record<string, unknown> }>(
      `select acao, detalhes from uj.auditoria
        where conta_id = $1 and acao like 'conta.provedor_%' order by id`,
      [p.id],
    )
    expect(acoes.rows).toEqual([
      {
        acao: 'conta.provedor_conectado',
        detalhes: { provedor: 'google', origem: 'tela_de_seguranca' },
      },
      { acao: 'conta.provedor_desconectado', detalhes: { provedor: 'google' } },
    ])
  })

  it('conta do provedor já ligada a outra pessoa: 409, sem mexer no vínculo dela', async () => {
    const dona = await pessoaComSessao(b, app, config, 'Dona Do Google')
    const outra = await pessoaComSessao(b, app, config, 'Outra Pessoa')
    const s = sub()
    await b.su.query(
      "insert into uj.contas_provedores (conta_id, provedor, sub) values ($1, 'google', $2)",
      [dona.id, s],
    )
    const r = await comSessao(outra, 'POST', '/api/v1/eu/provedores/google', {
      idToken: await tokenGoogle({ sub: s }),
      senhaAtual: SENHA_PADRAO,
    })
    expect(r.statusCode).toBe(409)
    const linha = await b.su.query('select conta_id from uj.contas_provedores where sub = $1', [s])
    expect(linha.rows).toEqual([{ conta_id: dona.id }])
  })

  it('provedor desconhecido no caminho: 404; sem sessão: 401', async () => {
    const p = await pessoaComSessao(b, app, config, 'Caminho Errado')
    expect((await comSessao(p, 'DELETE', '/api/v1/eu/provedores/facebook')).statusCode).toBe(404)
    const anonimo = await app.inject({ method: 'GET', url: '/api/v1/eu/provedores' })
    expect(anonimo.statusCode).toBe(401)
  })

  it('o papel do app (uj_api) não lê os vínculos de provedor', async () => {
    const r = await b
      .comoApi({ contaId: null }, 'select count(*) from uj.contas_provedores')
      .catch((e: Error) => e.message)
    expect(r).toMatch(/permission denied/)
  })

  it('excluir a conta apaga os vínculos de provedor e o avatar', async () => {
    const p = await pessoaComSessao(b, app, config, 'Sai Com Google')
    await b.su.query(
      "insert into uj.contas_provedores (conta_id, provedor, sub, email_informado) values ($1, 'google', $2, 'x@gmail.test')",
      [p.id, sub()],
    )
    await comSessao(p, 'PUT', '/api/v1/eu/avatar', { icone: 'sol', cor: 'aurora' })
    const r = await comSessao(p, 'POST', '/api/v1/eu/excluir-conta', { senha: SENHA_PADRAO })
    expect(r.statusCode).toBe(200)
    await app.emAndamento()
    const resto = await b.su.query(
      `select (select count(*) from uj.contas_provedores where conta_id = $1)::int as vinculos,
              a.avatar_icone, a.avatar_cor from uj.contas a where a.id = $1`,
      [p.id],
    )
    expect(resto.rows).toEqual([{ vinculos: 0, avatar_icone: null, avatar_cor: null }])
  })

  it('a exportação dos meus dados traz as contas conectadas e o avatar, sem o sub', async () => {
    const p = await pessoaComSessao(b, app, config, 'Exporta Google')
    const s = sub()
    await comSessao(p, 'POST', '/api/v1/eu/provedores/google', {
      idToken: await tokenGoogle({ sub: s, email: 'exporta@gmail.test' }),
      senhaAtual: SENHA_PADRAO,
    })
    await comSessao(p, 'PUT', '/api/v1/eu/avatar', { icone: 'lua', cor: 'noite' })
    const r = await comSessao(p, 'GET', '/api/v1/eu/exportar')
    expect(r.statusCode).toBe(200)
    expect(r.json().contasConectadas).toEqual([
      expect.objectContaining({ provedor: 'google', email: 'exporta@gmail.test' }),
    ])
    expect(r.json().conta.avatar).toEqual({ icone: 'lua', cor: 'noite' })
    expect(r.body).not.toContain(s)
  })
})

describe('avatar', () => {
  it('grava, aparece em /eu e para os membros da comunidade; limpa com null', async () => {
    const com = await criarComunidade(b, 'Comunidade do Avatar')
    const ana = await pessoaComSessao(b, app, config, 'Ana Avatar')
    const bia = await pessoaComSessao(b, app, config, 'Bia Avatar')
    await vincular(b, ana.id, com, 'membro')
    await vincular(b, bia.id, com, 'membro')

    const r = await comSessao(ana, 'PUT', '/api/v1/eu/avatar', { icone: 'chama', cor: 'violeta' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ avatar: { icone: 'chama', cor: 'violeta' } })
    expect((await comSessao(ana, 'GET', '/api/v1/eu')).json().conta.avatar).toEqual({
      icone: 'chama',
      cor: 'violeta',
    })
    const membros = (await comSessao(bia, 'GET', `/api/v1/c/${com}/membros`)).json().membros as {
      contaId: string
      avatar: unknown
    }[]
    expect(membros.find((m) => m.contaId === ana.id)?.avatar).toEqual({
      icone: 'chama',
      cor: 'violeta',
    })
    expect(membros.find((m) => m.contaId === bia.id)?.avatar).toBeNull()

    const limpa = await comSessao(ana, 'PUT', '/api/v1/eu/avatar', { icone: null, cor: null })
    expect(limpa.statusCode).toBe(200)
    expect((await comSessao(ana, 'GET', '/api/v1/eu')).json().conta.avatar).toBeNull()
  })

  it('ícone ou cor fora da lista é recusado (na API e no banco)', async () => {
    const p = await pessoaComSessao(b, app, config, 'Avatar Ruim')
    for (const corpo of [
      { icone: 'caveira', cor: 'aurora' },
      { icone: 'sol', cor: '#FF0000' },
      { icone: 'sol', cor: null },
      { icone: 'toString', cor: 'aurora' },
    ]) {
      const r = await comSessao(p, 'PUT', '/api/v1/eu/avatar', corpo)
      expect(r.statusCode, JSON.stringify(corpo)).toBe(400)
    }
    const direto = await b
      .comoApi(
        { contaId: p.id },
        "update uj.contas set avatar_icone = 'caveira', avatar_cor = 'aurora' where id = $1",
        [p.id],
      )
      .catch((e: Error) => e.message)
    expect(direto).toMatch(/check constraint/)
    const metade = await b
      .comoApi({ contaId: p.id }, "update uj.contas set avatar_icone = 'sol' where id = $1", [p.id])
      .catch((e: Error) => e.message)
    expect(metade).toMatch(/contas_avatar_completo/)
  })

  it('as listas do banco são as mesmas de packages/tokens', async () => {
    const p = await pessoaComSessao(b, app, config, 'Todas As Cores')
    for (const icone of ICONES_DO_AVATAR) {
      const r = await comSessao(p, 'PUT', '/api/v1/eu/avatar', { icone, cor: 'aurora' })
      expect(r.statusCode, icone).toBe(200)
    }
    for (const cor of Object.keys(CORES_DO_AVATAR)) {
      const r = await comSessao(p, 'PUT', '/api/v1/eu/avatar', { icone: 'sol', cor })
      expect(r.statusCode, cor).toBe(200)
    }
    // E nada a mais no banco do que nos tokens (a contagem de valores do CHECK).
    const { rows } = await b.su.query<{ def: string }>(
      `select pg_get_constraintdef(c.oid) as def from pg_constraint c
        where c.conrelid = 'uj.contas'::regclass and pg_get_constraintdef(c.oid) like '%avatar_%ANY%'`,
    )
    const valores = rows.flatMap((r) => [...r.def.matchAll(/'([a-z]+)'::text/g)].map((m) => m[1]))
    expect(new Set(valores)).toEqual(
      new Set([...ICONES_DO_AVATAR, ...Object.keys(CORES_DO_AVATAR)]),
    )
  })

  it('outra conta não muda o avatar de ninguém além de si', async () => {
    const a = await pessoaComSessao(b, app, config, 'Avatar Alheio A')
    const c = await pessoaComSessao(b, app, config, 'Avatar Alheio C')
    const n = await b.comoApi<{ id: string }>(
      { contaId: a.id },
      "update uj.contas set avatar_icone = 'sol', avatar_cor = 'aurora' where id = $1 returning id",
      [c.id],
    )
    expect(n).toEqual([])
  })
})
