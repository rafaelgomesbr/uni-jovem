import { describe, expect, it } from 'vitest'
import { carregarConfig, ConfigInvalida } from '../src/config.ts'
import { envDeTeste } from './apoio/config.ts'

const base = envDeTeste()
const IMPRESSAO = Array.from({ length: 32 }, () => 'AB').join(':')

function problemas(env: Record<string, string | undefined>): string[] {
  try {
    carregarConfig(env)
    return []
  } catch (e) {
    if (e instanceof ConfigInvalida) return e.problemas
    throw e
  }
}

describe('carregarConfig', () => {
  it('aceita desenvolvimento mínimo e aplica padrões', () => {
    const c = carregarConfig(base)
    expect(c.PORTA).toBe(3333)
    expect(c.EMAIL_MODO).toBe('desligado')
  })

  it('recusa ambiente desconhecido', () => {
    expect(problemas({ ...base, UJ_AMBIENTE: 'teste' }).length).toBeGreaterThan(0)
  })

  it('recusa segredo curto ou de exemplo, sem ecoar o valor', () => {
    const p = problemas({ ...base, JWT_SEGREDO: 'troque-este-valor-por-um-segredo-real-123' })
    expect(p.join()).toMatch(/JWT_SEGREDO ainda está com valor de exemplo/)
    expect(p.join()).not.toMatch(/troque-este/)
    expect(problemas({ ...base, CONVITE_SEGREDO: 'curto' }).join()).toMatch(/32 caracteres/)
  })

  it('exige segredos diferentes', () => {
    expect(problemas({ ...base, CONVITE_SEGREDO: base.JWT_SEGREDO }).join()).toMatch(/diferentes/)
  })

  it('exige chave de oração de 32 bytes', () => {
    expect(problemas({ ...base, ORACAO_CHAVE: 'abc' }).join()).toMatch(/32 bytes/)
    expect(problemas({ ...base, TOTP_CHAVE: base.ORACAO_CHAVE! }).join()).toMatch(/diferentes/)
  })

  it('produção recusa http, e-mail em arquivo, falta de Turnstile e URL de homologação', () => {
    const p = problemas({
      ...base,
      UJ_AMBIENTE: 'producao',
      URL_PUBLICA: 'http://unijovem-hml.solerte.com.br',
      EMAIL_MODO: 'arquivo',
      NOTIFICADOR_ARQUIVO: '/tmp/x',
    }).join('\n')
    expect(p).toMatch(/https em producao/)
    expect(p).toMatch(/arquivo não é permitido/)
    expect(p).toMatch(/TURNSTILE_SEGREDO/)
    expect(p).toMatch(/homologação ou localhost/)
  })

  it('homologação não pode apontar para o domínio de produção', () => {
    const p = problemas({
      ...base,
      UJ_AMBIENTE: 'homologacao',
      URL_PUBLICA: 'https://unijovem.solerte.com.br',
      URL_PUBLICA_PRODUCAO: 'https://unijovem.solerte.com.br/',
      TURNSTILE_SEGREDO: 'x',
    })
    expect(p.join()).toMatch(/domínio de produção/)
  })

  it('resend exige chave e remetente', () => {
    expect(problemas({ ...base, EMAIL_MODO: 'resend' }).join()).toMatch(/RESEND_CHAVE/)
  })

  it('SMTP exige conta e remetente sem expor senha na validação', () => {
    expect(problemas({ ...base, EMAIL_MODO: 'smtp' }).join()).toMatch(/SMTP_HOST/)
    const c = carregarConfig({
      ...base,
      EMAIL_MODO: 'smtp',
      SMTP_HOST: 'smtp.exemplo.test',
      SMTP_USUARIO: 'envio@exemplo.test',
      SMTP_SENHA: 'senha-ficticia',
      EMAIL_REMETENTE: 'Uni Jovem <envio@exemplo.test>',
    })
    expect(c.SMTP_PORTA).toBe(587)
    expect(c.EMAIL_MODO).toBe('smtp')
  })

  it('aceita produção completa', () => {
    expect(
      problemas({
        ...base,
        UJ_AMBIENTE: 'producao',
        URL_PUBLICA: 'https://unijovem.solerte.com.br',
        EMAIL_MODO: 'resend',
        RESEND_CHAVE: 'rk',
        EMAIL_REMETENTE: 'Uni Jovem <nao-responda@unijovem.solerte.com.br>',
        TURNSTILE_SEGREDO: 'ts',
        SUPORTE_EMAIL: 'suporte@exemplo.test',
        ANDROID_SHA256_IMPRESSOES: IMPRESSAO,
      }),
    ).toEqual([])
  })

  it('push: arquivo exige caminho e só vale em desenvolvimento; APNs completo ou nada', () => {
    expect(problemas({ ...base, PUSH_MODO: 'arquivo' }).join()).toMatch(/PUSH_ARQUIVO/)
    expect(problemas({ ...base, PUSH_MODO: 'arquivo', PUSH_ARQUIVO: '/tmp/p' })).toEqual([])
    expect(
      problemas({
        ...base,
        UJ_AMBIENTE: 'homologacao',
        URL_PUBLICA: 'https://unijovem-hml.solerte.com.br',
        TURNSTILE_SEGREDO: 'x',
        PUSH_MODO: 'arquivo',
        PUSH_ARQUIVO: '/tmp/p',
      }).join(),
    ).toMatch(/PUSH_MODO=arquivo não é permitido/)
    expect(problemas({ ...base, APNS_CHAVE_ID: 'FXV5399926' }).join()).toMatch(/APNs exige/)
    expect(problemas({ ...base, PUSH_MODO: 'real' }).join()).toMatch(/PUSH_MODO=real exige/)
    expect(
      problemas({
        ...base,
        PUSH_MODO: 'real',
        APNS_CHAVE_ARQUIVO: '/chaves/apns.p8',
        APNS_CHAVE_ID: 'FXV5399926',
        APNS_TIME_ID: '8DVJ2U5ZKX',
        APNS_TOPICO: 'com.solerte.unijovem.hml',
      }),
    ).toEqual([])
  })

  it('impressões Android no formato SHA-256 com dois-pontos; vazio vira lista vazia', () => {
    expect(carregarConfig(base).ANDROID_SHA256_IMPRESSOES).toEqual([])
    expect(problemas({ ...base, ANDROID_SHA256_IMPRESSOES: 'AB:CD' }).join()).toMatch(
      /ANDROID_SHA256_IMPRESSOES/,
    )
  })

  it('impressões Android: homologação sobe com a lista vazia; produção recusa (M4)', () => {
    const hml = {
      ...base,
      UJ_AMBIENTE: 'homologacao',
      URL_PUBLICA: 'https://unijovem-hml.solerte.com.br',
      TURNSTILE_SEGREDO: 'x',
    }
    expect(problemas({ ...hml, ANDROID_SHA256_IMPRESSOES: '' })).toEqual([])
    expect(carregarConfig(hml).ANDROID_SHA256_IMPRESSOES).toEqual([])
    const prod = {
      ...base,
      UJ_AMBIENTE: 'producao',
      URL_PUBLICA: 'https://unijovem.solerte.com.br',
      TURNSTILE_SEGREDO: 'ts',
      SUPORTE_EMAIL: 'suporte@exemplo.test',
    }
    expect(problemas({ ...prod, ANDROID_SHA256_IMPRESSOES: '' })).toEqual([
      'ANDROID_SHA256_IMPRESSOES é obrigatório em producao (assetlinks.json)',
    ])
    expect(problemas({ ...prod, ANDROID_SHA256_IMPRESSOES: ' , ' })).toEqual([
      'ANDROID_SHA256_IMPRESSOES é obrigatório em producao (assetlinks.json)',
    ])
    expect(problemas({ ...prod, ANDROID_SHA256_IMPRESSOES: IMPRESSAO })).toEqual([])
  })

  it('produção exige o e-mail de suporte (a página /suporte não pode sair com [PREENCHER])', () => {
    const p = problemas({
      ...base,
      UJ_AMBIENTE: 'producao',
      URL_PUBLICA: 'https://unijovem.solerte.com.br',
      TURNSTILE_SEGREDO: 'ts',
      ANDROID_SHA256_IMPRESSOES: IMPRESSAO,
    })
    expect(p).toEqual(['SUPORTE_EMAIL é obrigatório em producao (página /suporte)'])
  })
})
