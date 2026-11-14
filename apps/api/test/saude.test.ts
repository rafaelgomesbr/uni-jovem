import { describe, expect, it } from 'vitest'
import { carregarConfig } from '../src/config.ts'
import { criarServidor } from '../src/servidor.ts'

describe('GET /api/saude', () => {
  it('responde ok com o ambiente', async () => {
    const app = criarServidor(
      carregarConfig({
        UJ_AMBIENTE: 'desenvolvimento',
        URL_PUBLICA: 'http://localhost:8081',
        DATABASE_URL: 'postgres://localhost/uj',
        JWT_SEGREDO: 'a'.repeat(40),
        CONVITE_SEGREDO: 'b'.repeat(40),
        ORACAO_CHAVE: Buffer.alloc(32, 1).toString('base64'),
      }),
    )
    const r = await app.inject({ method: 'GET', url: '/api/saude' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true, ambiente: 'desenvolvimento' })
    await app.close()
  })
})
