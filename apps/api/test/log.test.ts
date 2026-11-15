import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { opcoesDoLog, redigir } from '../src/log.ts'

describe('redação de dados pessoais no log', () => {
  it('troca e-mail, telefone, JWT e token; mantém UUID e nomes de função', () => {
    const texto = redigir(
      'falha para ana.souza@exemplo.test (+55 11 91234-5678, 11912345678) ' +
        'token Zx9_Abc123def456ghi789jkl012 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc ' +
        'id 0b8e2c4a-1f2d-4e5f-8a9b-0c1d2e3f4a5b em uj.registrar_mudanca_de_preferencia',
    )
    expect(texto).not.toContain('ana.souza')
    expect(texto).not.toContain('91234')
    expect(texto).not.toContain('11912345678')
    expect(texto).not.toContain('Zx9_Abc123')
    expect(texto).not.toContain('eyJhbGci')
    expect(texto).toContain('0b8e2c4a-1f2d-4e5f-8a9b-0c1d2e3f4a5b')
    expect(texto).toContain('registrar_mudanca_de_preferencia')
    expect(texto).toContain('[e-mail]')
    expect(texto).toContain('[telefone]')
  })

  it('o log do Fastify grava IP truncado, caminho sem consulta e nenhum cabeçalho', async () => {
    const linhas: string[] = []
    const app = Fastify({
      logger: opcoesDoLog({ stream: { write: (l: string) => void linhas.push(l) } }),
      trustProxy: true,
    })
    app.get('/api/teste', async (pedido) => {
      pedido.log.warn('aviso sobre maria@exemplo.test')
      return { ok: true }
    })
    await app.inject({
      method: 'GET',
      url: '/api/teste?email=maria@exemplo.test&t=segredo',
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc',
        cookie: 'uj_refresh=abc',
        'x-forwarded-for': '203.0.113.77',
      },
    })
    await app.close()
    const tudo = linhas.join('\n')
    expect(tudo).toContain('203.0.113.0')
    expect(tudo).not.toContain('203.0.113.77')
    expect(tudo).not.toContain('maria@exemplo.test')
    expect(tudo).not.toContain('segredo')
    expect(tudo).not.toContain('Bearer')
    expect(tudo).not.toContain('uj_refresh')
    expect(tudo).toContain('/api/teste')
  })
})
