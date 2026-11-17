import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import nodemailer from 'nodemailer'

/**
 * Envio de e-mail transacional. Três modos (`EMAIL_MODO`):
 *  - desligado: recusa enviar (o fluxo que depende de e-mail mostra o caminho alternativo);
 *  - arquivo: grava a mensagem inteira num arquivo local (só desenvolvimento e testes;
 *    a configuração recusa este modo fora de desenvolvimento);
 *  - resend: POST https://api.resend.com/emails com Bearer, sem SDK
 *    (contrato em https://resend.com/docs/api-reference/emails/send-email).
 *
 * Mensagens são texto puro. Erros nunca carregam o endereço do destinatário
 * nem o corpo (que pode ter link de convite ou código), para não irem a log.
 */

export interface Mensagem {
  para: string
  assunto: string
  corpo: string
  /** Mesmo valor = o provedor não envia duas vezes (repetição de pedido). */
  chaveDeIdempotencia?: string
}

export interface Correio {
  readonly modo: 'desligado' | 'arquivo' | 'resend' | 'smtp'
  enviar(m: Mensagem): Promise<void>
}

export class EmailDesligado extends Error {
  constructor() {
    super('envio de e-mail desligado neste ambiente')
    this.name = 'EmailDesligado'
  }
}

export class FalhaNoEnvio extends Error {
  constructor(
    public readonly status: number | null,
    public readonly razao: string,
  ) {
    super(`falha no envio de e-mail (status ${status ?? 'sem resposta'}): ${razao}`)
    this.name = 'FalhaNoEnvio'
  }
}

export function correioDesligado(): Correio {
  return {
    modo: 'desligado',
    async enviar() {
      throw new EmailDesligado()
    },
  }
}

export function correioEmArquivo(caminho: string): Correio {
  return {
    modo: 'arquivo',
    async enviar(m) {
      await mkdir(dirname(caminho), { recursive: true })
      const bloco = [
        '----- mensagem',
        `Para: ${m.para}`,
        `Assunto: ${m.assunto}`,
        '',
        m.corpo,
        '',
      ].join('\n')
      await appendFile(caminho, bloco, 'utf8')
    },
  }
}

export const URL_DO_RESEND = 'https://api.resend.com/emails'

/** Envio pelo SMTP existente, com TLS obrigatório e sem registrar credenciais. */
export function correioSmtp(opcoes: {
  host: string
  porta: number
  usuario: string
  senha: string
  remetente: string
}): Correio {
  const transporte = nodemailer.createTransport({
    host: opcoes.host,
    port: opcoes.porta,
    secure: opcoes.porta === 465,
    requireTLS: true,
    auth: { user: opcoes.usuario, pass: opcoes.senha },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    logger: false,
    debug: false,
  })
  return {
    modo: 'smtp',
    async enviar(m) {
      try {
        await transporte.sendMail({
          from: opcoes.remetente,
          to: m.para,
          subject: m.assunto,
          text: m.corpo,
          disableFileAccess: true,
          disableUrlAccess: true,
        })
      } catch (erro) {
        // O servidor SMTP pode ecoar destinatário, credenciais ou corpo no erro.
        // Conserva só o código técnico e o status numérico.
        const e = erro as { code?: string; responseCode?: number }
        throw new FalhaNoEnvio(e.responseCode ?? null, `SMTP ${e.code ?? 'indisponivel'}`)
      }
    },
  }
}

/** Tira endereços de e-mail de um texto que vai para log. */
export function semEnderecos(texto: string): string {
  return texto.replace(/[^\s@<>"']+@[^\s@<>"']+/g, '[endereço]')
}

export function correioResend(opcoes: {
  chave: string
  remetente: string
  buscar?: typeof fetch
  tempoLimiteMs?: number
}): Correio {
  const buscar = opcoes.buscar ?? fetch
  return {
    modo: 'resend',
    async enviar(m) {
      const cabecalhos: Record<string, string> = {
        Authorization: `Bearer ${opcoes.chave}`,
        'Content-Type': 'application/json',
      }
      if (m.chaveDeIdempotencia) cabecalhos['Idempotency-Key'] = m.chaveDeIdempotencia
      let resposta: Response
      try {
        resposta = await buscar(URL_DO_RESEND, {
          method: 'POST',
          headers: cabecalhos,
          body: JSON.stringify({
            from: opcoes.remetente,
            to: [m.para],
            subject: m.assunto,
            text: m.corpo,
          }),
          signal: AbortSignal.timeout(opcoes.tempoLimiteMs ?? 10_000),
        })
      } catch (e) {
        throw new FalhaNoEnvio(null, semEnderecos((e as Error).message))
      }
      if (!resposta.ok) {
        const texto = await resposta.text().catch(() => '')
        let razao = texto
        try {
          const corpo = JSON.parse(texto) as { message?: unknown; name?: unknown }
          razao = [corpo.name, corpo.message].filter((x) => typeof x === 'string').join(': ')
        } catch {
          // não é JSON: usa o texto cru
        }
        throw new FalhaNoEnvio(resposta.status, semEnderecos(razao).slice(0, 300))
      }
    },
  }
}
