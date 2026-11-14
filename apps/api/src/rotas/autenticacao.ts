import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { verificarAcesso, type ConteudoDoAcesso } from '../autenticacao/jwt.ts'
import { Limitador, truncarIp } from '../autenticacao/limitador.ts'
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

declare module 'fastify' {
  interface FastifyRequest {
    sessao: ConteudoDoAcesso | null
  }
}

export const COOKIE_REFRESH = 'uj_refresh'
const CAMINHO_COOKIE = '/api/auth'
/** Cabeçalho exigido quando o refresh vem por cookie (barreira simples contra CSRF). */
export const CABECALHO_CSRF = 'x-uj-csrf'

const plataforma = z.enum(['ios', 'android', 'web'])
const aparelho = z.string().trim().max(80).nullish()
const email = z.string().trim().max(254).email('Informe um e-mail válido.')
const whatsapp = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, 'Informe o WhatsApp com DDI e DDD, por exemplo +5511912345678.')
  .nullish()
const nome = z.string().trim().min(1, 'Informe seu nome.').max(120)
const senha = z.string().min(1).max(256)
const token = z.string().min(20).max(200)

function validar<T>(esquema: z.ZodType<T>, corpo: unknown): T {
  const r = esquema.safeParse(corpo)
  if (!r.success) {
    throw new ErroDeAuth('dados_invalidos', 400, r.error.issues.map((i) => i.message).join(' '))
  }
  return r.data
}

/**
 * Limites por finalidade. Valores em docs/adr/0003-autenticacao-propria.md.
 * `fatorIp` só existe para os testes de integração (todos os pedidos saem do
 * mesmo IP); os limites por e-mail e por desafio não mudam.
 */
function criarLimitadores(fatorIp = 1) {
  const min = 60_000
  return {
    entrarIp: new Limitador(20 * fatorIp, 15 * min),
    entrarEmail: new Limitador(10, 15 * min),
    segundoFator: new Limitador(10, 15 * min),
    recuperarIp: new Limitador(10 * fatorIp, 60 * min),
    recuperarEmail: new Limitador(5, 60 * min),
    conviteIp: new Limitador(30 * fatorIp, 60 * min),
    conviteEmail: new Limitador(5, 60 * min),
    primeiroAcessoIp: new Limitador(10 * fatorIp, 60 * min),
    renovarIp: new Limitador(120 * fatorIp, 15 * min),
  }
}

function limitar(limitador: Limitador, chave: string, resposta: FastifyReply): void {
  if (!limitador.tentar(chave)) {
    resposta.header('Retry-After', String(limitador.segundosParaLiberar(chave)))
    throw new ErroDeAuth(
      'muitas_tentativas',
      429,
      'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
    )
  }
}

function responderSessao(
  sessao: SessaoAberta,
  plat: 'ios' | 'android' | 'web',
  resposta: FastifyReply,
  seguro: boolean,
) {
  if (plat === 'web') {
    // Na web o refresh nunca chega ao JavaScript: só cookie HttpOnly.
    resposta.setCookie(COOKIE_REFRESH, sessao.refresh, {
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

export function registrarRotasDeAutenticacao(
  app: FastifyInstance,
  d: DependenciasAuth,
  opcoes: { fatorDeLimitePorIp?: number } = {},
): void {
  const lim = criarLimitadores(opcoes.fatorDeLimitePorIp)
  const seguro = d.config.UJ_AMBIENTE !== 'desenvolvimento'
  const ip = (pedido: FastifyRequest) => truncarIp(pedido.ip)

  app.decorateRequest('sessao', null)

  /** Pré-condição das rotas autenticadas: token válido E sessão viva no banco. */
  const exigirSessao = async (pedido: FastifyRequest) => {
    const cabecalho = pedido.headers.authorization
    const bruto = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7) : null
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
    limitar(lim.entrarEmail, normalizarEmail(corpo.email), resposta)
    const r = await entrar(d, {
      email: corpo.email,
      senha: corpo.senha,
      aparelho: corpo.aparelho ?? null,
      plataforma: corpo.plataforma,
    })
    if (r.segundoFator) return { segundoFator: true, desafio: r.desafio }
    lim.entrarEmail.zerar(normalizarEmail(corpo.email))
    return responderSessao(r, corpo.plataforma, resposta, seguro)
  })

  app.post('/api/auth/segundo-fator', async (pedido, resposta) => {
    const corpo = validar(
      z.object({ desafio: z.string().min(10).max(2000), codigo: z.string().trim().min(6).max(12) }),
      pedido.body,
    )
    limitar(lim.segundoFator, `${ip(pedido)}:${corpo.desafio.slice(-16)}`, resposta)
    const sessao = await concluirSegundoFator(d, corpo)
    // A plataforma veio no desafio e já está na sessão; o cookie só é usado na web.
    const { rows } = await d.auth.query<{ plataforma: 'ios' | 'android' | 'web' }>(
      'select plataforma from uj.sessoes where id = $1',
      [sessao.sessaoId],
    )
    return responderSessao(sessao, rows[0]?.plataforma ?? 'ios', resposta, seguro)
  })

  // ---------------------------------------------------------------- renovar e sair

  app.post('/api/auth/renovar', async (pedido, resposta) => {
    limitar(lim.renovarIp, ip(pedido), resposta)
    const corpo = validar(
      z.object({ refresh: z.string().min(20).max(200).optional() }),
      pedido.body ?? {},
    )
    let refresh = corpo.refresh
    let viaCookie = false
    if (!refresh) {
      if (pedido.headers[CABECALHO_CSRF] !== '1') {
        throw new ErroDeAuth('nao_autenticado', 401, 'Entre para continuar.')
      }
      refresh = pedido.cookies[COOKIE_REFRESH]
      viaCookie = true
    }
    if (!refresh) throw new ErroDeAuth('nao_autenticado', 401, 'Entre para continuar.')
    try {
      const sessao = await renovar(d, refresh)
      return responderSessao(sessao, viaCookie ? 'web' : 'ios', resposta, seguro)
    } catch (e) {
      if (viaCookie) resposta.clearCookie(COOKIE_REFRESH, { path: CAMINHO_COOKIE })
      throw e
    }
  })

  app.post('/api/auth/sair', { preHandler: exigirSessao }, async (pedido, resposta) => {
    await sair(d, pedido.sessao!.sessaoId)
    resposta.clearCookie(COOKIE_REFRESH, { path: CAMINHO_COOKIE })
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
    const corpo = validar(z.object({ token, senha }), pedido.body)
    await redefinirSenha(d, corpo)
    return { ok: true, mensagem: 'Senha alterada. Entre com a senha nova em todos os aparelhos.' }
  })

  // ---------------------------------------------------------------- convites

  app.post('/api/auth/convite/consultar', async (pedido, resposta) => {
    limitar(lim.conviteIp, ip(pedido), resposta)
    const corpo = validar(z.object({ token }), pedido.body)
    return consultarConvite(d, corpo.token)
  })

  app.post('/api/auth/convite/iniciar', async (pedido, resposta) => {
    const corpo = validar(z.object({ token, nome, email, whatsapp }), pedido.body)
    limitar(lim.conviteIp, ip(pedido), resposta)
    limitar(lim.conviteEmail, normalizarEmail(corpo.email), resposta)
    return iniciarCadastroPorConvite(d, {
      token: corpo.token,
      nome: corpo.nome,
      email: corpo.email,
      whatsapp: corpo.whatsapp ?? null,
    })
  })

  app.post('/api/auth/convite/concluir', async (pedido, resposta) => {
    const corpo = validar(
      z.object({
        token,
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
      }),
      pedido.body,
    )
    limitar(lim.conviteIp, ip(pedido), resposta)
    const sessao = await concluirCadastroPorConvite(d, {
      ...corpo,
      whatsapp: corpo.whatsapp ?? null,
      aparelho: corpo.aparelho ?? null,
    })
    return responderSessao(sessao, corpo.plataforma, resposta, seguro)
  })

  app.post('/api/auth/convite/aceitar', { preHandler: exigirSessao }, async (pedido) => {
    const corpo = validar(z.object({ token }), pedido.body)
    return aceitarConviteComConta(d, pedido.sessao!.contaId, corpo.token)
  })

  // ---------------------------------------------------------------- 2FA

  app.post('/api/auth/2fa/iniciar', { preHandler: exigirSessao }, async (pedido) =>
    iniciarTotp(d, pedido.sessao!.contaId),
  )

  app.post('/api/auth/2fa/confirmar', { preHandler: exigirSessao }, async (pedido) => {
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
    const corpo = validar(z.object({ codigo: z.string().trim().min(6).max(12) }), pedido.body)
    limitar(lim.segundoFator, `${ip(pedido)}:${pedido.sessao!.sessaoId}`, resposta)
    return provarSegundoFator(d, {
      contaId: pedido.sessao!.contaId,
      sessaoId: pedido.sessao!.sessaoId,
      codigo: corpo.codigo,
    })
  })

  // ---------------------------------------------------------------- primeiro acesso do Criador

  app.post('/api/auth/primeiro-acesso/iniciar', async (pedido, resposta) => {
    limitar(lim.primeiroAcessoIp, ip(pedido), resposta)
    const corpo = validar(z.object({ token }), pedido.body)
    return iniciarPrimeiroAcesso(d, corpo.token)
  })

  app.post('/api/auth/primeiro-acesso/concluir', async (pedido, resposta) => {
    limitar(lim.primeiroAcessoIp, ip(pedido), resposta)
    const corpo = validar(
      z.object({
        token,
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

declare module 'fastify' {
  interface FastifyInstance {
    exigirSessao: (pedido: FastifyRequest) => Promise<void>
  }
}
