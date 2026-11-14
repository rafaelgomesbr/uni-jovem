import { describe, expect, it } from 'vitest'
import { carregarConfig, ConfigInvalida } from '../src/config.ts'

const chave32 = Buffer.alloc(32, 7).toString('base64')

const base = {
  UJ_AMBIENTE: 'desenvolvimento',
  URL_PUBLICA: 'http://localhost:8081',
  DATABASE_URL: 'postgres://localhost/uj',
  JWT_SEGREDO: 'a'.repeat(40),
  CONVITE_SEGREDO: 'b'.repeat(40),
  ORACAO_CHAVE: chave32,
}

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
      }),
    ).toEqual([])
  })
})
