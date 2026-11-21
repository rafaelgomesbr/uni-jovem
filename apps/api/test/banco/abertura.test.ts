import { randomBytes } from 'node:crypto'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LIMITES_DA_COMUNIDADE_NOVA, LIMITES_DE_CRIACAO, LIMITES_DE_PEDIDOS } from '@uj/dominio'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado, type Correio, type Mensagem } from '../../src/correio/correio.ts'
import { criarServidor } from '../../src/servidor.ts'
import {
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'
import { pessoaComSessao, SENHA_PADRAO, type Pessoa } from '../apoio/pessoas.ts'

/**
 * App aberto (ADR 0007): cadastro por e-mail e por Google/Apple, criação de
 * comunidade com limites, rodinhas no banco, código e entrada nos três modos,
 * busca, pedidos de entrada, verificação pela Plataforma, código do
 * autenticador só onde destrói, auditoria sem conteúdo, denúncia de
 * comunidade, comunidade órfã, TC-16 depois da criação e retenção.
 */

const GOOGLE = 'ios-123.apps.googleusercontent.com'
const config = carregarConfig(envDeTeste({ GOOGLE_CLIENT_IDS: GOOGLE }))
const caixa: Mensagem[] = []
const correio: Correio = {
  modo: 'arquivo',
  async enviar(m) {
    caixa.push(m)
  },
}

let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let chaveGoogle: CryptoKey
let criador: Pessoa

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
const req = (metodo: Metodo, url: string, p: Pessoa | null, corpo?: object) =>
  app.inject({
    method: metodo,
    url,
    ...(p ? { headers: p.auth } : {}),
    ...(corpo ? { payload: corpo } : {}),
  })

beforeAll(async () => {
  const google = await generateKeyPair('RS256')
  chaveGoogle = google.privateKey
  b = await novoBanco()
  app = criarServidor(config, {
    api: b.api,
    auth: b.auth,
    correio,
    fatorDeLimitePorIp: 100,
    chavesDosProvedores: {
      google: createLocalJWKSet({
        keys: [{ ...(await exportJWK(google.publicKey)), kid: 'g1', alg: 'RS256', use: 'sig' }],
      }),
      apple: createLocalJWKSet({ keys: [] }),
    },
  })
  await app.ready()
  criador = await pessoaComSessao(b, app, config, 'Criador', { criador: true })
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

/** Pessoa adulta (18 ou mais), com e-mail confirmado e sessão. */
async function adulta(nome: string): Promise<Pessoa> {
  const p = await pessoaComSessao(b, app, config, nome)
  await b.su.query("update uj.contas set faixa_etaria = '18_mais' where id = $1", [p.id])
  return p
}

/** O Criador logado sem a prova de 2FA (o login dele não pede o código: D31). */
async function criadorSemProva(): Promise<Pessoa> {
  const email = (
    await b.su.query<{ email: string }>('select email from uj.contas where id = $1', [criador.id])
  ).rows[0]!.email
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/entrar',
    payload: { email, senha: SENHA_PADRAO, plataforma: 'ios' },
  })
  const acesso = login.json().acesso as string
  return { ...criador, acesso, auth: { authorization: `Bearer ${acesso}` } }
}

const CORPO_DA_COMUNIDADE = {
  cor: '#5B4BDB',
  aceiteDoTermoDoAdmin: true,
  consentimentoFe: true,
}

async function criarAberta(p: Pessoa, nome: string, extra: object = {}) {
  return req('POST', '/api/v1/comunidades', p, { nome, ...CORPO_DA_COMUNIDADE, ...extra })
}

/** Corpo mínimo de quem entra numa comunidade (TC-03). */
const ENTRADA = { consentimentoFe: true, faixaEtaria: '18_mais' }

function codigoDoUltimoEmail(): string {
  const m = /código de verificação é (\d{6})/.exec(caixa.at(-1)!.corpo)
  if (!m) throw new Error('e-mail sem código')
  return m[1]!
}

async function tokenGoogle(dados: Record<string, unknown>): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  return new SignJWT({ email_verified: true, ...dados })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
    .setIssuer('https://accounts.google.com')
    .setAudience(GOOGLE)
    .setSubject(String(dados['sub'] ?? randomBytes(8).toString('hex')))
    .setIssuedAt(agora - 30)
    .setExpirationTime(agora + 600)
    .sign(chaveGoogle)
}

// ================================================================ cadastro por e-mail

describe('cadastro por e-mail', () => {
  it('cria a conta sem vínculo, com e-mail verificado, idade e termos registrados', async () => {
    const email = `nova.${randomBytes(3).toString('hex')}@exemplo.test`
    const ini = await req('POST', '/api/auth/cadastro/iniciar', null, {
      nome: 'Nova Pessoa',
      email,
      faixaEtaria: '18_mais',
      aceites: { termos: true },
    })
    expect(ini.statusCode).toBe(200)
    expect(caixa.at(-1)!.para).toBe(email)
    expect(caixa.at(-1)!.assunto).not.toMatch(/\d{6}/)
    const r = await req('POST', '/api/auth/cadastro/concluir', null, {
      email,
      codigo: codigoDoUltimoEmail(),
      senha: 'uma senha comprida e boa 2026',
      plataforma: 'android',
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ segundoFator: false })
    expect(r.json().acesso).toBeTruthy()
    expect(r.json().refresh).toBeTruthy()
    const conta = (
      await b.su.query(
        `select a.id, a.email_verificado_em is not null as verificado, a.faixa_etaria,
                (select count(*)::int from uj.vinculos v where v.conta_id = a.id) as vinculos,
                (select array_agg(texto_id || '.v' || versao order by texto_id)
                   from uj.consentimentos c where c.conta_id = a.id) as aceites
           from uj.contas a where a.email = $1`,
        [email],
      )
    ).rows[0]
    expect(conta).toMatchObject({
      verificado: true,
      faixa_etaria: '18_mais',
      vinculos: 0,
      aceites: ['TC-01.v2', 'TC-02.v2'],
    })
    const eu = await app.inject({
      method: 'GET',
      url: '/api/v1/eu',
      headers: { authorization: `Bearer ${r.json().acesso}` },
    })
    expect(eu.json().comunidades).toEqual([])
    // Auditoria da conta nova sem o e-mail.
    const aud = await b.su.query(
      "select detalhes::text as d from uj.auditoria where conta_id = $1 and acao = 'conta.criada'",
      [conta.id],
    )
    expect(aud.rows).toHaveLength(1)
    expect(aud.rows[0].d).not.toContain(email)
  })

  it('e-mail já cadastrado: mesma resposta no início; no fim, a mensagem para entrar', async () => {
    const existente = await pessoaComSessao(b, app, config, 'Ja Existe')
    const corpo = { nome: 'Outro Nome', faixaEtaria: '18_mais', aceites: { termos: true } }
    const nova = await req('POST', '/api/auth/cadastro/iniciar', null, {
      ...corpo,
      email: `livre.${randomBytes(3).toString('hex')}@exemplo.test`,
    })
    const ja = await req('POST', '/api/auth/cadastro/iniciar', null, {
      ...corpo,
      email: existente.email,
    })
    expect(ja.statusCode).toBe(nova.statusCode)
    expect(ja.json()).toEqual(nova.json())
    const r = await req('POST', '/api/auth/cadastro/concluir', null, {
      email: existente.email,
      codigo: codigoDoUltimoEmail(),
      senha: 'uma senha comprida e boa 2026',
    })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toBe('conta_existente')
    expect(r.json().mensagem).toMatch(/Esqueci a senha/)
  })

  it('código errado conta tentativa; depois de 5, vence; código vencido também', async () => {
    const email = `tentativas.${randomBytes(3).toString('hex')}@exemplo.test`
    await req('POST', '/api/auth/cadastro/iniciar', null, {
      nome: 'Tentativas',
      email,
      faixaEtaria: '18_mais',
      aceites: { termos: true },
    })
    const certo = codigoDoUltimoEmail()
    const errado = certo === '000000' ? '111111' : '000000'
    const concluir = (codigo: string) =>
      req('POST', '/api/auth/cadastro/concluir', null, {
        email,
        codigo,
        senha: 'uma senha comprida e boa 2026',
      })
    for (let i = 0; i < 5; i++) expect((await concluir(errado)).statusCode).toBe(422)
    const depois = await concluir(certo)
    expect(depois.statusCode).toBe(410)
    // Pedido novo: código novo; vencido no relógio também é 410.
    await req('POST', '/api/auth/cadastro/iniciar', null, {
      nome: 'Tentativas',
      email,
      faixaEtaria: '18_mais',
      aceites: { termos: true },
    })
    const novo = codigoDoUltimoEmail()
    await b.su.query(
      "update uj.verificacoes_email set expira_em = now() - interval '1 minute' where email = $1",
      [email],
    )
    expect((await concluir(novo)).statusCode).toBe(410)
  })

  it('menos de 16 anos: recusado sem gravar nada; 16 e 17 exigem o responsável', async () => {
    const email = `crianca.${randomBytes(3).toString('hex')}@exemplo.test`
    const antes = caixa.length
    const r = await req('POST', '/api/auth/cadastro/iniciar', null, {
      nome: 'Criança',
      email,
      faixaEtaria: 'menos_16',
      aceites: { termos: true },
    })
    expect(r.statusCode).toBe(422)
    expect(r.json().erro).toBe('menor_de_16')
    expect(r.json().mensagem).not.toMatch(/convite/i)
    expect(caixa.length).toBe(antes)
    const gravado = await b.su.query('select 1 from uj.verificacoes_email where email = $1', [
      email,
    ])
    expect(gravado.rows).toEqual([])
    const jovem = await req('POST', '/api/auth/cadastro/iniciar', null, {
      nome: 'Jovem',
      email,
      faixaEtaria: '16_17',
      aceites: { termos: true },
    })
    expect(jovem.statusCode).toBe(422)
    expect(jovem.json().erro).toBe('responsavel_necessario')
    const semTermos = await req('POST', '/api/auth/cadastro/iniciar', null, {
      nome: 'Jovem',
      email,
      faixaEtaria: '18_mais',
      aceites: { termos: false },
    })
    expect(semTermos.statusCode).toBe(400)
  })

  it('com o e-mail desligado, 503 com a saída por Google ou Apple', async () => {
    const outro = criarServidor(config, {
      api: b.api,
      auth: b.auth,
      correio: correioDesligado(),
      fatorDeLimitePorIp: 100,
    })
    await outro.ready()
    const r = await outro.inject({
      method: 'POST',
      url: '/api/auth/cadastro/iniciar',
      payload: {
        nome: 'Sem e-mail',
        email: 'sem.email@exemplo.test',
        faixaEtaria: '18_mais',
        aceites: { termos: true },
      },
    })
    await outro.close()
    expect(r.statusCode).toBe(503)
    expect(r.json().mensagem).toBe(
      'O cadastro por e-mail está indisponível agora. Use Google ou Apple.',
    )
  })

  it('na web, com Turnstile configurado, sem o desafio é recusado', async () => {
    const comTurnstile = criarServidor(
      carregarConfig(envDeTeste({ TURNSTILE_SEGREDO: 'segredo-de-teste' })),
      { api: b.api, auth: b.auth, correio, fatorDeLimitePorIp: 100 },
    )
    await comTurnstile.ready()
    const r = await comTurnstile.inject({
      method: 'POST',
      url: '/api/auth/cadastro/iniciar',
      payload: {
        nome: 'Robô',
        email: 'robo@exemplo.test',
        faixaEtaria: '18_mais',
        aceites: { termos: true },
        plataforma: 'web',
      },
    })
    await comTurnstile.close()
    expect(r.statusCode).toBe(403)
    expect(r.json().erro).toBe('verificacao_humana')
  })

  it('limite por e-mail no início do cadastro', async () => {
    const email = `limite.${randomBytes(3).toString('hex')}@exemplo.test`
    const corpo = { nome: 'Limite', email, faixaEtaria: '18_mais', aceites: { termos: true } }
    for (let i = 0; i < 5; i++) {
      expect((await req('POST', '/api/auth/cadastro/iniciar', null, corpo)).statusCode).toBe(200)
    }
    expect((await req('POST', '/api/auth/cadastro/iniciar', null, corpo)).statusCode).toBe(429)
  })
})

// ================================================================ cadastro por Google

describe('cadastro por Google', () => {
  const entrar = async (dados: Record<string, unknown>) =>
    req('POST', '/api/auth/provedor/google', null, {
      idToken: await tokenGoogle(dados),
      plataforma: 'ios',
      aparelho: 'iPhone',
    })

  it('sem conta: cadastro pendente; concluir cria a conta com o vínculo do provedor', async () => {
    const sub = randomBytes(8).toString('hex')
    const email = `google.${sub}@exemplo.test`
    const p = await entrar({ sub, email, name: 'Gabi Google' })
    expect(p.json()).toMatchObject({ cadastroPendente: true, nome: 'Gabi Google', email })
    const token = p.json().tokenDeCadastro as string
    // Guardado só como hash.
    const guardado = await b.su.query(
      'select encode(token_hash, $2) as h from uj.cadastros_por_provedor where email = $1',
      [email, 'hex'],
    )
    expect(guardado.rows[0].h).not.toContain(token)
    const r = await req('POST', '/api/auth/provedor/concluir-cadastro', null, {
      tokenDeCadastro: token,
      faixaEtaria: '18_mais',
      aceites: { termos: true },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().acesso).toBeTruthy()
    const conta = (
      await b.su.query(
        `select a.nome, a.senha_hash is null as sem_senha, a.email_verificado_em is not null as verificado,
                (select provedor from uj.contas_provedores where conta_id = a.id) as provedor
           from uj.contas a where a.email = $1`,
        [email],
      )
    ).rows[0]
    expect(conta).toEqual({
      nome: 'Gabi Google',
      sem_senha: true,
      verificado: true,
      provedor: 'google',
    })
    // Reusar o token: 410. Entrar de novo pelo Google: entra direto.
    const reuso = await req('POST', '/api/auth/provedor/concluir-cadastro', null, {
      tokenDeCadastro: token,
      faixaEtaria: '18_mais',
      aceites: { termos: true },
    })
    expect(reuso.statusCode).toBe(410)
    const deNovo = await entrar({ sub, email })
    expect(deNovo.statusCode).toBe(200)
    expect(deNovo.json().segundoFator).toBe(false)
    expect(deNovo.json().acesso).toBeTruthy()
  })

  it('token vencido: 410; menos de 16: 422 sem gravar nada nem gastar o token', async () => {
    const sub = randomBytes(8).toString('hex')
    const email = `menor.${sub}@exemplo.test`
    const token = (await entrar({ sub, email })).json().tokenDeCadastro as string
    const menor = await req('POST', '/api/auth/provedor/concluir-cadastro', null, {
      tokenDeCadastro: token,
      faixaEtaria: 'menos_16',
      aceites: { termos: true },
    })
    expect(menor.statusCode).toBe(422)
    expect(menor.json().erro).toBe('menor_de_16')
    expect((await b.su.query('select 1 from uj.contas where email = $1', [email])).rows).toEqual([])
    const naoUsado = await b.su.query(
      'select usado_em from uj.cadastros_por_provedor where email = $1',
      [email],
    )
    expect(naoUsado.rows[0].usado_em).toBeNull()
    await b.su.query(
      `update uj.cadastros_por_provedor
          set criado_em = now() - interval '20 minutes', expira_em = now() - interval '5 minutes'
        where email = $1`,
      [email],
    )
    const vencido = await req('POST', '/api/auth/provedor/concluir-cadastro', null, {
      tokenDeCadastro: token,
      faixaEtaria: '18_mais',
      aceites: { termos: true },
    })
    expect(vencido.statusCode).toBe(410)
    expect(vencido.json().erro).toBe('token_de_cadastro_invalido')
  })

  it('conta só do Google exclui a conta com um token novo do Google (sem senha)', async () => {
    const sub = randomBytes(8).toString('hex')
    const email = `excluir.${sub}@exemplo.test`
    const token = (await entrar({ sub, email })).json().tokenDeCadastro as string
    const sessao = await req('POST', '/api/auth/provedor/concluir-cadastro', null, {
      tokenDeCadastro: token,
      faixaEtaria: '18_mais',
      aceites: { termos: true },
    })
    const p: Pessoa = {
      id: '',
      email,
      acesso: sessao.json().acesso,
      auth: { authorization: `Bearer ${sessao.json().acesso}` },
    }
    // Token de OUTRA conta do Google: recusado.
    const alheio = await req('POST', '/api/v1/eu/excluir-conta', p, {
      provedor: 'google',
      idToken: await tokenGoogle({ sub: 'outra-pessoa', email: 'outra@exemplo.test' }),
    })
    expect(alheio.statusCode).toBe(401)
    expect(alheio.json().erro).toBe('reautenticacao_invalida')
    const ok = await req('POST', '/api/v1/eu/excluir-conta', p, {
      provedor: 'google',
      idToken: await tokenGoogle({ sub, email }),
    })
    expect(ok.statusCode).toBe(200)
    const conta = await b.su.query(
      'select estado from uj.contas where id = (select conta_id from uj.contas_provedores where sub = $1) or email = $2',
      [sub, email],
    )
    expect(conta.rows).toEqual([])
  })
})

// ================================================================ criar comunidade

describe('criar comunidade (livre com limites)', () => {
  it('cria nova, com código, admin, TC-16 e TC-03 registrados e auditoria', async () => {
    const ana = await adulta('Ana Criadora')
    const r = await criarAberta(ana, 'Jovens da Ana', { cidade: 'Campinas' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      nome: 'Jovens da Ana',
      cidade: 'Campinas',
      verificacao: 'nova',
      modoEntrada: 'codigo_com_aprovacao',
      encontravel: false,
    })
    expect(r.json().codigo).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(r.json().link).toBe(`http://localhost:8081/entrar/${r.json().codigo}`)
    const id = r.json().id as string
    const detalhe = await req('GET', `/api/v1/c/${id}`, ana)
    expect(detalhe.json()).toMatchObject({
      meuPapel: 'admin',
      verificacao: 'nova',
      limites: { membrosAtivos: LIMITES_DA_COMUNIDADE_NOVA.vinculosAtivos, eventoPublico: false },
      uso: { membrosAtivos: 1 },
      precisaAceitarTermoDoAdmin: false,
    })
    const aceites = await b.su.query(
      'select texto_id from uj.consentimentos where comunidade_id = $1 and vinculo_id is not null order by 1',
      [id],
    )
    expect(aceites.rows.map((x) => x.texto_id)).toEqual(['TC-03', 'TC-16'])
    const codigo = await req('GET', `/api/v1/c/${id}/codigo`, ana)
    expect(codigo.json().codigo).toBe(r.json().codigo)
    // Nada do código em claro no banco.
    const linha = await b.su.query(
      'select row_to_json(c)::text as t from uj.comunidades c where id = $1',
      [id],
    )
    expect(linha.rows[0].t).not.toContain(r.json().codigo)
    const aud = await b.su.query(
      "select 1 from uj.auditoria where comunidade_id = $1 and acao = 'comunidade.criada'",
      [id],
    )
    expect(aud.rows).toHaveLength(1)
  })

  it('exige aceites, e-mail confirmado e 18 anos; recusa sem gravar', async () => {
    const bia = await adulta('Bia')
    const semTermo = await req('POST', '/api/v1/comunidades', bia, {
      nome: 'Sem termo',
      cor: '#5B4BDB',
      consentimentoFe: true,
    })
    expect(semTermo.statusCode).toBe(400)
    expect(semTermo.json().mensagem).toContain('Termo do Administrador')
    await b.su.query("update uj.contas set faixa_etaria = '16_17' where id = $1", [bia.id])
    const jovem = await criarAberta(bia, 'Jovem demais')
    expect(jovem.statusCode).toBe(403)
    expect(jovem.json().erro).toBe('idade_para_criar')
    // O banco confere de novo, mesmo sem a rota.
    await expect(
      b.comoApi(
        { contaId: bia.id },
        "select uj.criar_comunidade_aberta('Direto', '#5B4BDB', null, 'America/Sao_Paulo', decode(md5('x'), 'hex'), sha256('x'::bytea), 1, 3, 'ios')",
      ),
    ).rejects.toMatchObject({ code: 'UJ093' })
    await b.su.query(
      "update uj.contas set faixa_etaria = '18_mais', email_verificado_em = null where id = $1",
      [bia.id],
    )
    const semEmail = await criarAberta(bia, 'Sem e-mail confirmado')
    expect(semEmail.statusCode).toBe(200)
    const criadas = await b.su.query('select 1 from uj.comunidades where criado_por = $1', [bia.id])
    expect(criadas.rows).toHaveLength(1)
  })

  it('uma nova de cada vez e até 3 criadas por conta', async () => {
    const caio = await adulta('Caio')
    const um = await criarAberta(caio, 'Primeira do Caio')
    expect(um.statusCode).toBe(200)
    const dois = await criarAberta(caio, 'Segunda do Caio')
    expect(dois.statusCode).toBe(409)
    expect(dois.json().erro).toBe('limite_de_comunidades_novas')
    const semProva = await criadorSemProva()
    for (let i = 2; i <= LIMITES_DE_CRIACAO.comunidadesCriadasPorConta; i++) {
      const anterior = (
        await b.su.query<{ id: string }>(
          "select id from uj.comunidades where criado_por = $1 and verificacao = 'nova'",
          [caio.id],
        )
      ).rows[0]!.id
      expect(
        (await req('POST', `/api/v1/plataforma/comunidades/${anterior}/verificar`, semProva))
          .statusCode,
      ).toBe(200)
      expect((await criarAberta(caio, `Comunidade ${i} do Caio`)).statusCode).toBe(200)
    }
    await b.dono.query(
      "update uj.comunidades set verificacao = 'verificada' where criado_por = $1",
      [caio.id],
    )
    const quarta = await criarAberta(caio, 'Quarta do Caio')
    expect(quarta.statusCode).toBe(409)
    expect(quarta.json().erro).toBe('limite_de_comunidades')
  })
})

// ================================================================ rodinhas no banco

describe('rodinhas da comunidade nova, no banco', () => {
  it('31º vínculo ativo é recusado pelo gatilho, mesmo fora da rota; verificada passa', async () => {
    const dona = await adulta('Dona das Rodinhas')
    const id = (await criarAberta(dona, 'Rodinhas')).json().id as string
    for (let i = 1; i < LIMITES_DA_COMUNIDADE_NOVA.vinculosAtivos; i++) {
      await vincular(b, await criarConta(b, `Pessoa ${i}`), id, 'membro')
    }
    const excedente = await criarConta(b, 'Excedente')
    await expect(vincular(b, excedente, id, 'membro')).rejects.toMatchObject({ code: 'UJ080' })
    // Pela entrada por código direto: 409 com mensagem humana.
    await req('PATCH', `/api/v1/c/${id}`, dona, { modoEntrada: 'codigo_direto' })
    const codigo = (await req('GET', `/api/v1/c/${id}/codigo`, dona)).json().codigo as string
    const quer = await adulta('Quer Entrar')
    const r = await req('POST', '/api/v1/entrada', quer, { codigo, ...ENTRADA })
    expect(r.statusCode).toBe(409)
    expect(r.json().erro).toBe('limite_de_participantes')
    await b.dono.query("update uj.comunidades set verificacao = 'verificada' where id = $1", [id])
    expect(await vincular(b, excedente, id, 'membro')).toBeTruthy()
  })

  it('evento público recusado enquanto nova (banco e rota); verificada aceita; desverificar some com a página', async () => {
    const dono = await adulta('Dono de Evento')
    const id = (await criarAberta(dono, 'Eventos Novos')).json().id as string
    await expect(
      b.dono.query(
        `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, visibilidade)
         values ($1, 'Aberto', 'Outra', now() + interval '2 days', 60, 'America/Sao_Paulo', $2, 'publica')`,
        [id, dono.id],
      ),
    ).rejects.toMatchObject({ code: 'UJ081' })
    const pelaRota = await req('POST', `/api/v1/c/${id}/eventos`, dono, {
      titulo: 'Aberto',
      categoria: 'Outra',
      inicio: '2026-12-20T10:00:00-03:00',
      duracaoMin: 60,
      visibilidade: 'publica',
    })
    expect(pelaRota.statusCode).toBe(409)
    expect(pelaRota.json().erro).toBe('evento_publico_indisponivel')
    await b.dono.query("update uj.comunidades set verificacao = 'verificada' where id = $1", [id])
    const { rows } = await b.dono.query<{ id_publico: string }>(
      `insert into uj.eventos (comunidade_id, titulo, categoria, inicio, duracao_min, fuso, criado_por, visibilidade, status)
       values ($1, 'Aberto', 'Outra', now() + interval '2 days', 60, 'America/Sao_Paulo', $2, 'publica', 'publicado')
       returning id_publico`,
      [id, dono.id],
    )
    const idPublico = rows[0]!.id_publico
    expect((await app.inject({ method: 'GET', url: `/e/${idPublico}` })).statusCode).toBe(200)
    await b.dono.query("update uj.comunidades set verificacao = 'nova' where id = $1", [id])
    expect((await app.inject({ method: 'GET', url: `/e/${idPublico}` })).statusCode).toBe(404)
    // O evento continua lá: desverificar não apaga nada.
    expect(
      (await b.su.query('select 1 from uj.eventos where id_publico = $1', [idPublico])).rows,
    ).toHaveLength(1)
  })
})

// ================================================================ código e entrada

describe('código da comunidade e entrada nos três modos', () => {
  let admin: Pessoa
  let id: string
  let codigo: string

  beforeAll(async () => {
    admin = await adulta('Admin do Código')
    const r = await criarAberta(admin, 'Código e Entrada')
    id = r.json().id
    codigo = r.json().codigo
  })

  it('com aprovação: vira pedido pendente, sem id da comunidade', async () => {
    const p = await adulta('Pede Por Código')
    const r = await req('POST', '/api/v1/entrada', p, {
      codigo: codigo.toLowerCase().replace(/(.{4})/, '$1-'),
      mensagem: 'Sou da célula de quinta',
      ...ENTRADA,
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      resultado: 'pedido_pendente',
      comunidade: { nome: 'Código e Entrada' },
    })
    // Repetir não duplica: devolve o mesmo pedido.
    expect((await req('POST', '/api/v1/entrada', p, { codigo, ...ENTRADA })).statusCode).toBe(200)
    const pedidos = await b.su.query('select 1 from uj.pedidos_de_entrada where conta_id = $1', [
      p.id,
    ])
    expect(pedidos.rows).toHaveLength(1)
  })

  it('direto: entra como membro na hora, com TC-03', async () => {
    await req('PATCH', `/api/v1/c/${id}`, admin, { modoEntrada: 'codigo_direto' })
    const p = await adulta('Entra Direto')
    const r = await req('POST', '/api/v1/entrada', p, { codigo, ...ENTRADA })
    expect(r.json()).toEqual({
      resultado: 'membro',
      comunidade: { id, nome: 'Código e Entrada' },
    })
    const v = await b.su.query(
      `select v.papel, (select count(*)::int from uj.consentimentos c
                         where c.vinculo_id = v.id and c.texto_id = 'TC-03') as tc03
         from uj.vinculos v where v.conta_id = $1 and v.comunidade_id = $2`,
      [p.id, id],
    )
    expect(v.rows[0]).toEqual({ papel: 'membro', tc03: 1 })
    const deNovo = await req('POST', '/api/v1/entrada', p, { codigo, ...ENTRADA })
    expect(deNovo.statusCode).toBe(409)
    expect(deNovo.json().erro).toBe('ja_participa')
  })

  it('só convite: o código não vale (404); código desconhecido também; `livre` não habilitado', async () => {
    await req('PATCH', `/api/v1/c/${id}`, admin, { modoEntrada: 'convite' })
    const p = await adulta('Só Convite')
    expect((await req('POST', '/api/v1/entrada', p, { codigo, ...ENTRADA })).statusCode).toBe(404)
    expect(
      (await req('POST', '/api/v1/entrada', p, { codigo: 'ZZZZ2222', ...ENTRADA })).statusCode,
    ).toBe(404)
    const livre = await req('PATCH', `/api/v1/c/${id}`, admin, { modoEntrada: 'livre' })
    expect(livre.statusCode).toBe(422)
    expect(livre.json().erro).toBe('modo_nao_habilitado')
    await req('PATCH', `/api/v1/c/${id}`, admin, { modoEntrada: 'codigo_com_aprovacao' })
  })

  it('sem o consentimento sobre a fé, ninguém entra; idade pedida a quem não declarou', async () => {
    const semFe = await adulta('Sem Fé Marcada')
    const r = await req('POST', '/api/v1/entrada', semFe, { codigo })
    expect(r.statusCode).toBe(400)
    const semIdade = await pessoaComSessao(b, app, config, 'Sem Idade')
    const r2 = await req('POST', '/api/v1/entrada', semIdade, { codigo, consentimentoFe: true })
    expect(r2.statusCode).toBe(422)
    expect(r2.json().erro).toBe('faixa_etaria_necessaria')
  })

  it('trocar o código: o antigo deixa de valer; membro e organizador não veem o código', async () => {
    const troca = await req('POST', `/api/v1/c/${id}/codigo/trocar`, admin)
    expect(troca.statusCode).toBe(200)
    expect(troca.json().codigo).not.toBe(codigo)
    const p = await adulta('Código Velho')
    expect((await req('POST', '/api/v1/entrada', p, { codigo, ...ENTRADA })).statusCode).toBe(404)
    expect(
      (await req('POST', '/api/v1/entrada', p, { codigo: troca.json().codigo, ...ENTRADA }))
        .statusCode,
    ).toBe(200)
    const org = await adulta('Organizadora do Código')
    await vincular(b, org.id, id, 'organizador')
    expect((await req('GET', `/api/v1/c/${id}/codigo`, org)).statusCode).toBe(403)
    expect((await req('POST', `/api/v1/c/${id}/codigo/trocar`, org)).statusCode).toBe(403)
    codigo = troca.json().codigo
  })
})

// ================================================================ busca

describe('busca de comunidades', () => {
  it('só ativas e encontráveis, sem acento, sem membros; mínimo de 3 letras; até 20', async () => {
    const quem = await adulta('Quem Busca')
    const enc = await criarComunidade(b, 'Jovens de São José')
    const escondida = await criarComunidade(b, 'Jovens de São José Escondidos')
    const suspensa = await criarComunidade(b, 'Jovens de São José Suspensos')
    await b.su.query(
      "update uj.comunidades set encontravel = true, cidade = 'São José dos Campos' where id = any($1)",
      [[enc, suspensa]],
    )
    await b.dono.query("update uj.comunidades set estado = 'suspensa' where id = $1", [suspensa])
    void escondida
    const r = await req('GET', '/api/v1/comunidades/busca?q=sao%20jose', quem)
    expect(r.statusCode).toBe(200)
    const lista = r.json() as Record<string, unknown>[]
    expect(lista.map((c) => c['nome'])).toEqual(['Jovens de São José'])
    expect(Object.keys(lista[0]!).sort()).toEqual(
      [
        'cidade',
        'cor',
        'idPublico',
        'logoVersao',
        'modoEntrada',
        'nome',
        'temLogo',
        'verificada',
      ].sort(),
    )
    expect(r.body).not.toContain(enc)
    expect((await req('GET', '/api/v1/comunidades/busca?cidade=campos', quem)).json()).toHaveLength(
      1,
    )
    expect((await req('GET', '/api/v1/comunidades/busca?q=sa', quem)).statusCode).toBe(400)
    expect((await req('GET', '/api/v1/comunidades/busca', quem)).statusCode).toBe(400)
    for (let i = 0; i < 22; i++) {
      const c = await criarComunidade(b, `Grupo Muitos ${String(i).padStart(2, '0')}`)
      await b.su.query('update uj.comunidades set encontravel = true where id = $1', [c])
    }
    expect((await req('GET', '/api/v1/comunidades/busca?q=muitos', quem)).json()).toHaveLength(20)
    expect((await req('GET', '/api/v1/comunidades/busca?q=muitos', null)).statusCode).toBe(401)
  })
})

// ================================================================ pedidos de entrada

describe('pedidos de entrada', () => {
  let admin: Pessoa
  let organizador: Pessoa
  let membro: Pessoa
  let com: string
  let idPublico: string

  beforeAll(async () => {
    admin = await adulta('Admin dos Pedidos')
    organizador = await adulta('Organizador dos Pedidos')
    membro = await adulta('Membro dos Pedidos')
    com = await criarComunidade(b, 'Comunidade dos Pedidos')
    await vincular(b, admin.id, com, 'admin')
    await vincular(b, organizador.id, com, 'organizador')
    await vincular(b, membro.id, com, 'membro')
    await b.su.query(
      "update uj.comunidades set encontravel = true, modo_entrada = 'codigo_com_aprovacao' where id = $1",
      [com],
    )
    idPublico = (
      await b.su.query<{ id_publico: string }>(
        'select id_publico from uj.comunidades where id = $1',
        [com],
      )
    ).rows[0]!.id_publico
  })

  const pedir = (p: Pessoa, mensagem = 'Oi, quero participar') =>
    req('POST', `/api/v1/comunidades/${idPublico}/pedidos`, p, { mensagem, ...ENTRADA })

  it('pela busca: pendente; admin e organizador são avisados com texto genérico', async () => {
    const p = await adulta('Pede Pela Busca')
    const r = await pedir(p, 'Mensagem muito pessoal 123')
    expect(r.json()).toEqual({
      resultado: 'pedido_pendente',
      comunidade: { nome: 'Comunidade dos Pedidos' },
    })
    const avisos = await b.su.query(
      "select conta_id, titulo, corpo from uj.notificacoes where tipo = 'pedido_de_entrada' and comunidade_id = $1",
      [com],
    )
    expect(avisos.rows.map((x) => x.conta_id).sort()).toEqual([admin.id, organizador.id].sort())
    expect(JSON.stringify(avisos.rows)).not.toContain('Mensagem muito pessoal')
    expect(JSON.stringify(avisos.rows)).not.toContain('Pede Pela Busca')
    const lista = await req('GET', `/api/v1/c/${com}/pedidos`, organizador)
    expect(lista.json().pedidos[0]).toMatchObject({
      nome: 'Pede Pela Busca',
      mensagem: 'Mensagem muito pessoal 123',
      estado: 'pendente',
      origem: 'busca',
    })
    expect((await req('GET', `/api/v1/c/${com}/pedidos`, membro)).statusCode).toBe(403)
    // Auditoria sem o conteúdo da mensagem.
    const aud = await b.su.query(
      'select detalhes::text as d from uj.auditoria where comunidade_id = $1',
      [com],
    )
    expect(aud.rows.map((x) => x.d).join(' ')).not.toContain('Mensagem muito pessoal')
  })

  it('aceitar é idempotente e cria um só vínculo de membro; quem pediu vê "aceito" e é avisado', async () => {
    const p = await adulta('Será Aceita')
    await pedir(p)
    const pedidoId = (await req('GET', `/api/v1/c/${com}/pedidos`, admin))
      .json()
      .pedidos.find((x: { nome: string }) => x.nome === 'Será Aceita').id as string
    const um = await req('POST', `/api/v1/c/${com}/pedidos/${pedidoId}/aceitar`, admin)
    const dois = await req('POST', `/api/v1/c/${com}/pedidos/${pedidoId}/aceitar`, organizador)
    expect(um.statusCode).toBe(200)
    expect(dois.json()).toEqual(um.json())
    expect(um.json()).toMatchObject({ estado: 'aceito' })
    const v = await b.su.query(
      'select papel, estado from uj.vinculos where conta_id = $1 and comunidade_id = $2',
      [p.id, com],
    )
    expect(v.rows).toEqual([{ papel: 'membro', estado: 'ativo' }])
    // Mensagem apagada na decisão.
    const linha = await b.su.query('select mensagem from uj.pedidos_de_entrada where id = $1', [
      pedidoId,
    ])
    expect(linha.rows[0].mensagem).toBeNull()
    const meus = (await req('GET', '/api/v1/eu/pedidos', p)).json().pedidos
    expect(meus[0]).toMatchObject({ estado: 'aceito', comunidade: { id: com } })
    expect(JSON.stringify(meus)).not.toContain(admin.id)
    // Recusar depois de aceito: 409.
    expect(
      (await req('POST', `/api/v1/c/${com}/pedidos/${pedidoId}/recusar`, admin)).statusCode,
    ).toBe(409)
  })

  it('recusado: "não aprovado", aviso no sino mesmo sem vínculo e 30 dias de espera', async () => {
    const p = await adulta('Será Recusada')
    await pedir(p)
    const pedidoId = (await req('GET', `/api/v1/c/${com}/pedidos`, admin))
      .json()
      .pedidos.find((x: { nome: string }) => x.nome === 'Será Recusada').id as string
    expect(
      (await req('POST', `/api/v1/c/${com}/pedidos/${pedidoId}/recusar`, admin)).json(),
    ).toEqual({ estado: 'recusado' })
    const meus = (await req('GET', '/api/v1/eu/pedidos', p)).json().pedidos
    expect(meus[0]).toMatchObject({
      estado: 'nao_aprovado',
      comunidade: { nome: 'Comunidade dos Pedidos' },
    })
    expect(meus[0].comunidade.id).toBeUndefined()
    const sino = (await req('GET', '/api/v1/eu/notificacoes/caixa', p)).json().notificacoes
    expect(sino[0]).toMatchObject({
      tipo: 'pedido_decidido',
      destino: { tela: 'meus_pedidos' },
      comunidade: { nome: 'Comunidade dos Pedidos' },
    })
    expect(sino[0].texto).not.toMatch(/recusad|aprovad/i)
    const deNovo = await pedir(p)
    expect(deNovo.statusCode).toBe(409)
    expect(deNovo.json().erro).toBe('pedido_recusado_recentemente')
    await b.su.query(
      "update uj.pedidos_de_entrada set decidido_em = now() - interval '31 days' where id = $1",
      [pedidoId],
    )
    expect((await pedir(p)).statusCode).toBe(200)
  })

  it('até 3 pendentes por conta; desistir libera', async () => {
    const p = await adulta('Pede Muito')
    const ids: string[] = []
    for (let i = 0; i < LIMITES_DE_PEDIDOS.pendentesPorConta; i++) {
      const c = await criarComunidade(b, `Pendentes ${i}`)
      await b.su.query(
        "update uj.comunidades set encontravel = true, modo_entrada = 'codigo_com_aprovacao' where id = $1",
        [c],
      )
      const ip = (
        await b.su.query<{ id_publico: string }>(
          'select id_publico from uj.comunidades where id = $1',
          [c],
        )
      ).rows[0]!.id_publico
      ids.push(ip)
      expect((await req('POST', `/api/v1/comunidades/${ip}/pedidos`, p, ENTRADA)).statusCode).toBe(
        200,
      )
    }
    const quarto = await pedir(p)
    expect(quarto.statusCode).toBe(409)
    expect(quarto.json().erro).toBe('limite_de_pedidos')
    const meu = (await req('GET', '/api/v1/eu/pedidos', p)).json().pedidos[0].id as string
    expect((await req('DELETE', `/api/v1/eu/pedidos/${meu}`, p)).statusCode).toBe(200)
    expect((await req('DELETE', `/api/v1/eu/pedidos/${meu}`, p)).statusCode).toBe(404)
    expect((await pedir(p)).statusCode).toBe(200)
    // Outra conta não desiste do pedido de ninguém.
    const outro = (await req('GET', '/api/v1/eu/pedidos', p)).json().pedidos[0].id as string
    expect((await req('DELETE', `/api/v1/eu/pedidos/${outro}`, admin)).statusCode).toBe(404)
  })

  it('isolamento: admin de A não lista nem decide pedido de B (404), nem por filtro', async () => {
    const adminA = await adulta('Admin A dos Pedidos')
    const comA = await criarComunidade(b, 'A dos Pedidos')
    await vincular(b, adminA.id, comA, 'admin')
    const p = await adulta('Pede em B')
    await pedir(p)
    const pedidoDeB = (await req('GET', `/api/v1/c/${com}/pedidos`, admin))
      .json()
      .pedidos.find((x: { nome: string }) => x.nome === 'Pede em B').id as string
    expect((await req('GET', `/api/v1/c/${com}/pedidos`, adminA)).statusCode).toBe(404)
    for (const filtro of ['pendente', 'todos', 'aceito']) {
      const lista = await req('GET', `/api/v1/c/${comA}/pedidos?estado=${filtro}`, adminA)
      expect(lista.json().pedidos).toEqual([])
    }
    for (const d of ['aceitar', 'recusar']) {
      expect(
        (await req('POST', `/api/v1/c/${comA}/pedidos/${pedidoDeB}/${d}`, adminA)).statusCode,
      ).toBe(404)
      expect(
        (await req('POST', `/api/v1/c/${com}/pedidos/${pedidoDeB}/${d}`, adminA)).statusCode,
      ).toBe(404)
    }
    const estado = await b.su.query('select estado from uj.pedidos_de_entrada where id = $1', [
      pedidoDeB,
    ])
    expect(estado.rows[0].estado).toBe('pendente')
    // Pela tabela, com o contexto de A, nada de B.
    expect(
      await b.comoApi(
        { contaId: adminA.id, comunidadeId: comA },
        'select id from uj.pedidos_de_entrada where comunidade_id = $1',
        [com],
      ),
    ).toEqual([])
  })

  it('exportar meus dados traz os pedidos de entrada da pessoa', async () => {
    const p = await adulta('Exporta Pedido')
    await pedir(p, 'Mensagem exportada')
    const r = await req('GET', '/api/v1/eu/exportar', p)
    expect(r.json().pedidosDeEntrada).toEqual([
      expect.objectContaining({
        comunidade: 'Comunidade dos Pedidos',
        mensagem: 'Mensagem exportada',
      }),
    ])
    expect(r.json().denunciasDeComunidade).toEqual([])
  })
})

// ================================================================ Plataforma

describe('Plataforma: lista, verificação e o código do autenticador', () => {
  it('sem a prova: lista com quem criou, filtra e pagina; verifica e desverifica, auditado', async () => {
    const semProva = await criadorSemProva()
    const dono = await adulta('Dono Para Verificar')
    const id = (await criarAberta(dono, 'Para Verificar', { cidade: 'Itu' })).json().id as string
    const lista = await req(
      'GET',
      '/api/v1/plataforma/comunidades?verificacao=nova&busca=verificar',
      semProva,
    )
    expect(lista.statusCode).toBe(200)
    expect(lista.json().comunidades).toEqual([
      expect.objectContaining({
        id,
        nome: 'Para Verificar',
        cidade: 'Itu',
        verificacao: 'nova',
        estado: 'ativa',
        membrosAtivos: 1,
        denunciasAbertas: 0,
        criador: { nome: 'Dono Para Verificar', email: dono.email },
      }),
    ])
    const v = await req('POST', `/api/v1/plataforma/comunidades/${id}/verificar`, semProva)
    expect(v.json()).toEqual({ verificacao: 'verificada' })
    expect((await req('GET', `/api/v1/c/${id}`, dono)).json().limites).toEqual({
      membrosAtivos: null,
      eventoPublico: true,
    })
    const d = await req('POST', `/api/v1/plataforma/comunidades/${id}/desverificar`, semProva)
    expect(d.json()).toEqual({ verificacao: 'nova' })
    const aud = await b.su.query(
      "select acao from uj.auditoria where comunidade_id = $1 and acao like 'plataforma.%' order by id",
      [id],
    )
    expect(aud.rows.map((x) => x.acao)).toEqual([
      'plataforma.comunidade_verificada',
      'plataforma.comunidade_desverificada',
    ])
    // Admin não verifica a própria comunidade (nem pela rota nem pelo banco).
    expect(
      (await req('POST', `/api/v1/plataforma/comunidades/${id}/verificar`, dono)).statusCode,
    ).toBe(403)
    await expect(
      b.comoApi(
        { contaId: dono.id, comunidadeId: id },
        "update uj.comunidades set verificacao = 'verificada' where id = $1",
        [id],
      ),
    ).rejects.toThrow(/permission denied/)
    // Cursor: páginas de 50 sem repetir.
    for (let i = 0; i < 55; i++) await criarComunidade(b, `Paginada ${i}`)
    const p1 = (await req('GET', '/api/v1/plataforma/comunidades', semProva)).json()
    expect(p1.comunidades).toHaveLength(50)
    const p2 = (
      await req('GET', `/api/v1/plataforma/comunidades?cursor=${p1.proximoCursor}`, semProva)
    ).json()
    const ids1 = new Set(p1.comunidades.map((c: { id: string }) => c.id))
    expect(p2.comunidades.some((c: { id: string }) => ids1.has(c.id))).toBe(false)
  })

  it('2FA: criar sem a prova; suspender e excluir continuam pedindo a prova', async () => {
    const semProva = await criadorSemProva()
    const criada = await req('POST', '/api/v1/plataforma/comunidades', semProva, {
      nome: 'Criada Sem Prova',
    })
    expect(criada.statusCode).toBe(200)
    const url = `/api/v1/plataforma/comunidades/${criada.json().id}/estado`
    for (const corpo of [
      { estado: 'suspensa' },
      { estado: 'exclusao_agendada', confirmacaoNome: 'Criada Sem Prova' },
    ]) {
      const r = await req('PATCH', url, semProva, corpo)
      expect(r.statusCode).toBe(403)
      expect(r.json().erro).toBe('segundo_fator_necessario')
    }
    const comProva = await req('PATCH', url, criador, {
      estado: 'exclusao_agendada',
      confirmacaoNome: 'Criada Sem Prova',
    })
    expect(comProva.statusCode).toBe(200)
    // Intervenção também continua pedindo.
    expect(
      (
        await req('POST', `/api/v1/plataforma/comunidades/${criada.json().id}/convites`, semProva, {
          motivo: 'Teste de intervenção sem a prova',
        })
      ).statusCode,
    ).toBe(403)
  })
})

// ================================================================ denúncia de comunidade

describe('denúncia de comunidade', () => {
  it('quem achou na busca ou participa denuncia; vai para a Plataforma, prioridade a menor', async () => {
    const quem = await adulta('Denunciante')
    const c = await criarComunidade(b, 'Suspeita')
    await b.su.query('update uj.comunidades set encontravel = true where id = $1', [c])
    const ip = (
      await b.su.query<{ id_publico: string }>(
        'select id_publico from uj.comunidades where id = $1',
        [c],
      )
    ).rows[0]!.id_publico
    const r = await req('POST', `/api/v1/comunidades/${ip}/denuncias`, quem, {
      motivo: 'spam',
      detalhe: 'Detalhe sigiloso da denúncia',
    })
    expect(r.statusCode).toBe(200)
    const urgente = await req(
      'POST',
      `/api/v1/comunidades/${ip}/denuncias`,
      await adulta('Outra'),
      {
        motivo: 'risco_a_menor',
      },
    )
    expect(urgente.statusCode).toBe(200)
    // Escondida e sem vínculo: 404.
    const escondida = await criarComunidade(b, 'Escondida')
    const ipE = (
      await b.su.query<{ id_publico: string }>(
        'select id_publico from uj.comunidades where id = $1',
        [escondida],
      )
    ).rows[0]!.id_publico
    expect(
      (await req('POST', `/api/v1/comunidades/${ipE}/denuncias`, quem, { motivo: 'spam' }))
        .statusCode,
    ).toBe(404)
    const semProva = await criadorSemProva()
    const fila = (await req('GET', '/api/v1/plataforma/denuncias-de-comunidade', semProva)).json()
      .denuncias
    expect(fila[0]).toMatchObject({ motivo: 'risco_a_menor', comunidade: { id: c } })
    expect(JSON.stringify(fila)).not.toContain(quem.id)
    // Ninguém da comunidade vê; a auditoria não leva o detalhe.
    const aud = await b.su.query(
      "select detalhes::text as d, comunidade_id from uj.auditoria where acao = 'comunidade.denunciada'",
    )
    expect(aud.rows.every((x) => x.comunidade_id === null)).toBe(true)
    expect(aud.rows.map((x) => x.d).join(' ')).not.toContain('Detalhe sigiloso')
    const resolver = await req(
      'POST',
      `/api/v1/plataforma/denuncias-de-comunidade/${r.json().id}/resolver`,
      semProva,
      { estado: 'improcedente' },
    )
    expect(resolver.statusCode).toBe(200)
    expect((await req('GET', '/api/v1/plataforma/denuncias-de-comunidade', quem)).statusCode).toBe(
      403,
    )
    expect((await req('GET', '/api/v1/eu/exportar', quem)).json().denunciasDeComunidade).toEqual([
      expect.objectContaining({ comunidade: 'Suspeita', motivo: 'spam' }),
    ])
  })
})

// ================================================================ TC-16, órfã e retenção

describe('termo do administrador, comunidade órfã e retenção', () => {
  it('admin promovido depois aceita o TC-16 uma vez', async () => {
    const dona = await adulta('Dona do Termo')
    const id = (await criarAberta(dona, 'Termo Depois')).json().id as string
    const promovida = await adulta('Promovida')
    const v = await vincular(b, promovida.id, id, 'membro')
    await req('PATCH', `/api/v1/c/${id}/membros/${v}`, dona, { papel: 'admin' })
    expect((await req('GET', `/api/v1/c/${id}`, promovida)).json().precisaAceitarTermoDoAdmin).toBe(
      true,
    )
    expect(
      (await req('POST', `/api/v1/c/${id}/termo-do-admin`, promovida, { aceite: false }))
        .statusCode,
    ).toBe(400)
    const ok = await req('POST', `/api/v1/c/${id}/termo-do-admin`, promovida, { aceite: true })
    expect(ok.json()).toMatchObject({ ok: true, registrado: true })
    expect((await req('GET', `/api/v1/c/${id}`, promovida)).json().precisaAceitarTermoDoAdmin).toBe(
      false,
    )
  })

  it('quem criou excluiu a conta e não sobrou ninguém: exclusão agendada sozinha', async () => {
    const so = await adulta('Sozinha Criadora')
    const id = (await criarAberta(so, 'Vai Ficar Órfã')).json().id as string
    const r = await req('POST', '/api/v1/eu/excluir-conta', so, { senha: SENHA_PADRAO })
    expect(r.statusCode).toBe(200)
    const c = await b.su.query(
      "select estado, exclusao_agendada_para > now() + interval '29 days' as carencia from uj.comunidades where id = $1",
      [id],
    )
    expect(c.rows[0]).toEqual({ estado: 'exclusao_agendada', carencia: true })
    // Com outra pessoa ativa, a comunidade fica.
    const com = await adulta('Criadora Com Gente')
    const id2 = (await criarAberta(com, 'Tem Gente')).json().id as string
    const v = await vincular(b, await criarConta(b, 'Fica'), id2, 'membro')
    await req('PATCH', `/api/v1/c/${id2}/membros/${v}`, com, { papel: 'admin' })
    expect(
      (await req('POST', '/api/v1/eu/excluir-conta', com, { senha: SENHA_PADRAO })).statusCode,
    ).toBe(200)
    const c2 = await b.su.query('select estado from uj.comunidades where id = $1', [id2])
    expect(c2.rows[0].estado).toBe('ativa')
  })

  it('o job diário vence pendentes de 30 dias e apaga decididos depois de 30 dias', async () => {
    const c = await criarComunidade(b, 'Retenção de Pedidos')
    const conta = await criarConta(b, 'Pedido Velho')
    const ins = (estado: string, criado: string, decidido: string | null) =>
      b.su.query<{ id: string }>(
        `insert into uj.pedidos_de_entrada (comunidade_id, conta_id, origem, mensagem, estado,
           consentimento_versao, consentimento_forma, criado_em, decidido_em)
         values ($1, $2, 'busca', $3, $4, 3, 'ios', now() - $5::interval, now() - $6::interval) returning id`,
        [c, conta, estado === 'pendente' ? 'velha' : null, estado, criado, decidido],
      )
    const velho = (await ins('pendente', '31 days', null)).rows[0]!.id
    const decidido = (await ins('recusado', '40 days', '31 days')).rows[0]!.id
    const recente = (await ins('recusado', '10 days', '5 days')).rows[0]!.id
    const r = (
      await b.dono.query<{ r: Record<string, number> }>('select uj.executar_retencao() as r')
    ).rows[0]!.r
    expect(r['pedidos_de_entrada_vencidos']).toBeGreaterThanOrEqual(1)
    const linhas = await b.su.query(
      'select id, estado, mensagem from uj.pedidos_de_entrada where id = any($1)',
      [[velho, decidido, recente]],
    )
    const porId = new Map(linhas.rows.map((x) => [x.id, x]))
    expect(porId.get(velho)).toMatchObject({ estado: 'cancelado', mensagem: null })
    expect(porId.has(decidido)).toBe(false)
    expect(porId.get(recente)).toMatchObject({ estado: 'recusado' })
  })

  it('os limites do banco são os mesmos de packages/dominio', async () => {
    const { rows } = await b.su.query(
      `select uj.limite_de_vinculos_da_comunidade_nova() as v,
              uj.limite_de_comunidades_novas_por_conta() as n,
              uj.limite_de_comunidades_criadas_por_conta() as c,
              uj.limite_de_pedidos_pendentes_por_conta() as p,
              uj.dias_de_espera_depois_de_recusa() as d`,
    )
    expect(rows[0]).toEqual({
      v: LIMITES_DA_COMUNIDADE_NOVA.vinculosAtivos,
      n: LIMITES_DE_CRIACAO.comunidadesNovasAoMesmoTempo,
      c: LIMITES_DE_CRIACAO.comunidadesCriadasPorConta,
      p: LIMITES_DE_PEDIDOS.pendentesPorConta,
      d: LIMITES_DE_PEDIDOS.diasDepoisDeRecusa,
    })
  })
})
