import { describe, expect, it } from 'vitest'
import { carregarConfig } from '../src/config.ts'
import { criarServidor } from '../src/servidor.ts'
import { envDeTeste } from './apoio/config.ts'

describe('GET /api/saude', () => {
  it('responde ok com o ambiente', async () => {
    const app = criarServidor(carregarConfig(envDeTeste()))
    const r = await app.inject({ method: 'GET', url: '/api/saude' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ ok: true, ambiente: 'desenvolvimento' })
    await app.close()
  })
})
