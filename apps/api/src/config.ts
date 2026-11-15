import { z } from 'zod'

/**
 * Configuração da API, lida UMA vez na partida e validada por ambiente.
 *
 * A regra é recusar subir em vez de subir errado: produção com segredo de
 * exemplo, URL sem HTTPS ou e-mail gravado em arquivo local é acidente
 * esperando acontecer, então a partida derruba o processo com a lista do
 * que está faltando (nunca com o valor do segredo).
 */

export const AMBIENTES = ['desenvolvimento', 'homologacao', 'producao'] as const
export type Ambiente = (typeof AMBIENTES)[number]

const segredo = (nome: string) =>
  z
    .string({ error: `${nome} é obrigatório` })
    .min(32, `${nome} precisa de pelo menos 32 caracteres`)
    .refine((v) => !/troque|exemplo|changeme/i.test(v), `${nome} ainda está com valor de exemplo`)

const chave32 = (nome: string) =>
  z
    .string({ error: `${nome} é obrigatório` })
    .refine((v) => Buffer.from(v, 'base64').length === 32, `${nome} precisa ser 32 bytes em base64`)

const listaSeparadaPorVirgula = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )

const esquema = z
  .object({
    UJ_AMBIENTE: z.enum(AMBIENTES),
    PORTA: z.coerce.number().int().min(1).max(65535).default(3333),
    // Onde a API escuta. Padrão: só a própria máquina. No Docker, 0.0.0.0 com a
    // porta NÃO publicada no host (só o Caddy alcança).
    HOST: z.string().default('127.0.0.1'),
    // Proxies cujo X-Forwarded-For é aceito (o Caddy). Nunca `true`: com ele,
    // qualquer cliente forjaria o próprio IP e anularia os limites por IP.
    // O Caddy, por sua vez, troca o XFF pelo CF-Connecting-IP do Cloudflare.
    PROXIES_CONFIAVEIS: z
      .string()
      .default('127.0.0.1,::1')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    URL_PUBLICA: z.url(),
    // Domínio de produção, informado em homologação para a guarda abaixo. Fica
    // em configuração (não no código) para que trocar de domínio seja só config.
    URL_PUBLICA_PRODUCAO: z.url().optional(),
    // Um pool por papel do banco: rotas (uj_api) e autenticação (uj_auth).
    DATABASE_URL_API: z.string().min(1, 'DATABASE_URL_API é obrigatório'),
    DATABASE_URL_AUTH: z.string().min(1, 'DATABASE_URL_AUTH é obrigatório'),
    JWT_SEGREDO: segredo('JWT_SEGREDO'),
    CONVITE_SEGREDO: segredo('CONVITE_SEGREDO'),
    ORACAO_CHAVE: chave32('ORACAO_CHAVE'),
    TOTP_CHAVE: chave32('TOTP_CHAVE'),
    EMAIL_MODO: z.enum(['desligado', 'arquivo', 'resend']).default('desligado'),
    EMAIL_REMETENTE: z.string().optional(),
    RESEND_CHAVE: z.string().optional(),
    NOTIFICADOR_ARQUIVO: z.string().optional(),
    TURNSTILE_SEGREDO: z.string().optional(),
    // Chave PÚBLICA do widget (vai no HTML); a secreta é TURNSTILE_SEGREDO.
    TURNSTILE_CHAVE_DO_SITE: z.string().optional(),

    // Notificações push (F14). `arquivo` grava o que seria enviado (só
    // desenvolvimento e testes); `real` fala com FCM e APNs. As chaves ficam em
    // ARQUIVOS fora do git, lidos pelo caminho: o valor nunca passa pelo ambiente.
    PUSH_MODO: z.enum(['desligado', 'arquivo', 'real']).default('desligado'),
    PUSH_ARQUIVO: z.string().optional(),
    // JSON da conta de serviço do Firebase (projeto do D21), só com envio FCM.
    FCM_CONTA_SERVICO_ARQUIVO: z.string().optional(),
    // Chave .p8 do APNs (D22), seu ID, o time e o tópico (bundle do app deste ambiente).
    APNS_CHAVE_ARQUIVO: z.string().optional(),
    APNS_CHAVE_ID: z
      .string()
      .regex(/^[A-Z0-9]{10}$/, 'APNS_CHAVE_ID tem 10 letras ou números')
      .optional(),
    APNS_TIME_ID: z
      .string()
      .regex(/^[A-Z0-9]{10}$/, 'APNS_TIME_ID tem 10 letras ou números')
      .optional(),
    APNS_TOPICO: z
      .string()
      .regex(/^[a-z0-9.-]{3,120}$/, 'APNS_TOPICO é o bundle do app, ex.: com.solerte.unijovem')
      .optional(),

    // Entrar com Google e com a Apple (nunca cria conta). IDs de cliente do
    // Google aceitos no `aud` do ID token (iOS, Android e web), separados por
    // vírgula; sem valor, a entrada com Google fica desligada. Não são segredo.
    GOOGLE_CLIENT_IDS: listaSeparadaPorVirgula,
    // Bundles do app aceitos no `aud` do token da Apple. Sem valor, só o app do
    // próprio ambiente (produção: com.solerte.unijovem; os outros: .hml).
    APPLE_AUDIENCES: listaSeparadaPorVirgula,

    // Página /suporte: sem valor, a página mostra o marcador [PREENCHER] (recusado em produção).
    SUPORTE_EMAIL: z.email('SUPORTE_EMAIL precisa ser um e-mail').optional(),
    // Impressões SHA-256 dos certificados de assinatura Android (assetlinks.json),
    // separadas por vírgula. Sem valor, a lista sai vazia (recusado em produção).
    ANDROID_SHA256_IMPRESSOES: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      )
      .refine(
        (l) => l.every((x) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(x)),
        'ANDROID_SHA256_IMPRESSOES: use o formato AA:BB:... (32 pares hexadecimais)',
      ),
  })
  .superRefine((c, ctx) => {
    const falha = (mensagem: string) => ctx.addIssue({ code: 'custom', message: mensagem })

    if (c.JWT_SEGREDO === c.CONVITE_SEGREDO) {
      falha('JWT_SEGREDO e CONVITE_SEGREDO precisam ser diferentes')
    }
    if (c.ORACAO_CHAVE === c.TOTP_CHAVE) {
      falha('ORACAO_CHAVE e TOTP_CHAVE precisam ser diferentes')
    }
    if (c.EMAIL_MODO === 'resend' && (!c.RESEND_CHAVE || !c.EMAIL_REMETENTE)) {
      falha('EMAIL_MODO=resend exige RESEND_CHAVE e EMAIL_REMETENTE')
    }
    if (c.EMAIL_MODO === 'arquivo' && !c.NOTIFICADOR_ARQUIVO) {
      falha('EMAIL_MODO=arquivo exige NOTIFICADOR_ARQUIVO')
    }

    if (c.PUSH_MODO === 'arquivo' && !c.PUSH_ARQUIVO) {
      falha('PUSH_MODO=arquivo exige PUSH_ARQUIVO')
    }
    const apns = [c.APNS_CHAVE_ARQUIVO, c.APNS_CHAVE_ID, c.APNS_TIME_ID, c.APNS_TOPICO]
    if (apns.some(Boolean) && !apns.every(Boolean)) {
      falha('APNs exige APNS_CHAVE_ARQUIVO, APNS_CHAVE_ID, APNS_TIME_ID e APNS_TOPICO juntos')
    }
    if (c.PUSH_MODO === 'real' && !c.FCM_CONTA_SERVICO_ARQUIVO && !apns.every(Boolean)) {
      falha('PUSH_MODO=real exige FCM_CONTA_SERVICO_ARQUIVO ou a configuração do APNs')
    }

    if (c.UJ_AMBIENTE !== 'desenvolvimento') {
      if (c.PUSH_MODO === 'arquivo') {
        falha(`PUSH_MODO=arquivo não é permitido em ${c.UJ_AMBIENTE}`)
      }
      if (!c.URL_PUBLICA.startsWith('https://')) {
        falha(`URL_PUBLICA precisa ser https em ${c.UJ_AMBIENTE}`)
      }
      if (c.EMAIL_MODO === 'arquivo') {
        falha(`EMAIL_MODO=arquivo não é permitido em ${c.UJ_AMBIENTE}`)
      }
      if (!c.TURNSTILE_SEGREDO) {
        falha(`TURNSTILE_SEGREDO é obrigatório em ${c.UJ_AMBIENTE}`)
      }
    }
    if (c.UJ_AMBIENTE === 'producao' && /-hml\.|localhost/.test(c.URL_PUBLICA)) {
      falha('URL_PUBLICA de produção aponta para homologação ou localhost')
    }
    if (c.UJ_AMBIENTE === 'producao') {
      // Lista vazia em produção = App Links do Android sem verificação: o link
      // de convite abriria no navegador em vez do app. Homologação aceita vazio.
      if (c.ANDROID_SHA256_IMPRESSOES.length === 0) {
        falha('ANDROID_SHA256_IMPRESSOES é obrigatório em producao (assetlinks.json)')
      }
      // Sem e-mail, a página /suporte mostraria o marcador [PREENCHER].
      if (!c.SUPORTE_EMAIL) {
        falha('SUPORTE_EMAIL é obrigatório em producao (página /suporte)')
      }
    }
    if (
      c.UJ_AMBIENTE !== 'producao' &&
      c.URL_PUBLICA_PRODUCAO !== undefined &&
      new URL(c.URL_PUBLICA).host === new URL(c.URL_PUBLICA_PRODUCAO).host
    ) {
      falha('ambiente que não é produção apontando para o domínio de produção')
    }
  })

export type Config = z.infer<typeof esquema>

const APP_DO_AMBIENTE: Record<Ambiente, string> = {
  producao: 'com.solerte.unijovem',
  homologacao: 'com.solerte.unijovem.hml',
  desenvolvimento: 'com.solerte.unijovem.hml',
}

/** Públicos aceitos no token da Apple: a configuração ou, sem ela, o app do ambiente. */
export function publicosDaApple(config: Config): string[] {
  return config.APPLE_AUDIENCES.length > 0
    ? config.APPLE_AUDIENCES
    : [APP_DO_AMBIENTE[config.UJ_AMBIENTE]]
}

export class ConfigInvalida extends Error {
  constructor(public readonly problemas: string[]) {
    super(`Configuração inválida:\n- ${problemas.join('\n- ')}`)
    this.name = 'ConfigInvalida'
  }
}

/** Lê e valida. Lança `ConfigInvalida` com mensagens que nunca contêm valores. */
export function carregarConfig(env: Record<string, string | undefined>): Config {
  const resultado = esquema.safeParse(env)
  if (!resultado.success) {
    throw new ConfigInvalida(resultado.error.issues.map((i) => i.message))
  }
  return resultado.data
}
