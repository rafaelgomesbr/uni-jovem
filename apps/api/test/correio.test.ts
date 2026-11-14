import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  correioDesligado,
  correioEmArquivo,
  correioResend,
  EmailDesligado,
  FalhaNoEnvio,
  semEnderecos,
  URL_DO_RESEND,
} from '../src/correio/correio.ts'

const mensagem = {
  para: 'ana@exemplo.test',
  assunto: 'Seu código',
  corpo: 'Código: 123456',
  chaveDeIdempotencia: 'k1',
}

describe('correio', () => {
  it('desligado recusa com erro próprio', async () => {
    await expect(correioDesligado().enviar(mensagem)).rejects.toBeInstanceOf(EmailDesligado)
  })

  it('arquivo grava a mensagem inteira', async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'uj-correio-'))
    const caminho = join(pasta, 'sub', 'saida.txt')
    await correioEmArquivo(caminho).enviar(mensagem)
    const texto = await readFile(caminho, 'utf8')
    expect(texto).toContain('Para: ana@exemplo.test')
    expect(texto).toContain('Código: 123456')
    await rm(pasta, { recursive: true, force: true })
  })

  it('resend monta o pedido no contrato do provedor', async () => {
    const pedidos: { url: string; init: RequestInit }[] = []
    const buscar = (async (url: string, init: RequestInit) => {
      pedidos.push({ url, init })
      return new Response('{"id":"abc"}', { status: 200 })
    }) as unknown as typeof fetch
    await correioResend({ chave: 're_teste', remetente: 'Uni Jovem <x@y.test>', buscar }).enviar(
      mensagem,
    )
    expect(pedidos).toHaveLength(1)
    expect(pedidos[0]!.url).toBe(URL_DO_RESEND)
    const h = pedidos[0]!.init.headers as Record<string, string>
    expect(h['Authorization']).toBe('Bearer re_teste')
    expect(h['Idempotency-Key']).toBe('k1')
    expect(JSON.parse(pedidos[0]!.init.body as string)).toEqual({
      from: 'Uni Jovem <x@y.test>',
      to: ['ana@exemplo.test'],
      subject: 'Seu código',
      text: 'Código: 123456',
    })
  })

  it('recusa do provedor vira erro sem o endereço do destinatário', async () => {
    const buscar = (async () =>
      new Response(
        JSON.stringify({ name: 'validation_error', message: 'Invalid `to` ana@exemplo.test' }),
        { status: 422 },
      )) as unknown as typeof fetch
    const erro = await correioResend({ chave: 'k', remetente: 'r', buscar })
      .enviar(mensagem)
      .catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(FalhaNoEnvio)
    expect((erro as FalhaNoEnvio).status).toBe(422)
    expect((erro as Error).message).not.toContain('ana@exemplo.test')
    expect((erro as Error).message).toContain('validation_error')
  })

  it('remove endereços de textos de log', () => {
    expect(semEnderecos('falhou para <ana@x.test> e bob@y.test')).toBe(
      'falhou para <[endereço]> e [endereço]',
    )
  })
})
