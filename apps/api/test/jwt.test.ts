import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import {
  DURACAO_ACESSO_S,
  doisFatoresRecente,
  emitirAcesso,
  verificarAcesso,
} from '../src/autenticacao/jwt.ts'

const segredo = 's'.repeat(48)
const agora = 1_800_000_000

describe('token de acesso', () => {
  it('emite e verifica, sem papel nem comunidade no token', async () => {
    const t = await emitirAcesso(
      segredo,
      { contaId: 'c1', sessaoId: 's1', mfaEm: null, prova: null },
      agora,
    )
    const r = await verificarAcesso(segredo, t, agora + 60)
    expect(r).toEqual({
      ok: true,
      conteudo: { contaId: 'c1', sessaoId: 's1', mfaEm: null, prova: null },
    })
    const corpo = JSON.parse(Buffer.from(t.split('.')[1]!, 'base64url').toString())
    expect(Object.keys(corpo).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'sid', 'sub'])
  })

  it('expira em 15 minutos', async () => {
    const t = await emitirAcesso(
      segredo,
      { contaId: 'c1', sessaoId: 's1', mfaEm: null, prova: null },
      agora,
    )
    expect(await verificarAcesso(segredo, t, agora + DURACAO_ACESSO_S + 1)).toEqual({
      ok: false,
      motivo: 'expirado',
    })
  })

  it('recusa segredo errado, alg none e token de outro emissor', async () => {
    const t = await emitirAcesso(
      segredo,
      { contaId: 'c1', sessaoId: 's1', mfaEm: null, prova: null },
      agora,
    )
    expect((await verificarAcesso('x'.repeat(48), t, agora)).ok).toBe(false)
    const [, corpo] = t.split('.')
    const semAssinatura = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${corpo}.`
    expect((await verificarAcesso(segredo, semAssinatura, agora)).ok).toBe(false)
    const outro = await new SignJWT({ sid: 's1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('c1')
      .setIssuer('outro')
      .setAudience('unijovem-api')
      .setExpirationTime(agora + 60)
      .sign(new TextEncoder().encode(segredo))
    expect((await verificarAcesso(segredo, outro, agora)).ok).toBe(false)
  })

  it('2FA recente vale por 10 minutos', async () => {
    const t = await emitirAcesso(
      segredo,
      { contaId: 'c1', sessaoId: 's1', mfaEm: agora, prova: null },
      agora,
    )
    const r = await verificarAcesso(segredo, t, agora)
    if (!r.ok) throw new Error('esperava ok')
    expect(doisFatoresRecente(r.conteudo, agora + 600)).toBe(true)
    expect(doisFatoresRecente(r.conteudo, agora + 601)).toBe(false)
    expect(doisFatoresRecente({ ...r.conteudo, mfaEm: null, prova: null }, agora)).toBe(false)
  })
})
