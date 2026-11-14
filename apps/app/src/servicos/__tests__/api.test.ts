import { armazenamentoEmMemoria, esperar, servidorFalso } from '@/testes/dubles'

import { criarClienteDaApi } from '../api'
import { ErroDaApi, SemConexao } from '../erros'

const EXPIRADO = {
  status: 401,
  corpo: { erro: 'acesso_expirado', mensagem: 'Entre para continuar.' },
}

describe('cliente da API', () => {
  test('três pedidos simultâneos com acesso vencido disparam UMA renovação e depois se repetem', async () => {
    const armazenamento = armazenamentoEmMemoria('refresh-1')
    const servidor = servidorFalso({
      'POST /api/auth/renovar': async () => {
        // A renovação demora: os outros 401 chegam enquanto ela está no ar.
        await esperar(20)
        return {
          status: 200,
          corpo: { segundoFator: false, acesso: 'acesso-novo', refresh: 'refresh-2' },
        }
      },
      'GET /api/v1/eu': (p) =>
        p.cabecalhos.authorization === 'Bearer acesso-novo'
          ? { status: 200, corpo: { ok: true } }
          : EXPIRADO,
    })
    const cliente = criarClienteDaApi({
      baseUrl: 'https://api.exemplo',
      plataforma: 'ios',
      armazenamento,
      fetch: servidor.fetch,
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'acesso-velho' })

    const resultados = await Promise.all([
      cliente.get('/api/v1/eu'),
      cliente.get('/api/v1/eu'),
      cliente.get('/api/v1/eu'),
    ])

    expect(resultados).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    const renovacoes = servidor.pedidos.filter((p) => p.url.endsWith('/api/auth/renovar'))
    expect(renovacoes).toHaveLength(1)
    expect(renovacoes[0]?.corpo).toEqual({ refresh: 'refresh-1' })
    expect(armazenamento.valor()).toBe('refresh-2')
    // 3 tentativas com o token velho + 1 renovação + 3 repetições.
    expect(servidor.pedidos).toHaveLength(7)
  })

  test('erro da API vira ErroDaApi com status, código e a mensagem pronta da API', async () => {
    const servidor = servidorFalso({
      'POST /api/auth/convite/aceitar': () => ({
        status: 409,
        corpo: { erro: 'ja_participa', mensagem: 'Você já participa desta comunidade.' },
      }),
    })
    const cliente = criarClienteDaApi({
      baseUrl: '',
      plataforma: 'ios',
      armazenamento: armazenamentoEmMemoria(),
      fetch: servidor.fetch,
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })

    const erro = await cliente.post('/api/auth/convite/aceitar', { token: 't' }).catch((e) => e)

    expect(erro).toBeInstanceOf(ErroDaApi)
    expect(erro).toMatchObject({
      status: 409,
      codigo: 'ja_participa',
      mensagem: 'Você já participa desta comunidade.',
    })
  })

  test('falha de rede vira SemConexao', async () => {
    const semRede = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    const cliente = criarClienteDaApi({
      baseUrl: '',
      plataforma: 'android',
      armazenamento: armazenamentoEmMemoria(),
      fetch: semRede,
    })

    const erro = await cliente
      .post('/api/auth/entrar', { email: 'a@b.c', senha: 'x' }, { autenticado: false })
      .catch((e) => e)

    expect(erro).toBeInstanceOf(SemConexao)
    expect((erro as SemConexao).mensagem).toMatch(/sem conexão/i)
  })

  test('na web, renova pelo cookie: corpo vazio, credenciais incluídas e cabeçalho anti-CSRF', async () => {
    const servidor = servidorFalso({
      'POST /api/auth/renovar': () => ({
        status: 200,
        corpo: { segundoFator: false, acesso: 'novo' },
      }),
    })
    const cliente = criarClienteDaApi({
      baseUrl: '',
      plataforma: 'web',
      armazenamento: null,
      fetch: servidor.fetch,
    })

    await expect(cliente.renovar()).resolves.toBe(true)

    const [pedido] = servidor.pedidos
    expect(pedido?.corpo).toEqual({})
    expect(pedido?.credenciais).toBe('include')
    expect(pedido?.cabecalhos['x-uj-csrf']).toBe('1')
    expect(cliente.temAcesso()).toBe(true)
  })

  test('refresh recusado apaga o refresh guardado e avisa que a sessão acabou', async () => {
    const armazenamento = armazenamentoEmMemoria('refresh-reusado')
    const servidor = servidorFalso({
      'POST /api/auth/renovar': () => ({
        status: 401,
        corpo: { erro: 'nao_autenticado', mensagem: 'Entre para continuar.' },
      }),
    })
    const cliente = criarClienteDaApi({
      baseUrl: '',
      plataforma: 'ios',
      armazenamento,
      fetch: servidor.fetch,
    })
    const perdeu = jest.fn()
    cliente.aoPerderSessao(perdeu)

    const erro = await cliente.get('/api/v1/eu').catch((e) => e)

    expect(erro).toBeInstanceOf(ErroDaApi)
    expect(armazenamento.valor()).toBeNull()
    expect(perdeu).toHaveBeenCalledTimes(1)
  })

  test('401 por código errado numa rota autenticada não derruba a sessão', async () => {
    const armazenamento = armazenamentoEmMemoria('refresh-1')
    const servidor = servidorFalso({
      'POST /api/auth/2fa/provar': () => ({
        status: 401,
        corpo: { erro: 'codigo_invalido', mensagem: 'Código incorreto ou já usado.' },
      }),
    })
    const cliente = criarClienteDaApi({
      baseUrl: '',
      plataforma: 'ios',
      armazenamento,
      fetch: servidor.fetch,
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })

    const erro = await cliente.post('/api/auth/2fa/provar', { codigo: '000000' }).catch((e) => e)

    expect(erro).toMatchObject({ codigo: 'codigo_invalido' })
    expect(cliente.temAcesso()).toBe(true)
    expect(armazenamento.valor()).toBe('refresh-1')
  })
})
