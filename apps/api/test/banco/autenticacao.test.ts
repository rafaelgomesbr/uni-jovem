import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gerarToken, hashDeToken, hmacDeToken } from '../../src/autenticacao/cripto.ts'
import { verificarAcesso } from '../../src/autenticacao/jwt.ts'
import { codigoTotp, contadorAtual } from '../../src/autenticacao/totp.ts'
import { carregarConfig } from '../../src/config.ts'
import {
  correioDesligado,
  FalhaNoEnvio,
  type Correio,
  type Mensagem,
} from '../../src/correio/correio.ts'
import { CABECALHO_CSRF, nomeDoCookieDeRefresh } from '../../src/rotas/autenticacao.ts'
const COOKIE_REFRESH = nomeDoCookieDeRefresh(false)
import { criarServidor } from '../../src/servidor.ts'
import { envDeTeste } from '../apoio/config.ts'
import {
  criarComunidade,
  criarConta,
  novoBanco,
  vincular,
  type BancoDeTeste,
} from '../apoio/banco.ts'

const config = carregarConfig(envDeTeste())
const SENHA = 'luau na praia de sábado'
/** TC-01, TC-02 e TC-03 aceitos (o app só envia com as caixas marcadas). */
const ACEITES = { faixaEtaria: '18_mais', aceiteTermos: true, consentimentoFe: true }

let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>
let comunidade: string
let admin: string
const caixa: Mensagem[] = []
const correio: Correio = {
  modo: 'arquivo',
  async enviar(m) {
    caixa.push(m)
  },
}

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, { api: b.api, auth: b.auth, correio, fatorDeLimitePorIp: 100 })
  await app.ready()
  comunidade = await criarComunidade(b, 'Jovens Central')
  admin = await criarConta(b, 'Admin Central')
  await vincular(b, admin, comunidade, 'admin')
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

async function convite(papel: string, email?: string): Promise<string> {
  const token = gerarToken()
  await b.su.query(
    `insert into uj.convites (comunidade_id, papel, email_destino, token_hmac, expira_em, criado_por)
     values ($1, $2, $3, $4, now() + interval '7 days', $5)`,
    [comunidade, papel, email ?? null, hmacDeToken(token, config.CONVITE_SEGREDO), admin],
  )
  return token
}

const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers })

function ultimoCodigo(): string {
  const m = caixa.at(-1)!.corpo.match(/código de verificação é (\d{6})/)
  return m![1]!
}

async function cadastrar(
  emailNovo: string,
  papel = 'membro',
): Promise<{ acesso: string; refresh: string }> {
  const token = await convite(papel)
  const ini = await post('/api/auth/convite/iniciar', {
    token,
    nome: 'Pessoa Teste',
    email: emailNovo,
    whatsapp: '+5511912345678',
  })
  expect(ini.statusCode).toBe(200)
  const fim = await post('/api/auth/convite/concluir', {
    ...ACEITES,
    token,
    verificacaoId: ini.json().verificacaoId,
    codigo: ultimoCodigo(),
    nome: 'Pessoa Teste',
    whatsapp: '+5511912345678',
    senha: SENHA,
    plataforma: 'ios',
  })
  expect(fim.statusCode).toBe(200)
  return fim.json()
}

describe('cadastro por convite', () => {
  it('e-mail desligado: 503 antes de gravar verificação ou gastar a cota do convite', async () => {
    const token = await convite('membro')
    const outro = criarServidor(config, { api: b.api, auth: b.auth, correio: correioDesligado() })
    try {
      const antes = await b.su.query('select count(*)::int as n from uj.verificacoes_email')
      const r = await outro.inject({
        method: 'POST',
        url: '/api/auth/convite/iniciar',
        payload: { token, nome: 'Sem Envio', email: 'sem.envio@exemplo.test' },
      })
      expect(r.statusCode).toBe(503)
      expect(r.json().erro).toBe('cadastro_indisponivel')
      const depois = await b.su.query('select count(*)::int as n from uj.verificacoes_email')
      expect(depois.rows).toEqual(antes.rows)
    } finally {
      await outro.close()
    }
  })

  it.each(['/api/auth/convite/iniciar', '/api/auth/cadastro/iniciar'])(
    'falha do transporte em %s: 503 sem expor erro técnico',
    async (url) => {
      const token = await convite('membro')
      const outro = criarServidor(config, {
        api: b.api,
        auth: b.auth,
        correio: {
          modo: 'smtp',
          async enviar() {
            throw new FalhaNoEnvio(535, 'SMTP EAUTH')
          },
        },
      })
      try {
        const r = await outro.inject({
          method: 'POST',
          url,
          payload: {
            token,
            nome: 'Falha Envio',
            email: 'falha.envio@exemplo.test',
            faixaEtaria: '18_mais',
            aceites: { termos: true },
          },
        })
        expect(r.statusCode).toBe(503)
        expect(r.json()).toEqual({
          erro: 'email_indisponivel',
          mensagem: 'Não conseguimos enviar o e-mail agora. Tente de novo em instantes.',
        })
      } finally {
        await outro.close()
      }
    },
  )

  it('fluxo completo: consulta, código por e-mail, conta e vínculo com o papel do convite', async () => {
    const token = await convite('organizador')
    const consulta = await post('/api/auth/convite/consultar', { token })
    expect(consulta.json()).toMatchObject({
      situacao: 'valido',
      papel: 'organizador',
      comunidade: { nome: 'Jovens Central' },
    })

    const ini = await post('/api/auth/convite/iniciar', {
      token,
      nome: 'Bruna Lima',
      email: 'Bruna@Exemplo.test',
      whatsapp: '+5511987654321',
    })
    expect(ini.statusCode).toBe(200)
    expect(caixa.at(-1)!.para).toBe('bruna@exemplo.test')
    const codigo = ultimoCodigo()
    const errado = codigo === '000000' ? '111111' : '000000'

    const base = {
      ...ACEITES,
      token,
      verificacaoId: ini.json().verificacaoId,
      nome: 'Bruna Lima',
      whatsapp: '+5511987654321',
      senha: SENHA,
      plataforma: 'android',
    }
    const ruim = await post('/api/auth/convite/concluir', { ...base, codigo: errado })
    expect(ruim.statusCode).toBe(422)
    expect(ruim.json().erro).toBe('codigo_invalido')

    const ok = await post('/api/auth/convite/concluir', { ...base, codigo })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ segundoFator: false })
    expect(typeof ok.json().refresh).toBe('string')

    const { rows } = await b.su.query(
      `select v.papel from uj.vinculos v join uj.contas a on a.id = v.conta_id
        where a.email = 'bruna@exemplo.test'`,
    )
    expect(rows).toEqual([{ papel: 'organizador' }])

    // Convite de uso único não serve de novo; a verificação também não.
    expect((await post('/api/auth/convite/consultar', { token })).json().situacao).toBe('usado')
    const repetido = await post('/api/auth/convite/concluir', { ...base, codigo })
    expect(repetido.statusCode).toBe(410)
  })

  it('cinco códigos errados esgotam a verificação', async () => {
    const token = await convite('membro')
    const ini = await post('/api/auth/convite/iniciar', {
      token,
      nome: 'Caio',
      email: 'caio@exemplo.test',
    })
    const certo = ultimoCodigo()
    const errado = certo === '000000' ? '111111' : '000000'
    const corpo = {
      ...ACEITES,
      token,
      verificacaoId: ini.json().verificacaoId,
      nome: 'Caio',
      senha: SENHA,
      plataforma: 'ios',
    }
    for (let i = 0; i < 5; i++) {
      await post('/api/auth/convite/concluir', { ...corpo, codigo: errado })
    }
    const depois = await post('/api/auth/convite/concluir', { ...corpo, codigo: certo })
    expect(depois.statusCode).toBe(410)
  })

  it('senha fraca é recusada com explicação, sem criar conta', async () => {
    const token = await convite('membro')
    const ini = await post('/api/auth/convite/iniciar', {
      token,
      nome: 'Davi',
      email: 'davi@exemplo.test',
    })
    const r = await post('/api/auth/convite/concluir', {
      ...ACEITES,
      token,
      verificacaoId: ini.json().verificacaoId,
      codigo: ultimoCodigo(),
      nome: 'Davi',
      senha: '12345678',
      plataforma: 'ios',
    })
    expect(r.statusCode).toBe(422)
    expect(r.json().erro).toBe('senha_fraca')
    const { rows } = await b.su.query("select 1 from uj.contas where email = 'davi@exemplo.test'")
    expect(rows).toEqual([])
  })

  it('convite para outro e-mail é recusado; e-mail com conta recebe a mesma resposta', async () => {
    const dirigido = await convite('membro', 'certo@exemplo.test')
    const r1 = await post('/api/auth/convite/iniciar', {
      token: dirigido,
      nome: 'Outro',
      email: 'outro@exemplo.test',
    })
    expect(r1.json().erro).toBe('convite_de_outro_email')
    const consulta = await post('/api/auth/convite/consultar', { token: dirigido })
    expect(consulta.json().emailDestinoMascarado).toBe('c••••@exemplo.test')

    await cadastrar('existe@exemplo.test')
    const tokenExistente = await convite('membro')
    const r2 = await post('/api/auth/convite/iniciar', {
      token: tokenExistente,
      nome: 'Existe',
      email: 'existe@exemplo.test',
    })
    // Mesma forma de resposta de quem não tem conta: o link não revela quem tem conta.
    expect(r2.statusCode).toBe(200)
    expect(Object.keys(r2.json())).toEqual(['verificacaoId'])
    expect(caixa.at(-1)!.corpo).toContain('já tem conta')
    // O identificador não corresponde a nenhuma verificação: concluir não cria nada.
    const r3 = await post('/api/auth/convite/concluir', {
      ...ACEITES,
      token: tokenExistente,
      verificacaoId: r2.json().verificacaoId,
      codigo: '123456',
      nome: 'Existe',
      senha: SENHA,
      plataforma: 'ios',
    })
    expect(r3.statusCode).toBe(410)
  })

  it('cota diária por convite: um link não esgota o e-mail de todos', async () => {
    const token = await convite('membro')
    let ultimo = 0
    for (let i = 0; i < 16; i++) {
      const r = await post('/api/auth/convite/iniciar', {
        token,
        nome: 'Cota',
        email: `cota${i}@exemplo.test`,
      })
      ultimo = r.statusCode
    }
    expect(ultimo).toBe(429)
  })

  it('vínculo desativado não volta por convite genérico, só por convite dirigido', async () => {
    const sessao = await cadastrar('desativado@exemplo.test')
    const contaId = (
      await b.su.query<{ id: string }>(
        "select id from uj.contas where email = 'desativado@exemplo.test'",
      )
    ).rows[0]!.id
    await b.su.query(
      "update uj.vinculos set estado = 'desativado' where conta_id = $1 and comunidade_id = $2",
      [contaId, comunidade],
    )
    const auth = { authorization: `Bearer ${sessao.acesso}` }
    const generico = await post(
      '/api/auth/convite/aceitar',
      { token: await convite('organizador'), consentimentoFe: true },
      auth,
    )
    expect(generico.json().erro).toBe('convite_indisponivel')
    const dirigido = await post(
      '/api/auth/convite/aceitar',
      { token: await convite('membro', 'desativado@exemplo.test'), consentimentoFe: true },
      auth,
    )
    expect(dirigido.statusCode).toBe(200)
  })

  it('conta existente aceita convite de outra comunidade autenticada', async () => {
    const sessao = await cadastrar('multi@exemplo.test')
    const outra = await criarComunidade(b, 'Outra comunidade')
    const tk = gerarToken()
    await b.su.query(
      `insert into uj.convites (comunidade_id, papel, token_hmac, expira_em, criado_por)
       values ($1, 'admin', $2, now() + interval '7 days', $3)`,
      [outra, hmacDeToken(tk, config.CONVITE_SEGREDO), admin],
    )
    const r = await post(
      '/api/auth/convite/aceitar',
      { token: tk, consentimentoFe: true },
      { authorization: `Bearer ${sessao.acesso}` },
    )
    expect(r.statusCode).toBe(200)
    const { rows } = await b.su.query(
      `select c.nome, v.papel from uj.vinculos v join uj.comunidades c on c.id = v.comunidade_id
        join uj.contas a on a.id = v.conta_id where a.email = 'multi@exemplo.test' order by c.nome`,
    )
    expect(rows).toEqual([
      { nome: 'Jovens Central', papel: 'membro' },
      { nome: 'Outra comunidade', papel: 'admin' },
    ])
  })
})

describe('entrar, renovar e sair', () => {
  beforeAll(async () => {
    await cadastrar('ana@exemplo.test')
  })

  it('senha errada e e-mail inexistente dão a mesma resposta', async () => {
    const r1 = await post('/api/auth/entrar', {
      email: 'ana@exemplo.test',
      senha: 'errada demais 123',
      plataforma: 'ios',
    })
    const r2 = await post('/api/auth/entrar', {
      email: 'ninguem@exemplo.test',
      senha: 'errada demais 123',
      plataforma: 'ios',
    })
    expect(r1.statusCode).toBe(401)
    expect(r2.statusCode).toBe(401)
    expect(r1.json()).toEqual(r2.json())
  })

  it('refresh rotativo: reuso do antigo derruba o aparelho inteiro', async () => {
    const login = await post('/api/auth/entrar', {
      email: 'ana@exemplo.test',
      senha: SENHA,
      plataforma: 'ios',
      aparelho: 'iPhone da Ana',
    })
    const r1 = login.json().refresh as string
    const renovado = await post('/api/auth/renovar', { refresh: r1 })
    expect(renovado.statusCode).toBe(200)
    const r2 = renovado.json().refresh as string
    expect(r2).not.toBe(r1)

    const reuso = await post('/api/auth/renovar', { refresh: r1 })
    expect(reuso.statusCode).toBe(401)
    // O refresh legítimo mais novo também caiu: a família foi revogada.
    expect((await post('/api/auth/renovar', { refresh: r2 })).statusCode).toBe(401)
    const { rows } = await b.su.query(
      "select count(*)::int as n from uj.auditoria where acao = 'sessao.reuso_de_refresh'",
    )
    expect(rows[0]!.n).toBeGreaterThan(0)
  })

  it('sair revoga a sessão: o token de acesso deixa de valer na hora', async () => {
    const login = await post('/api/auth/entrar', {
      email: 'ana@exemplo.test',
      senha: SENHA,
      plataforma: 'android',
    })
    const auth = { authorization: `Bearer ${login.json().acesso}` }
    expect((await post('/api/auth/sair', {}, auth)).statusCode).toBe(200)
    const depois = await post('/api/auth/sair', {}, auth)
    expect(depois.statusCode).toBe(401)
    expect(depois.json().erro).toBe('sessao_invalida')
  })

  it('web: refresh só em cookie HttpOnly; renovar por cookie exige o cabeçalho anti-CSRF', async () => {
    const login = await post('/api/auth/entrar', {
      email: 'ana@exemplo.test',
      senha: SENHA,
      plataforma: 'web',
    })
    expect(login.json().refresh).toBeUndefined()
    const cookie = login.cookies.find((c) => c.name === COOKIE_REFRESH)!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.sameSite).toBe('Strict')
    expect(cookie.path).toBe('/api/auth')

    const semCabecalho = await app.inject({
      method: 'POST',
      url: '/api/auth/renovar',
      cookies: { [COOKIE_REFRESH]: cookie.value },
    })
    expect(semCabecalho.statusCode).toBe(401)
    const comCabecalho = await app.inject({
      method: 'POST',
      url: '/api/auth/renovar',
      cookies: { [COOKIE_REFRESH]: cookie.value },
      headers: { [CABECALHO_CSRF]: '1' },
    })
    expect(comCabecalho.statusCode).toBe(200)
    expect(comCabecalho.json().refresh).toBeUndefined()
  })

  it('muitas tentativas no mesmo e-mail viram 429 com Retry-After', async () => {
    let ultimo = 0
    let retry: string | undefined
    for (let i = 0; i < 11; i++) {
      const r = await post('/api/auth/entrar', {
        email: 'alvo@exemplo.test',
        senha: 'tentativa qualquer',
        plataforma: 'ios',
      })
      ultimo = r.statusCode
      retry = r.headers['retry-after'] as string | undefined
    }
    expect(ultimo).toBe(429)
    expect(Number(retry)).toBeGreaterThan(0)
  })
})

describe('recuperação de senha', () => {
  beforeAll(async () => {
    await cadastrar('rec@exemplo.test')
  })

  it('e-mail inexistente: 202 igual e nada enviado', async () => {
    const antes = caixa.length
    const r = await post('/api/auth/recuperar', { email: 'nao.existe@exemplo.test' })
    await app.emAndamento()
    expect(r.statusCode).toBe(202)
    expect(caixa.length).toBe(antes)
  })

  it('link de uso único; redefinir derruba todas as sessões', async () => {
    const login = await post('/api/auth/entrar', {
      email: 'rec@exemplo.test',
      senha: SENHA,
      plataforma: 'ios',
    })
    const r = await post('/api/auth/recuperar', { email: 'rec@exemplo.test' })
    await app.emAndamento()
    expect(r.statusCode).toBe(202)
    const mensagem = caixa.at(-1)!
    expect(mensagem.para).toBe('rec@exemplo.test')
    const token = mensagem.corpo.match(/#t=([\w-]+)/)![1]!
    expect(mensagem.corpo).toContain('http://localhost:8081/redefinir-senha#t=')

    const nova = 'canções novas no culto jovem'
    expect((await post('/api/auth/redefinir', { token, senha: nova })).statusCode).toBe(200)
    expect((await post('/api/auth/redefinir', { token, senha: nova })).statusCode).toBe(401)

    const antiga = await post(
      '/api/auth/sair',
      {},
      { authorization: `Bearer ${login.json().acesso}` },
    )
    expect(antiga.statusCode).toBe(401)
    expect(
      (
        await post('/api/auth/entrar', {
          email: 'rec@exemplo.test',
          senha: SENHA,
          plataforma: 'ios',
        })
      ).statusCode,
    ).toBe(401)
    expect(
      (
        await post('/api/auth/entrar', {
          email: 'rec@exemplo.test',
          senha: nova,
          plataforma: 'ios',
        })
      ).statusCode,
    ).toBe(200)
  })
})

describe('verificação em duas etapas', () => {
  it('ativar, entrar com desafio, recusar reuso do código e aceitar código de recuperação', async () => {
    const sessao = await cadastrar('dois@exemplo.test')
    const auth = { authorization: `Bearer ${sessao.acesso}` }
    const ini = await post('/api/auth/2fa/iniciar', { senhaAtual: SENHA }, auth)
    const segredo = ini.json().segredo as string
    expect(ini.json().uri).toMatch(/^otpauth:\/\/totp\//)

    const codigo = codigoTotp(segredo, contadorAtual())
    const conf = await post('/api/auth/2fa/confirmar', { codigo }, auth)
    expect(conf.statusCode).toBe(200)
    const recuperacao = conf.json().codigosDeRecuperacao as string[]
    expect(recuperacao).toHaveLength(10)

    const login = await post('/api/auth/entrar', {
      email: 'dois@exemplo.test',
      senha: SENHA,
      plataforma: 'ios',
    })
    expect(login.json()).toMatchObject({ segundoFator: true })
    const desafio = login.json().desafio as string

    // O mesmo código já usado para confirmar não vale de novo.
    const reuso = await post('/api/auth/segundo-fator', { desafio, codigo })
    expect(reuso.statusCode).toBe(401)

    const porRecuperacao = await post('/api/auth/segundo-fator', {
      desafio,
      codigo: recuperacao[0]!.toLowerCase(),
    })
    expect(porRecuperacao.statusCode).toBe(200)
    // Código de recuperação é de uso único.
    const login2 = await post('/api/auth/entrar', {
      email: 'dois@exemplo.test',
      senha: SENHA,
      plataforma: 'ios',
    })
    const outraVez = await post('/api/auth/segundo-fator', {
      desafio: login2.json().desafio,
      codigo: recuperacao[0]!,
    })
    expect(outraVez.statusCode).toBe(401)
    // Código do próximo passo do autenticador funciona.
    const proximo = await post('/api/auth/segundo-fator', {
      desafio: login2.json().desafio,
      codigo: codigoTotp(segredo, contadorAtual() + 1),
    })
    expect(proximo.statusCode).toBe(200)
    const token = await verificarAcesso(config.JWT_SEGREDO, proximo.json().acesso)
    if (!token.ok) throw new Error('token inválido')
    expect(token.conteudo.mfaEm).not.toBeNull()
    // Conta comum recebe prova de 2FA, mas ela não dá poder de plataforma no banco.
    const usuario = token.conteudo.contaId
    const tentativa = await b
      .comoApi(
        { contaId: usuario, prova: token.conteudo.prova },
        "insert into uj.comunidades (nome, criado_por) values ('Não pode', $1)",
        [usuario],
      )
      .catch((e: Error) => e.message)
    expect(tentativa).toMatch(/row-level security/)
  })
})

describe('primeiro acesso do Criador', () => {
  it('define senha e 2FA juntos; entra sem código e a plataforma pede a prova recente', async () => {
    const { rows } = await b.su.query<{ id: string }>(
      `insert into uj.contas (nome, email, email_verificado_em, plataforma_proprietario)
       values ('Criador', 'criador@exemplo.test', now(), true) returning id`,
    )
    const criador = rows[0]!.id
    const link = gerarToken()
    await b.su.query(
      `insert into uj.recuperacoes_senha (conta_id, finalidade, token_hash, expira_em)
       values ($1, 'primeiro_acesso', $2, now() + interval '30 minutes')`,
      [criador, hashDeToken(link)],
    )
    const ini = await post('/api/auth/primeiro-acesso/iniciar', { token: link })
    const segredo = ini.json().segredo as string
    const fim = await post('/api/auth/primeiro-acesso/concluir', {
      token: link,
      senha: 'a missão começa no sábado',
      codigo: codigoTotp(segredo, contadorAtual()),
    })
    expect(fim.statusCode).toBe(200)
    expect(fim.json().codigosDeRecuperacao).toHaveLength(10)
    expect((await post('/api/auth/primeiro-acesso/iniciar', { token: link })).statusCode).toBe(401)

    // Pedido do dono: o Criador entra sem o código; a sessão normal não traz prova.
    const login = await post('/api/auth/entrar', {
      email: 'criador@exemplo.test',
      senha: 'a missão começa no sábado',
      plataforma: 'web',
    })
    expect(login.statusCode).toBe(200)
    expect(login.json().segundoFator).toBe(false)
    const semProva = await verificarAcesso(config.JWT_SEGREDO, login.json().acesso)
    if (!semProva.ok) throw new Error('token inválido')
    expect(semProva.conteudo.prova).toBeNull()
    const auth = { authorization: `Bearer ${login.json().acesso}` }

    // ADR 0007 (revisa D12 e D31): criar e listar comunidades não pedem o código.
    const semProvaCria = await post('/api/v1/plataforma/comunidades', { nome: 'Sem prova' }, auth)
    expect(semProvaCria.statusCode).toBe(200)
    // Ação que destrói continua pedindo: a recusa certa, que o app usa para pedir o código.
    const recusada = await app.inject({
      method: 'PATCH',
      url: `/api/v1/plataforma/comunidades/${semProvaCria.json().id}/estado`,
      headers: auth,
      payload: { estado: 'suspensa' },
    })
    expect(recusada.statusCode).toBe(403)
    expect(recusada.json().erro).toBe('segundo_fator_necessario')
    // E o banco também não reconhece o poder de suspender sem a prova (a RLS filtra).
    const direto = await b.comoApi(
      { contaId: criador, prova: null },
      "update uj.comunidades set estado = 'suspensa' where id = $1 returning id",
      [semProvaCria.json().id],
    )
    expect(direto).toEqual([])

    // Step-up: o código do autenticador troca o acesso por um com prova recente.
    const sf = await post(
      '/api/auth/2fa/provar',
      { codigo: codigoTotp(segredo, contadorAtual() + 1) },
      auth,
    )
    expect(sf.statusCode).toBe(200)
    const acesso = await verificarAcesso(config.JWT_SEGREDO, sf.json().acesso)
    if (!acesso.ok) throw new Error('token inválido')
    expect(acesso.conteudo.prova).not.toBeNull()
    const criadaPelaApi = await post(
      '/api/v1/plataforma/comunidades',
      { nome: 'Com prova' },
      { authorization: `Bearer ${sf.json().acesso}` },
    )
    expect(criadaPelaApi.statusCode).toBe(200)

    // Com a prova do token, o banco reconhece o Criador.
    const criada = await b.comoApi<{ nome: string }>(
      { contaId: criador, prova: acesso.conteudo.prova },
      "insert into uj.comunidades (nome, criado_por) values ('Comunidade do Criador', $1) returning nome",
      [criador],
    )
    expect(criada).toEqual([{ nome: 'Comunidade do Criador' }])
  })
})

describe('proteções do segundo fator (revisão de segurança)', () => {
  async function contaCom2fa(emailNovo: string): Promise<{ segredo: string; acesso: string }> {
    const sessao = await cadastrar(emailNovo)
    const auth = { authorization: `Bearer ${sessao.acesso}` }
    const ini = await post('/api/auth/2fa/iniciar', { senhaAtual: SENHA }, auth)
    const segredo = ini.json().segredo as string
    await post('/api/auth/2fa/confirmar', { codigo: codigoTotp(segredo, contadorAtual()) }, auth)
    return { segredo, acesso: sessao.acesso }
  }

  it('ligar o 2FA exige a senha atual', async () => {
    const sessao = await cadastrar('sem2fa@exemplo.test')
    const r = await post(
      '/api/auth/2fa/iniciar',
      { senhaAtual: 'outra senha qualquer' },
      { authorization: `Bearer ${sessao.acesso}` },
    )
    expect(r.statusCode).toBe(401)
    expect(r.json().erro).toBe('senha_incorreta')
  })

  it('5 códigos errados bloqueiam a CONTA por 15 min (venham de onde vierem) e avisam por e-mail', async () => {
    const { segredo } = await contaCom2fa('forca@exemplo.test')
    const entrarDeNovo = async () =>
      (
        await post('/api/auth/entrar', {
          email: 'forca@exemplo.test',
          senha: SENHA,
          plataforma: 'ios',
        })
      ).json().desafio as string
    // Cada tentativa com um desafio NOVO (e espaços no fim, que antes mudavam a chave).
    for (let i = 0; i < 5; i++) {
      const r = await post('/api/auth/segundo-fator', {
        desafio: `${await entrarDeNovo()}${' '.repeat(i)}`,
        codigo: '000000',
      })
      expect(r.statusCode).toBe(401)
    }
    const certo = await post('/api/auth/segundo-fator', {
      desafio: await entrarDeNovo(),
      codigo: codigoTotp(segredo, contadorAtual() + 1),
    })
    expect(certo.statusCode).toBe(429)
    expect(certo.json().erro).toBe('segundo_fator_bloqueado')
    await app.emAndamento()
    expect(
      caixa.some((m) => m.para === 'forca@exemplo.test' && m.assunto.includes('segurança')),
    ).toBe(true)
  })

  it('trocar a senha invalida desafios em aberto', async () => {
    const { segredo } = await contaCom2fa('troca@exemplo.test')
    const desafio = (
      await post('/api/auth/entrar', {
        email: 'troca@exemplo.test',
        senha: SENHA,
        plataforma: 'ios',
      })
    ).json().desafio as string
    await post('/api/auth/recuperar', { email: 'troca@exemplo.test' })
    await app.emAndamento()
    const token = caixa.at(-1)!.corpo.match(/#t=([\w-]+)/)![1]!
    expect(
      (await post('/api/auth/redefinir', { token, senha: 'outra frase bem comprida' })).statusCode,
    ).toBe(200)
    const r = await post('/api/auth/segundo-fator', {
      desafio,
      codigo: codigoTotp(segredo, contadorAtual() + 1),
    })
    expect(r.statusCode).toBe(401)
    expect(r.json().erro).toBe('desafio_invalido')
  })

  it('o link de primeiro acesso não serve para redefinir senha', async () => {
    const link = gerarToken()
    const conta = await criarConta(b, 'Alguém')
    await b.su.query(
      `insert into uj.recuperacoes_senha (conta_id, finalidade, token_hash, expira_em)
       values ($1, 'primeiro_acesso', $2, now() + interval '30 minutes')`,
      [conta, hashDeToken(link)],
    )
    const r = await post('/api/auth/redefinir', { token: link, senha: 'uma senha nova e longa' })
    expect(r.statusCode).toBe(401)
  })
})

describe('cabeçalhos de segurança', () => {
  it('toda resposta da API sai sem cache e com nosniff', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/saude' })
    expect(r.headers['cache-control']).toBe('no-store')
    expect(r.headers['x-content-type-options']).toBe('nosniff')
    expect(r.headers['referrer-policy']).toBe('no-referrer')
  })
})
