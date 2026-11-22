import { armazenamentoEmMemoria, esperar, servidorFalso } from '@/testes/dubles'
import { bytesDe, mesmosBytes } from '@/testes/repertorio'

import { api, criarClienteDaApi } from '../api'
import { baixarPdfCom, chamadasDoPdf } from '../contratoDoPdf'
import { ErroDaApi, SemConexao } from '../erros'

/**
 * Corpo binário no cliente da API (D76): o PDF sobe e desce como bytes, nunca em JSON nem em
 * base64, com o token da sessão, o ETag em `If-None-Match` e 304 sem corpo.
 */

const COM = '11111111-1111-4111-8111-111111111111'
const MUSICA = '99999999-9999-4999-8999-000000000001'
const CAMINHO = `/api/v1/c/${COM}/conteudos/musicas/${MUSICA}/pdf`
const BYTES = bytesDe('%PDF-1.4\n% bytes de teste\n%%EOF\n')
const VERSAO = 'd'.repeat(64)

function clienteCom(rotas: Parameters<typeof servidorFalso>[0]) {
  const servidor = servidorFalso(rotas)
  const cliente = criarClienteDaApi({
    baseUrl: 'https://api.exemplo',
    plataforma: 'ios',
    armazenamento: armazenamentoEmMemoria('refresh-1'),
    fetch: servidor.fetch,
  })
  return { servidor, cliente }
}

describe('enviar bytes', () => {
  test('o corpo vai como bytes, com o tipo application/pdf e o token, e a resposta é JSON', async () => {
    const { servidor, cliente } = clienteCom({
      [`PUT ${CAMINHO}`]: () => ({
        status: 200,
        corpo: { temPdf: true, pdf: { nome: 'x.pdf', tamanho: BYTES.length, versao: VERSAO } },
      }),
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'acesso-1' })

    const r = await cliente.pedir<{ temPdf: boolean }>(`${CAMINHO}?direitosConfirmados=true`, {
      metodo: 'PUT',
      corpoBinario: { dados: BYTES, tipo: 'application/pdf' },
    })

    expect(r.temPdf).toBe(true)
    const pedido = servidor.pedidos[0]!
    expect(pedido.cabecalhos['content-type']).toBe('application/pdf')
    expect(pedido.cabecalhos['authorization']).toBe('Bearer acesso-1')
    expect(pedido.corpo).toBeUndefined()
    expect(mesmosBytes(pedido.bytes!, BYTES)).toBe(true)
  })

  test('`chamadasDoPdf.enviar` leva o aceite e o nome (com acento) codificados na consulta', async () => {
    const { servidor, cliente } = clienteCom({
      [`PUT ${CAMINHO}`]: () => ({ status: 200, corpo: { temPdf: true, pdf: null } }),
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    // O módulo usa o cliente único do app: aponta o `fetch` global para o servidor deste teste.
    globalThis.fetch = servidor.fetch
    api.definirAcesso('a')

    await chamadasDoPdf.enviar(COM, MUSICA, BYTES, 'Cifra: Grande é o Senhor (v2).pdf')

    const url = servidor.pedidos[0]!.url
    expect(url).toContain('direitosConfirmados=true')
    expect(url).toContain(`nome=${encodeURIComponent('Cifra: Grande é o Senhor (v2).pdf')}`)
  })

  test('erro 413 e 415 da API chegam com a mensagem humana dela', async () => {
    const { cliente } = clienteCom({
      [`PUT ${CAMINHO}`]: () => ({
        status: 413,
        corpo: {
          erro: 'grande_demais',
          mensagem: 'O envio passou do tamanho permitido. Use um arquivo menor e tente de novo.',
        },
      }),
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    await expect(
      cliente.pedir(CAMINHO, {
        metodo: 'PUT',
        corpoBinario: { dados: BYTES, tipo: 'application/pdf' },
      }),
    ).rejects.toMatchObject({
      status: 413,
      mensagem: 'O envio passou do tamanho permitido. Use um arquivo menor e tente de novo.',
    })
  })
})

describe('baixar bytes', () => {
  test('devolve os bytes e o ETag sem as aspas', async () => {
    const { servidor, cliente } = clienteCom({
      [`GET ${CAMINHO}`]: () => ({
        status: 200,
        bytes: BYTES,
        cabecalhos: { ETag: `"${VERSAO}"`, 'Content-Type': 'application/pdf' },
      }),
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })

    const r = await baixarPdfCom(cliente, COM, MUSICA)

    expect(r).not.toBeNull()
    expect(mesmosBytes(r!.bytes, BYTES)).toBe(true)
    expect(r!.versao).toBe(VERSAO)
    expect(servidor.pedidos[0]!.cabecalhos['accept']).toContain('application/pdf')
    expect(servidor.pedidos[0]!.cabecalhos['if-none-match']).toBeUndefined()
  })

  test('com a versão que já tem, manda If-None-Match e o 304 vira null (nada a baixar)', async () => {
    const { servidor, cliente } = clienteCom({
      [`GET ${CAMINHO}`]: (p) =>
        p.cabecalhos['if-none-match'] === `"${VERSAO}"`
          ? { status: 304, cabecalhos: { etag: `"${VERSAO}"` } }
          : { status: 200, bytes: BYTES, cabecalhos: { etag: `"${VERSAO}"` } },
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })

    expect(await baixarPdfCom(cliente, COM, MUSICA, VERSAO)).toBeNull()
    expect(servidor.pedidos[0]!.cabecalhos['if-none-match']).toBe(`"${VERSAO}"`)
    // Outra versão conhecida: o servidor manda o arquivo.
    expect(await baixarPdfCom(cliente, COM, MUSICA, 'e'.repeat(64))).not.toBeNull()
  })

  test('404 vira ErroDaApi, e a rede fora vira SemConexao', async () => {
    const { cliente } = clienteCom({
      [`GET ${CAMINHO}`]: () => ({
        status: 404,
        corpo: { erro: 'nao_encontrado', mensagem: 'Não encontramos o que você procurou.' },
      }),
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'a' })
    await expect(baixarPdfCom(cliente, COM, MUSICA)).rejects.toBeInstanceOf(ErroDaApi)

    const semRede = criarClienteDaApi({
      baseUrl: 'https://api.exemplo',
      plataforma: 'ios',
      armazenamento: armazenamentoEmMemoria('r'),
      fetch: (async () => {
        await esperar(1)
        throw new TypeError('Network request failed')
      }) as unknown as typeof fetch,
    })
    await semRede.abrirSessao({ segundoFator: false, acesso: 'a' })
    await expect(baixarPdfCom(semRede, COM, MUSICA)).rejects.toBeInstanceOf(SemConexao)
  })

  test('o token vencido é renovado uma vez e o download se repete', async () => {
    let tentativas = 0
    const { servidor, cliente } = clienteCom({
      'POST /api/auth/renovar': () => ({
        status: 200,
        corpo: { segundoFator: false, acesso: 'acesso-novo', refresh: 'refresh-2' },
      }),
      [`GET ${CAMINHO}`]: (p) => {
        tentativas++
        return p.cabecalhos['authorization'] === 'Bearer acesso-novo'
          ? { status: 200, bytes: BYTES, cabecalhos: { etag: `"${VERSAO}"` } }
          : { status: 401, corpo: { erro: 'acesso_expirado', mensagem: 'Entre para continuar.' } }
      },
    })
    await cliente.abrirSessao({ segundoFator: false, acesso: 'acesso-velho' })

    const r = await baixarPdfCom(cliente, COM, MUSICA)

    expect(r?.versao).toBe(VERSAO)
    expect(tentativas).toBe(2)
    expect(servidor.pedidos.filter((p) => p.url.endsWith('/api/auth/renovar'))).toHaveLength(1)
  })
})
