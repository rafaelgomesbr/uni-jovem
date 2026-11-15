import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { carregarConfig } from '../../src/config.ts'
import { correioDesligado } from '../../src/correio/correio.ts'
import { MENSAGEM_CONVITE_INVALIDO } from '../../src/rotas/autenticacao.ts'
import { criarServidor } from '../../src/servidor.ts'
import { novoBanco, type BancoDeTeste } from '../apoio/banco.ts'
import { envDeTeste } from '../apoio/config.ts'

/**
 * A4 e A3 da auditoria de qualidade (15/11/2026): o app aberto por muita
 * gente na mesma rede e o link de convite estragado. Servidor com os limites
 * REAIS (sem `fatorDeLimitePorIp`), e cada pedido com o IP que quiser.
 */
const config = carregarConfig(envDeTeste())
let b: BancoDeTeste
let app: ReturnType<typeof criarServidor>

beforeAll(async () => {
  b = await novoBanco()
  app = criarServidor(config, { api: b.api, auth: b.auth, correio: correioDesligado() })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await b.encerrar()
})

// Corpo vazio e sem o cabeçalho anti-CSRF: 401 sem tocar no banco, mas conta no limite.
const renovar = (ip: string) =>
  app.inject({ method: 'POST', url: '/api/auth/renovar', payload: {}, remoteAddress: ip })

describe('renovar a sessão num encontro (A4, D44)', () => {
  it('80 jovens no mesmo IP abrindo o app 7 vezes cada passam; depois, 429 humano', async () => {
    const igreja = '198.51.100.20'
    for (let i = 0; i < 600; i++) {
      const r = await renovar(igreja)
      if (r.statusCode !== 401) throw new Error(`pedido ${i + 1}: ${r.statusCode}`)
    }
    const passou = await renovar(igreja)
    expect(passou.statusCode).toBe(429)
    expect(passou.json()).toEqual({
      erro: 'muitas_tentativas',
      mensagem: 'Muita gente entrando agora. Tente de novo em instantes.',
    })
    expect(Number(passou.headers['retry-after'])).toBeGreaterThan(0)

    // Por IP inteiro: o vizinho da mesma faixa /24 (outra rede atrás do mesmo
    // provedor) não paga pelo encontro.
    expect((await renovar('198.51.100.21')).statusCode).toBe(401)
  })

  it('os outros limites de login continuam por faixa e como estavam', async () => {
    const entrar = (i: number) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/entrar',
        // Um e-mail por pedido: só o limite da faixa entra em jogo.
        payload: { email: `ninguem${i}@exemplo.test`, senha: 'errada', plataforma: 'ios' },
        remoteAddress: `192.0.2.${i + 1}`,
      })
    // 30 por faixa /24 em 15 min, IPs diferentes da mesma faixa somando juntos.
    const codigos: number[] = []
    for (let i = 0; i < 31; i++) codigos.push((await entrar(i)).statusCode)
    expect(codigos.slice(0, 30).every((c) => c === 401)).toBe(true)
    expect(codigos[30]).toBe(429)
  })
})

describe('link de convite estragado (A3)', () => {
  it('fragmento curto, lixo ou com caractere estranho: mensagem humana, nunca a do Zod', async () => {
    for (const token of ['lixo', 'x'.repeat(19), `${'a'.repeat(30)} <script>`, '']) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/auth/convite/consultar',
        payload: { token },
        remoteAddress: '203.0.113.50',
      })
      expect(r.statusCode).toBe(400)
      expect(r.json().mensagem).toBe(MENSAGEM_CONVITE_INVALIDO)
      expect(r.json().mensagem).toBe(
        'Este link de convite não é válido. Peça um novo a quem convidou você.',
      )
    }
  })

  it('corpo de cadastro sem campos: frases em português, sem texto técnico', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/convite/iniciar',
      payload: { token: 'a'.repeat(43) },
      remoteAddress: '203.0.113.51',
    })
    expect(r.statusCode).toBe(400)
    expect(r.json().mensagem).not.toMatch(/too|invalid|expected|received|string/i)
    expect(r.json().mensagem).toContain('Preencha o nome.')
  })
})
