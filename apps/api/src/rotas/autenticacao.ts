import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { cadastroSemConviteHabilitado, POLITICAS } from '@uj/dominio'
import { verificarAcesso, type ConteudoDoAcesso } from '../autenticacao/jwt.ts'
import { ipInteiro, Limitador, truncarIp } from '../autenticacao/limitador.ts'
import {
  PROVEDORES,
  TokensJaUsados,
  type Provedor,
  type VerificadorDeProvedores,
} from '../autenticacao/provedores.ts'
import {
  conectarProvedor,
  desconectarProvedor,
  entrarComProvedor,
  listarProvedores,
} from '../autenticacao/servicoDeProvedores.ts'
import {
  concluirCadastro,
  concluirCadastroPorProvedor,
  iniciarCadastro,
} from '../autenticacao/servicoDeCadastro.ts'
import { verificarTurnstile } from '../publico/apoio.ts'
import {
  aceitarConviteComConta,
  concluirCadastroPorConvite,
  concluirPrimeiroAcesso,
  concluirSegundoFator,
  confirmarTotp,
  consultarConvite,
  DURACAO_SESSAO_DIAS,
  entrar,
  ErroDeAuth,
  iniciarCadastroPorConvite,
  iniciarPrimeiroAcesso,
  iniciarTotp,
  MENOR_DE_16,
  normalizarEmail,
  pedirRecuperacao,
  provarSegundoFator,
  redefinirSenha,
  renovar,
  sair,
  sessaoValida,
  type DependenciasAuth,
  type SessaoAberta,
} from '../autenticacao/servico.ts'
import { ErroHttp, NAO_ENCONTRADO, validar } from '../http.ts'
import {
  MENSAGEM_SEM_CONSENTIMENTO_DE_FE,
  MENSAGEM_SEM_RESPONSAVEL,
  MENSAGEM_SEM_TERMOS,
} from '../privacidade/consentimentos.ts'

declare module 'fastify' {
  interface FastifyRequest {
    sessao: ConteudoDoAcesso | null
  }
  interface FastifyInstance {
    exigirSessao: (pedido: FastifyRequest) => Promise<void>
  }
}

/**
 * Nome do cookie de refresh. Com HTTPS, o prefixo `__Secure-` obriga o
 * navegador a só aceitá-lo com Secure. (`__Host-` exigiria Path=/.)
 */
export function nomeDoCookieDeRefresh(seguro: boolean): string {
  return seguro ? '__Secure-uj_refresh' : 'uj_refresh'
}
const CAMINHO_COOKIE = '/api/auth'
/** Cabeçalho exigido quando o refresh vem por cookie (barreira simples contra CSRF). */
export const CABECALHO_CSRF = 'x-uj-csrf'

const plataforma = z.enum(['ios', 'android', 'web'])
const aparelho = z.string().trim().max(80).nullish()
export const email = z.string().trim().max(254).email('Informe um e-mail válido.')
export const whatsapp = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, 'Informe o WhatsApp com DDI e DDD, por exemplo +5511912345678.')
  .nullish()
export const nome = z.string().trim().min(1, 'Informe seu nome.').max(120)
const senha = z.string().min(1, 'Informe a senha.').max(256)
/**
 * Token que chega por link. Link cortado (copiado pela metade no WhatsApp) é o
 * caso comum: a mensagem diz o que fazer, nunca o tamanho esperado.
 */
const tokenDeLink = (mensagem: string) =>
  z
    .string({ error: mensagem })
    .trim()
    .min(20, mensagem)
    .max(200, mensagem)
    .regex(/^[\w-]+$/, mensagem)
export const MENSAGEM_CONVITE_INVALIDO =
  'Este link de convite não é válido. Peça um novo a quem convidou você.'
const tokenDeConvite = tokenDeLink(MENSAGEM_CONVITE_INVALIDO)
const tokenDeRedefinicao = tokenDeLink(
  'Este link para criar a senha nova não é válido. Peça outro na tela Entrar, em "Esqueci a senha".',
)
const tokenDePrimeiroAcesso = tokenDeLink(
  'Este link de primeiro acesso não é válido. Gere um novo pelo comando do operador.',
)
/** TC-01: escolha única. `menos_16` existe para a API responder com a mensagem certa. */
export const faixaEtaria = z.enum(['menos_16', '16_17', '18_mais'], {
  error: 'Informe a sua faixa de idade.',
})
/** Caixa marcada de verdade (nunca pré-marcada no app): só `true` passa. */
export const marcado = (mensagem: string) => z.literal(true, { error: mensagem })

/**
 * Aceites do cadastro aberto (ADR 0007): Termos de Uso e Política de
 * Privacidade (TC-02) e, para 16 e 17 anos, a ciência do responsável (TC-01).
 */
const aceites = z.object(
  {
    termos: marcado(MENSAGEM_SEM_TERMOS),
    responsavelCiente: z.boolean().optional(),
  },
  { error: MENSAGEM_SEM_TERMOS },
)

const CADASTRO_NAO_HABILITADO = () =>
  new ErroHttp(
    'cadastro_nao_habilitado',
    403,
    'A criação de conta está fechada: peça um convite a quem administra a sua comunidade.',
  )

/**
 * Limites por finalidade (ADR 0003). Contra força bruta de código, o limite
 * real é POR CONTA, no banco (falhas_2fa); estes, em memória, cortam volume.
 * `fatorIp` só existe para os testes de integração (todos os pedidos saem do
 * mesmo IP); os limites por e-mail não mudam.
 */
function criarLimitadores(fatorIp = 1) {
  const min = 60_000
  return {
    entrarIp: new Limitador(30 * fatorIp, 15 * min),
    // Falhas de senha por (e-mail + rede) e, mais folgado, por e-mail de qualquer rede.
    falhasEmailRede: new Limitador(10, 15 * min),
    falhasEmail: new Limitador(100, 15 * min),
    segundoFatorIp: new Limitador(30 * fatorIp, 15 * min),
    recuperarIp: new Limitador(10 * fatorIp, 60 * min),
    recuperarEmail: new Limitador(5, 60 * min),
    conviteConsultarIp: new Limitador(120 * fatorIp, 60 * min),
    conviteIniciarIp: new Limitador(60 * fatorIp, 60 * min),
    conviteIniciarEmail: new Limitador(5, 60 * min),
    conviteConcluirIp: new Limitador(60 * fatorIp, 60 * min),
    primeiroAcessoIp: new Limitador(10 * fatorIp, 60 * min),
    totpIp: new Limitador(20 * fatorIp, 15 * min),
    // D44: por IP INTEIRO (não por faixa) e bem mais alto. O refresh é um
    // segredo de 256 bits, então este limite não protege contra adivinhação,
    // só corta volume; e um encontro com 80 jovens no Wi-Fi da igreja sai por
    // um IP só. 600 em 15 min = 80 pessoas abrindo o app até 7 vezes cada.
    renovarIp: new Limitador(600 * fatorIp, 15 * min),
    provedorIp: new Limitador(30 * fatorIp, 15 * min),
    conectarIp: new Limitador(20 * fatorIp, 15 * min),
    // Cadastro aberto (ADR 0007): cada início manda um e-mail (cota do Resend).
    cadastroIniciarIp: new Limitador(20 * fatorIp, 60 * min),
    cadastroIniciarEmail: new Limitador(5, 60 * min),
    cadastroConcluirIp: new Limitador(60 * fatorIp, 60 * min),
    cadastroConcluirEmail: new Limitador(20, 60 * min),
    cadastroProvedorIp: new Limitador(30 * fatorIp, 15 * min),
  }
}

function muitasTentativas(limitador: Limitador, chave: string, resposta: FastifyReply): never {
  resposta.header('Retry-After', String(limitador.segundosParaLiberar(chave)))
  throw new ErroDeAuth(
    'muitas_tentativas',
    429,
    'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  )
}

function limitar(limitador: Limitador, chave: string, resposta: FastifyReply): void {
  if (!limitador.tentar(chave)) muitasTentativas(limitador, chave, resposta)
}

/** ID token de provedor: um JWT, sem espaços, de tamanho limitado. */
const tokenDeProvedor = z
  .string()
  .trim()
  .min(20)
  .max(8000)
  .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/, 'Token inválido.')
const nonce = z.string().trim().min(16).max(128)

/** Corpo com o token de cada provedor (a Apple exige também o nonce cru). */
const corpoDoProvedor = {
  google: z.object({ idToken: tokenDeProvedor }),
  apple: z.object({ identityToken: tokenDeProvedor, nonce }),
} as const

function tokenDoCorpo(
  provedor: Provedor,
  corpo: unknown,
): { token: string; nonce: string | undefined } {
  if (provedor === 'google') {
    const r = validar(corpoDoProvedor.google, corpo)
    return { token: r.idToken, nonce: undefined }
  }
  const r = validar(corpoDoProvedor.apple, corpo)
  return { token: r.identityToken, nonce: r.nonce }
}

function provedorDoCaminho(pedido: FastifyRequest): Provedor {
  const p = (pedido.params as { provedor?: string }).provedor
  if (!PROVEDORES.includes(p as Provedor)) {
    throw NAO_ENCONTRADO()
  }
  return p as Provedor
}

export function registrarRotasDeAutenticacao(
  app: FastifyInstance,
  d: DependenciasAuth,
  opcoes: { fatorDeLimitePorIp?: number; verificador?: VerificadorDeProvedores } = {},
): void {
  const lim = criarLimitadores(opcoes.fatorDeLimitePorIp)
  const seguro = d.config.UJ_AMBIENTE !== 'desenvolvimento'
  const cookieRefresh = nomeDoCookieDeRefresh(seguro)
  const ip = (pedido: FastifyRequest) => truncarIp(pedido.ip)

  function responderSessao(sessao: SessaoAberta, plat: 'ios' | 'android' | 'web', r: FastifyReply) {
    if (plat === 'web') {
      // Na web o refresh nunca chega ao JavaScript: só cookie HttpOnly.
      r.setCookie(cookieRefresh, sessao.refresh, {
        httpOnly: true,
        secure: seguro,
        sameSite: 'strict',
        path: CAMINHO_COOKIE,
        maxAge: DURACAO_SESSAO_DIAS * 24 * 3600,
      })
      return { segundoFator: false, acesso: sessao.acesso }
    }
    return { segundoFator: false, acesso: sessao.acesso, refresh: sessao.refresh }
  }

  app.decorateRequest('sessao', null)

  /** Pré-condição das rotas autenticadas: token válido E sessão viva no banco. */
  const exigirSessao = async (pedido: FastifyRequest) => {
    const cabecalho = pedido.headers.authorization
    const bruto = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7).trim() : null
    if (!bruto) throw new ErroDeAuth('nao_autenticado', 401, 'Entre para continuar.')
    const r = await verificarAcesso(d.config.JWT_SEGREDO, bruto)
    if (!r.ok) {
      throw new ErroDeAuth(
        r.motivo === 'expirado' ? 'acesso_expirado' : 'nao_autenticado',
        401,
        'Entre para continuar.',
      )
    }
    if (!(await sessaoValida(d, r.conteudo.sessaoId, r.conteudo.contaId))) {
      throw new ErroDeAuth('sessao_invalida', 401, 'Sua sessão terminou. Entre de novo.')
    }
    pedido.sessao = r.conteudo
  }
  app.decorate('exigirSessao', exigirSessao)

  // ---------------------------------------------------------------- entrar

  app.post('/api/auth/entrar', async (pedido, resposta) => {
    const corpo = validar(z.object({ email, senha, aparelho, plataforma }), pedido.body)
    limitar(lim.entrarIp, ip(pedido), resposta)
    const alvo = normalizarEmail(corpo.email)
    const chaveRede = `${alvo}|${ip(pedido)}`
    // Só FALHAS contam, e a chave inclui a rede: quem sabe o e-mail de alguém
    // não consegue trancá-lo fora de outra rede.
    if (lim.falhasEmailRede.excedido(chaveRede))
      muitasTentativas(lim.falhasEmailRede, chaveRede, resposta)
    if (lim.falhasEmail.excedido(alvo)) muitasTentativas(lim.falhasEmail, alvo, resposta)
    try {
      const r = await entrar(d, {
        email: corpo.email,
        senha: corpo.senha,
        aparelho: corpo.aparelho ?? null,
        plataforma: corpo.plataforma,
      })
      lim.falhasEmailRede.zerar(chaveRede)
      if (r.segundoFator) return { segundoFator: true, desafio: r.desafio }
      return responderSessao(r, corpo.plataforma, resposta)
    } catch (e) {
      if (e instanceof ErroDeAuth && e.codigo === 'credenciais_invalidas') {
        lim.falhasEmailRede.registrar(chaveRede)
        lim.falhasEmail.registrar(alvo)
      }
      throw e
    }
  })

  app.post('/api/auth/segundo-fator', async (pedido, resposta) => {
    const corpo = validar(
      z.object({
        desafio: z.string().trim().min(10).max(2000),
        codigo: z.string().trim().min(6).max(12),
      }),
      pedido.body,
    )
    limitar(lim.segundoFatorIp, ip(pedido), resposta)
    const sessao = await concluirSegundoFator(d, corpo)
    const { rows } = await d.auth.query<{ plataforma: 'ios' | 'android' | 'web' }>(
      'select plataforma from uj.sessoes where id = $1',
      [sessao.sessaoId],
    )
    return responderSessao(sessao, rows[0]?.plataforma ?? 'ios', resposta)
  })

  // ---------------------------------------------------------------- renovar e sair

  app.post('/api/auth/renovar', async (pedido, resposta) => {
    const chave = ipInteiro(pedido.ip)
    if (!lim.renovarIp.tentar(chave)) {
      resposta.header('Retry-After', String(lim.renovarIp.segundosParaLiberar(chave)))
      // Quem vê isto é a pessoa abrindo o app no meio de um encontro, não um robô.
      throw new ErroDeAuth(
        'muitas_tentativas',
        429,
        'Muita gente entrando agora. Tente de novo em instantes.',
      )
    }
    const corpo = validar(
      z.object({ refresh: z.string().trim().min(20).max(200).optional() }),
      pedido.body ?? {},
    )
    let refresh = corpo.refresh
    let viaCookie = false
    if (!refresh) {
      if (pedido.headers[CABECALHO_CSRF] !== '1') {
        throw new ErroDeAuth('nao_autenticado', 401, 'Entre para continuar.')
      }
      refresh = pedido.cookies[cookieRefresh]
      viaCookie = true
    }
    if (!refresh) throw new ErroDeAuth('nao_autenticado', 401, 'Entre para continuar.')
    try {
      const sessao = await renovar(d, refresh)
      return responderSessao(sessao, viaCookie ? 'web' : 'ios', resposta)
    } catch (e) {
      if (viaCookie) resposta.clearCookie(cookieRefresh, { path: CAMINHO_COOKIE })
      throw e
    }
  })

  app.post('/api/auth/sair', { preHandler: exigirSessao }, async (pedido, resposta) => {
    await sair(d, pedido.sessao!.sessaoId, pedido.sessao!.contaId)
    resposta.clearCookie(cookieRefresh, { path: CAMINHO_COOKIE })
    return { ok: true }
  })

  // ---------------------------------------------------------------- recuperação

  app.post('/api/auth/recuperar', async (pedido, resposta) => {
    const corpo = validar(z.object({ email }), pedido.body)
    limitar(lim.recuperarIp, ip(pedido), resposta)
    // Passou do limite por e-mail: responde igual e não envia nada.
    if (lim.recuperarEmail.tentar(normalizarEmail(corpo.email))) {
      pedirRecuperacao(d, corpo.email)
    }
    resposta.code(202)
    return {
      mensagem:
        'Se existir uma conta com este e-mail, enviamos um link para criar uma senha nova. Confira também a caixa de spam.',
    }
  })

  app.post('/api/auth/redefinir', async (pedido) => {
    const corpo = validar(z.object({ token: tokenDeRedefinicao, senha }), pedido.body)
    await redefinirSenha(d, corpo)
    return { ok: true, mensagem: 'Senha alterada. Entre com a senha nova em todos os aparelhos.' }
  })

  // ---------------------------------------------------------------- convites

  app.post('/api/auth/convite/consultar', async (pedido, resposta) => {
    limitar(lim.conviteConsultarIp, ip(pedido), resposta)
    const corpo = validar(z.object({ token: tokenDeConvite }), pedido.body)
    return consultarConvite(d, corpo.token)
  })

  app.post('/api/auth/convite/iniciar', async (pedido, resposta) => {
    const corpo = validar(
      z.object({
        token: tokenDeConvite,
        nome,
        email,
        whatsapp,
        faixaEtaria: faixaEtaria.optional(),
      }),
      pedido.body,
    )
    limitar(lim.conviteIniciarIp, ip(pedido), resposta)
    limitar(lim.conviteIniciarEmail, normalizarEmail(corpo.email), resposta)
    return iniciarCadastroPorConvite(d, {
      token: corpo.token,
      nome: corpo.nome,
      email: corpo.email,
      whatsapp: corpo.whatsapp ?? null,
      faixaEtaria: corpo.faixaEtaria,
    })
  })

  app.post('/api/auth/convite/concluir', async (pedido, resposta) => {
    const corpo = validar(
      z.object({
        token: tokenDeConvite,
        verificacaoId: z.uuid(),
        codigo: z
          .string()
          .trim()
          .regex(/^\d{6}$/, 'O código tem 6 números.'),
        nome,
        whatsapp,
        senha,
        aparelho,
        plataforma,
        // TC-01, TC-02 e TC-03 (textos-de-consentimento.md): sem eles, nada é criado.
        faixaEtaria,
        aceiteTermos: marcado(MENSAGEM_SEM_TERMOS),
        consentimentoFe: marcado(MENSAGEM_SEM_CONSENTIMENTO_DE_FE),
        responsavelCiente: z.boolean().default(false),
      }),
      pedido.body,
    )
    limitar(lim.conviteConcluirIp, ip(pedido), resposta)
    if (corpo.faixaEtaria === 'menos_16') throw MENOR_DE_16()
    if (corpo.faixaEtaria === '16_17' && !corpo.responsavelCiente) {
      throw new ErroHttp('responsavel_necessario', 422, MENSAGEM_SEM_RESPONSAVEL)
    }
    const sessao = await concluirCadastroPorConvite(d, {
      token: corpo.token,
      verificacaoId: corpo.verificacaoId,
      codigo: corpo.codigo,
      nome: corpo.nome,
      senha: corpo.senha,
      plataforma: corpo.plataforma,
      whatsapp: corpo.whatsapp ?? null,
      aparelho: corpo.aparelho ?? null,
      faixaEtaria: corpo.faixaEtaria,
      responsavelCiente: corpo.responsavelCiente,
    })
    return responderSessao(sessao, corpo.plataforma, resposta)
  })

  app.post('/api/auth/convite/aceitar', { preHandler: exigirSessao }, async (pedido) => {
    const corpo = validar(
      z.object({
        token: tokenDeConvite,
        // TC-03 desta comunidade; a idade só é pedida a conta que ainda não declarou.
        consentimentoFe: marcado(MENSAGEM_SEM_CONSENTIMENTO_DE_FE),
        faixaEtaria: faixaEtaria.optional(),
        responsavelCiente: z.boolean().default(false),
      }),
      pedido.body,
    )
    return aceitarConviteComConta(d, {
      contaId: pedido.sessao!.contaId,
      sessaoId: pedido.sessao!.sessaoId,
      token: corpo.token,
      faixaEtaria: corpo.faixaEtaria,
      responsavelCiente: corpo.responsavelCiente,
    })
  })

  // ---------------------------------------------------------------- 2FA

  app.post('/api/auth/2fa/iniciar', { preHandler: exigirSessao }, async (pedido, resposta) => {
    limitar(lim.totpIp, ip(pedido), resposta)
    const corpo = validar(z.object({ senhaAtual: senha }), pedido.body)
    return iniciarTotp(d, pedido.sessao!.contaId, corpo.senhaAtual)
  })

  app.post('/api/auth/2fa/confirmar', { preHandler: exigirSessao }, async (pedido, resposta) => {
    limitar(lim.totpIp, ip(pedido), resposta)
    const corpo = validar(
      z.object({
        codigo: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
      }),
      pedido.body,
    )
    return confirmarTotp(d, pedido.sessao!.contaId, corpo.codigo)
  })

  app.post('/api/auth/2fa/provar', { preHandler: exigirSessao }, async (pedido, resposta) => {
    limitar(lim.segundoFatorIp, ip(pedido), resposta)
    const corpo = validar(z.object({ codigo: z.string().trim().min(6).max(12) }), pedido.body)
    return provarSegundoFator(d, {
      contaId: pedido.sessao!.contaId,
      sessaoId: pedido.sessao!.sessaoId,
      codigo: corpo.codigo,
    })
  })

  // ---------------------------------------------------------------- Google e Apple

  if (opcoes.verificador) {
    const dp = { ...d, verificador: opcoes.verificador, usados: new TokensJaUsados() }

    // Sem conta (ADR 0007): devolve o cadastro pendente; a conta só nasce em
    // /api/auth/provedor/concluir-cadastro, depois da idade e dos aceites.
    app.post('/api/auth/provedor/:provedor', async (pedido, resposta) => {
      const provedor = provedorDoCaminho(pedido)
      const base = validar(
        z.object({ aparelho, plataforma, nome: z.string().trim().max(120).nullish() }),
        pedido.body,
      )
      const { token: bruto, nonce: n } = tokenDoCorpo(provedor, pedido.body)
      limitar(lim.provedorIp, ip(pedido), resposta)
      const r = await entrarComProvedor(dp, {
        provedor,
        token: bruto,
        nonce: n,
        aparelho: base.aparelho ?? null,
        plataforma: base.plataforma,
        nome: base.nome ?? null,
        cadastroAberto: cadastroSemConviteHabilitado(POLITICAS.conta),
      })
      if ('cadastroPendente' in r) return r
      if (r.segundoFator) return { segundoFator: true, desafio: r.desafio }
      return responderSessao(r, base.plataforma, resposta)
    })

    app.get('/api/v1/eu/provedores', { preHandler: exigirSessao }, async (pedido) => ({
      provedores: await listarProvedores(d, pedido.sessao!.contaId),
      disponiveis: PROVEDORES.filter((p) => dp.verificador.ligado(p)),
    }))

    app.post(
      '/api/v1/eu/provedores/:provedor',
      { preHandler: exigirSessao },
      async (pedido, resposta) => {
        const provedor = provedorDoCaminho(pedido)
        const { senhaAtual } = validar(z.object({ senhaAtual: senha }), pedido.body)
        const { token: bruto, nonce: n } = tokenDoCorpo(provedor, pedido.body)
        limitar(lim.conectarIp, ip(pedido), resposta)
        return conectarProvedor(dp, {
          contaId: pedido.sessao!.contaId,
          provedor,
          token: bruto,
          nonce: n,
          senhaAtual,
        })
      },
    )

    app.delete('/api/v1/eu/provedores/:provedor', { preHandler: exigirSessao }, async (pedido) => {
      await desconectarProvedor(d, {
        contaId: pedido.sessao!.contaId,
        provedor: provedorDoCaminho(pedido),
      })
      return { ok: true }
    })
  }

  // ---------------------------------------------------------------- cadastro aberto (ADR 0007)

  app.get('/api/auth/cadastro/configuracao', async () => ({
    turnstileChaveDoSite: d.config.TURNSTILE_CHAVE_DO_SITE ?? null,
  }))

  app.post('/api/auth/cadastro/iniciar', async (pedido, resposta) => {
    if (!cadastroSemConviteHabilitado(POLITICAS.conta)) throw CADASTRO_NAO_HABILITADO()
    const corpo = validar(
      z.object({
        nome,
        email,
        faixaEtaria,
        aceites,
        turnstile: z.string().trim().max(4096).optional(),
        plataforma: plataforma.optional(),
      }),
      pedido.body,
    )
    limitar(lim.cadastroIniciarIp, ip(pedido), resposta)
    limitar(lim.cadastroIniciarEmail, normalizarEmail(corpo.email), resposta)
    // Na web, o desafio anti-robô das páginas públicas (Turnstile). O app
    // nativo não tem como mostrar o desafio: lá valem os limites acima.
    const naWeb = corpo.plataforma === 'web' || pedido.headers.origin !== undefined
    if (
      naWeb &&
      !(await verificarTurnstile(d.config.TURNSTILE_SEGREDO, corpo.turnstile, pedido.ip))
    ) {
      throw new ErroHttp(
        'verificacao_humana',
        403,
        'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.',
      )
    }
    await iniciarCadastro(d, {
      nome: corpo.nome,
      email: corpo.email,
      faixaEtaria: corpo.faixaEtaria,
      aceites: corpo.aceites,
    })
    return {
      ok: true,
      mensagem:
        'Enviamos um código de 6 números para o seu e-mail. Ele vale por 10 minutos. Confira também a caixa de spam.',
    }
  })

  app.post('/api/auth/cadastro/concluir', async (pedido, resposta) => {
    if (!cadastroSemConviteHabilitado(POLITICAS.conta)) throw CADASTRO_NAO_HABILITADO()
    const corpo = validar(
      z.object({
        email,
        codigo: z
          .string()
          .trim()
          .regex(/^\d{6}$/, 'O código tem 6 números.'),
        senha,
        aparelho,
        plataforma: plataforma.default('ios'),
      }),
      pedido.body,
    )
    limitar(lim.cadastroConcluirIp, ip(pedido), resposta)
    limitar(lim.cadastroConcluirEmail, normalizarEmail(corpo.email), resposta)
    const sessao = await concluirCadastro(d, {
      email: corpo.email,
      codigo: corpo.codigo,
      senha: corpo.senha,
      aparelho: corpo.aparelho ?? null,
      plataforma: corpo.plataforma,
    })
    return responderSessao(sessao, corpo.plataforma, resposta)
  })

  const tokenDeCadastro = tokenDeLink(
    'O tempo para concluir o cadastro acabou. Entre de novo com Google ou Apple.',
  )

  app.post('/api/auth/provedor/concluir-cadastro', async (pedido, resposta) => {
    if (!cadastroSemConviteHabilitado(POLITICAS.conta)) throw CADASTRO_NAO_HABILITADO()
    const corpo = validar(
      z.object({ tokenDeCadastro, faixaEtaria, aceites, nome: nome.nullish() }),
      pedido.body,
    )
    limitar(lim.cadastroProvedorIp, ip(pedido), resposta)
    const { sessao, plataforma: plat } = await concluirCadastroPorProvedor(d, {
      tokenDeCadastro: corpo.tokenDeCadastro,
      faixaEtaria: corpo.faixaEtaria,
      aceites: corpo.aceites,
      nome: corpo.nome ?? null,
    })
    return responderSessao(sessao, plat, resposta)
  })

  // ---------------------------------------------------------------- primeiro acesso do Criador

  app.post('/api/auth/primeiro-acesso/iniciar', async (pedido, resposta) => {
    limitar(lim.primeiroAcessoIp, ip(pedido), resposta)
    const corpo = validar(z.object({ token: tokenDePrimeiroAcesso }), pedido.body)
    return iniciarPrimeiroAcesso(d, corpo.token)
  })

  app.post('/api/auth/primeiro-acesso/concluir', async (pedido, resposta) => {
    limitar(lim.primeiroAcessoIp, ip(pedido), resposta)
    const corpo = validar(
      z.object({
        token: tokenDePrimeiroAcesso,
        senha,
        codigo: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
      }),
      pedido.body,
    )
    return concluirPrimeiroAcesso(d, corpo)
  })
}
