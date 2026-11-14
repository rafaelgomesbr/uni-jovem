import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  cifrar,
  decifrar,
  gerarCodigoNumerico,
  gerarToken,
  hashDeCodigo,
  hashDeSenha,
  hashDeToken,
  hmacDeToken,
  iguais,
  senhaConfere,
} from '../src/autenticacao/cripto.ts'
import { Limitador, truncarIp } from '../src/autenticacao/limitador.ts'
import { problemasDaSenha } from '../src/autenticacao/senha.ts'
import {
  base32,
  codigoTotp,
  deBase32,
  uriDeConfiguracao,
  verificarTotp,
} from '../src/autenticacao/totp.ts'

describe('senha (argon2id)', () => {
  it('confere a senha certa e recusa a errada; hash não contém a senha', async () => {
    const h = await hashDeSenha('uma frase bem comprida')
    expect(h.startsWith('$argon2id$')).toBe(true)
    expect(h).not.toContain('frase')
    expect(await senhaConfere(h, 'uma frase bem comprida')).toBe(true)
    expect(await senhaConfere(h, 'uma frase bem comprid')).toBe(false)
    expect(await senhaConfere('lixo', 'x')).toBe(false)
  })
})

describe('tokens', () => {
  it('token tem 256 bits e o hash é determinístico', () => {
    const t = gerarToken()
    expect(Buffer.from(t, 'base64url')).toHaveLength(32)
    expect(iguais(hashDeToken(t), hashDeToken(t))).toBe(true)
    expect(iguais(hashDeToken(t), hashDeToken(gerarToken()))).toBe(false)
  })

  it('HMAC depende do segredo', () => {
    const t = gerarToken()
    expect(iguais(hmacDeToken(t, 'a'.repeat(32)), hmacDeToken(t, 'b'.repeat(32)))).toBe(false)
  })

  it('código numérico tem 6 dígitos e o hash depende do sal', () => {
    for (let i = 0; i < 50; i++) expect(gerarCodigoNumerico()).toMatch(/^\d{6}$/)
    expect(iguais(hashDeCodigo('123456', 's1'), hashDeCodigo('123456', 's2'))).toBe(false)
  })
})

describe('cifragem em repouso (AES-256-GCM)', () => {
  const chave = randomBytes(32)

  it('ida e volta', () => {
    const c = cifrar(chave, 'pedido: saúde da minha mãe', 'oracao')
    expect(c.toString('utf8')).not.toContain('saúde')
    expect(decifrar(chave, c, 'oracao')).toBe('pedido: saúde da minha mãe')
  })

  it('contexto errado, chave errada ou dado adulterado não decifram', () => {
    const c = cifrar(chave, 'segredo', 'totp')
    expect(() => decifrar(chave, c, 'oracao')).toThrow()
    expect(() => decifrar(randomBytes(32), c, 'totp')).toThrow()
    const adulterado = Buffer.from(c)
    adulterado[adulterado.length - 1]! ^= 1
    expect(() => decifrar(chave, adulterado, 'totp')).toThrow()
  })

  it('recusa chave que não tem 32 bytes', () => {
    expect(() => cifrar(randomBytes(16), 'x', 'c')).toThrow(/32 bytes/)
  })
})

describe('TOTP (RFC 6238, vetores oficiais SHA-1)', () => {
  const segredo = base32(Buffer.from('12345678901234567890', 'ascii'))
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('t=%i → %s', (t, esperado) => {
    expect(codigoTotp(segredo, Math.floor(t / 30))).toBe(esperado)
  })

  it('base32 ida e volta', () => {
    const b = randomBytes(20)
    expect(deBase32(base32(b)).equals(b)).toBe(true)
  })

  it('aceita vizinho de relógio e recusa reuso do mesmo passo', () => {
    const agora = 1_700_000_000_000
    const passo = Math.floor(agora / 30_000)
    const codigo = codigoTotp(segredo, passo - 1)
    expect(verificarTotp(segredo, codigo, null, agora)).toBe(passo - 1)
    expect(verificarTotp(segredo, codigo, passo - 1, agora)).toBeNull()
    expect(verificarTotp(segredo, codigoTotp(segredo, passo - 3), null, agora)).toBeNull()
    expect(verificarTotp(segredo, 'abc123', null, agora)).toBeNull()
  })

  it('URI de configuração tem emissor e segredo', () => {
    const u = uriDeConfiguracao(segredo, 'ana@exemplo.test', 'Uni Jovem')
    expect(u).toMatch(/^otpauth:\/\/totp\/Uni%20Jovem%3Aana%40exemplo\.test\?/)
    expect(u).toContain(`secret=${segredo}`)
  })
})

describe('regras de senha', () => {
  it('aceita frase longa e incomum', () => {
    expect(problemasDaSenha('violão no luau de sábado', { nome: 'Ana Souza' })).toEqual([])
  })
  it('recusa curta, comum, repetitiva, com nome e com e-mail', () => {
    expect(problemasDaSenha('abc')).toContain('curta')
    expect(problemasDaSenha('Senha12345')).toContain('comum')
    expect(problemasDaSenha('aaaaaaaaaaaa')).toContain('repetitiva')
    expect(problemasDaSenha('rafaelaminhasenha', { nome: 'Rafaela Lima' })).toContain('contem_nome')
    expect(problemasDaSenha('joaquim.silva-2026', { email: 'joaquim.silva@x.test' })).toContain(
      'contem_email',
    )
  })
})

describe('limitador', () => {
  it('bloqueia depois do máximo e libera na janela seguinte', () => {
    let agora = 0
    const l = new Limitador(3, 60_000, () => agora)
    expect([l.tentar('k'), l.tentar('k'), l.tentar('k'), l.tentar('k')]).toEqual([
      true,
      true,
      true,
      false,
    ])
    expect(l.segundosParaLiberar('k')).toBe(60)
    expect(l.tentar('outra')).toBe(true)
    agora = 60_000
    expect(l.tentar('k')).toBe(true)
  })

  it('trunca IPs para log', () => {
    expect(truncarIp('203.0.113.77')).toBe('203.0.113.0')
    expect(truncarIp('::ffff:203.0.113.77')).toBe('203.0.113.0')
    expect(truncarIp('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::/48')
    expect(truncarIp('2001:db8::1')).toBe(truncarIp('2001:db8:0:1::1'))
  })
})
