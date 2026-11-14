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

    if (c.UJ_AMBIENTE !== 'desenvolvimento') {
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
    if (
      c.UJ_AMBIENTE !== 'producao' &&
      c.URL_PUBLICA_PRODUCAO !== undefined &&
      new URL(c.URL_PUBLICA).host === new URL(c.URL_PUBLICA_PRODUCAO).host
    ) {
      falha('ambiente que não é produção apontando para o domínio de produção')
    }
  })

export type Config = z.infer<typeof esquema>

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
