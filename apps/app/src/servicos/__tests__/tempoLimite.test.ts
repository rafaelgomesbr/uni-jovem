import { armazenamentoEmMemoria } from '@/testes/dubles'

import {
  criarClienteDaApi,
  TEMPO_LIMITE_ENVIO_GRANDE_MS,
  TEMPO_LIMITE_LONG_POLLING_MS,
  TEMPO_LIMITE_MS,
} from '../api'
import { ehCancelamento, mensagemDoErro, MENSAGEM_SEM_CONEXAO, SemConexao } from '../erros'

/**
 * A6: Wi-Fi de igreja ou 4G fraco. O `fetch` falso só termina quando o sinal
 * que recebeu é cancelado (como o de verdade sem resposta do servidor).
 */
function servidorPendurado(armazenamento = armazenamentoEmMemoria()) {
  const sinais: AbortSignal[] = []
  const fetchFalso = jest.fn(
    (_url: string, init: RequestInit = {}) =>
      new Promise<Response>((_resolver, rejeitar) => {
        const sinal = init.signal!
        sinais.push(sinal)
        const cancelar = () => {
          const erro = new Error('The operation was aborted.')
          erro.name = 'AbortError'
          rejeitar(erro)
        }
        // Como o fetch de verdade: sinal já cancelado rejeita na hora.
        if (sinal.aborted) cancelar()
        else sinal.addEventListener('abort', cancelar)
      }),
  )
  const cliente = criarClienteDaApi({
    baseUrl: '',
    plataforma: 'ios',
    armazenamento,
    fetch: fetchFalso as unknown as typeof fetch,
  })
  return { cliente, sinais }
}

/** Promessa que avisa quando terminou, para conferir "ainda não" no meio do relógio. */
function acompanhar<T>(p: Promise<T>) {
  const estado: { erro?: unknown; terminou: boolean } = { terminou: false }
  p.then(
    () => (estado.terminou = true),
    (erro: unknown) => {
      estado.erro = erro
      estado.terminou = true
    },
  )
  return estado
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('tempo limite dos pedidos (A6)', () => {
  test('pedido sem resposta por 20 s vira SemConexao, com a mensagem de sempre', async () => {
    const { cliente, sinais } = servidorPendurado()
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    const pedido = acompanhar(cliente.get('/api/v1/eu'))

    await jest.advanceTimersByTimeAsync(TEMPO_LIMITE_MS - 1)
    expect(pedido.terminou).toBe(false)
    await jest.advanceTimersByTimeAsync(1)

    expect(pedido.terminou).toBe(true)
    expect(pedido.erro).toBeInstanceOf(SemConexao)
    expect(mensagemDoErro(pedido.erro)).toBe(MENSAGEM_SEM_CONEXAO)
    expect(sinais[0]?.aborted).toBe(true)
  })

  test('vale também para a renovação da sessão na abertura', async () => {
    const armazenamento = armazenamentoEmMemoria('refresh-guardado')
    const { cliente } = servidorPendurado(armazenamento)
    const renovacao = acompanhar(cliente.renovar())
    await jest.advanceTimersByTimeAsync(TEMPO_LIMITE_MS)
    expect(renovacao.erro).toBeInstanceOf(SemConexao)
    // O refresh guardado não é apagado: falta de rede não encerra a sessão.
    expect(armazenamento.valor()).toBe('refresh-guardado')
  })

  test('o sinal de quem chamou continua valendo: cancelar não vira "sem conexão"', async () => {
    const { cliente, sinais } = servidorPendurado()
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    const controle = new AbortController()
    const pedido = acompanhar(cliente.get('/api/v1/eu', { sinal: controle.signal }))

    await jest.advanceTimersByTimeAsync(1_000)
    controle.abort()
    await jest.advanceTimersByTimeAsync(0)

    expect(pedido.terminou).toBe(true)
    expect(pedido.erro).not.toBeInstanceOf(SemConexao)
    expect(ehCancelamento(pedido.erro)).toBe(true)
    expect(sinais[0]?.aborted).toBe(true)
  })

  test('sinal já cancelado antes de sair: cancela na hora', async () => {
    const { cliente } = servidorPendurado()
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    const controle = new AbortController()
    controle.abort()
    const erro = await cliente.get('/api/v1/eu', { sinal: controle.signal }).catch((e) => e)
    expect(ehCancelamento(erro)).toBe(true)
  })

  test('long polling do ao vivo (o servidor segura 25 s) não estoura aos 20 s', async () => {
    const { cliente } = servidorPendurado()
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    const pedido = acompanhar(
      cliente.get('/api/v1/c/com-1/eventos/ev-1/ao-vivo?depoisDaVersao=3', {
        sinal: new AbortController().signal,
      }),
    )
    await jest.advanceTimersByTimeAsync(30_000)
    expect(pedido.terminou).toBe(false)
    await jest.advanceTimersByTimeAsync(TEMPO_LIMITE_LONG_POLLING_MS - 30_000)
    expect(pedido.erro).toBeInstanceOf(SemConexao)
  })

  test('envio grande (foto em base64) tem mais tempo; o chamador também pode escolher', async () => {
    const { cliente } = servidorPendurado()
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    const foto = acompanhar(cliente.put('/api/v1/eu/foto', { imagem: 'A'.repeat(300 * 1024) }))
    const escolhido = acompanhar(cliente.get('/api/v1/eu', { tempoLimiteMs: 5_000 }))

    await jest.advanceTimersByTimeAsync(5_000)
    expect(escolhido.erro).toBeInstanceOf(SemConexao)
    await jest.advanceTimersByTimeAsync(TEMPO_LIMITE_MS)
    expect(foto.terminou).toBe(false)
    await jest.advanceTimersByTimeAsync(TEMPO_LIMITE_ENVIO_GRANDE_MS - TEMPO_LIMITE_MS - 5_000)
    expect(foto.erro).toBeInstanceOf(SemConexao)
  })

  test('corpo da resposta que trava no meio também estoura', async () => {
    const fetchFalso = jest.fn(
      async (_url: string, init: RequestInit = {}) =>
        ({
          ok: true,
          status: 200,
          text: () =>
            new Promise<string>((_r, rejeitar) =>
              init.signal!.addEventListener('abort', () => rejeitar(new Error('abortado'))),
            ),
        }) as unknown as Response,
    )
    const cliente = criarClienteDaApi({
      baseUrl: '',
      plataforma: 'ios',
      armazenamento: armazenamentoEmMemoria(),
      fetch: fetchFalso as unknown as typeof fetch,
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    const pedido = acompanhar(cliente.get('/api/v1/eu'))
    await jest.advanceTimersByTimeAsync(TEMPO_LIMITE_MS)
    expect(pedido.erro).toBeInstanceOf(SemConexao)
  })

  test('resposta rápida não deixa relógio pendurado', async () => {
    const fetchFalso = jest.fn(
      async () => ({ ok: true, status: 200, text: async () => '{"ok":true}' }) as Response,
    )
    const cliente = criarClienteDaApi({
      baseUrl: '',
      plataforma: 'ios',
      armazenamento: armazenamentoEmMemoria(),
      fetch: fetchFalso as unknown as typeof fetch,
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    await expect(cliente.get('/api/v1/eu')).resolves.toEqual({ ok: true })
    expect(jest.getTimerCount()).toBe(0)
  })
})
