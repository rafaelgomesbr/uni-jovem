import type { ClienteDaApi, RespostaBinaria } from '@/servicos/api'
import type { PacoteDoRepertorio, PacoteInalterado } from '@/servicos/contratoV3'
import { ErroDaApi, SemConexao } from '@/servicos/erros'
import { criarDeposito } from '@/funcionalidades/offline/deposito'
import {
  atualizarRepertorios,
  baixarRepertorio,
  caminhoDoRepertorio,
} from '@/funcionalidades/offline/repertorioOffline'
import { EVENTO_ID } from '@/testes/fixturas'
import { limparAparelho, sqlite } from '@/testes/offline'
import {
  bytesDe,
  BYTES_DO_PDF,
  mesmosBytes,
  itensComPdfDeTeste,
  NOME_DO_PDF,
  OUTRA_VERSAO_DO_PDF,
  pacoteDoRepertorioDeTeste,
  VERSAO_DO_PDF,
} from '@/testes/repertorio'
import { COMUNIDADE } from '@/testes/telas'

/**
 * PDF da música no repertório para tocar sem internet (D76): o pacote traz só a referência
 * (versão = SHA-256); o aparelho baixa o binário para a mesma partição cifrada, só se a versão
 * mudou, e apaga junto com a cópia do repertório. Nada do arquivo vai a log.
 */

const CONTA = 'conta-eu'
const CAMINHO_DO_PDF = (musicaId: string) =>
  `/api/v1/c/${COMUNIDADE}/conteudos/musicas/${musicaId}/pdf`

function pacoteComPdf(parcial: Partial<PacoteDoRepertorio> = {}): PacoteDoRepertorio {
  return pacoteDoRepertorioDeTeste({ itens: itensComPdfDeTeste(), ...parcial })
}

/**
 * Servidor do pacote e do PDF: o pacote responde "inalterado" para a versão que o aparelho já tem; o
 * PDF responde 304 para o ETag que o aparelho já tem, ou os bytes com o ETag atual.
 */
function servidor(inicial: PacoteDoRepertorio) {
  const estado: {
    pacote: PacoteDoRepertorio
    versaoDoPdf: string
    bytes: Uint8Array
    erroDoPdf: unknown
    erroDoPacote: unknown
  } = {
    pacote: inicial,
    versaoDoPdf: VERSAO_DO_PDF,
    bytes: BYTES_DO_PDF,
    erroDoPdf: null,
    erroDoPacote: null,
  }
  const pedidosDoPdf: { caminho: string; ifNoneMatch: string | undefined }[] = []
  const pedidosDoPacote: string[] = []
  const get = jest.fn(async (caminho: string): Promise<PacoteDoRepertorio | PacoteInalterado> => {
    pedidosDoPacote.push(caminho)
    if (estado.erroDoPacote) throw estado.erroDoPacote
    const versao = new URL(`http://x${caminho}`).searchParams.get('versao')
    if (versao === estado.pacote.versao) return { versao, inalterado: true }
    return estado.pacote
  })
  const pedir = jest.fn(
    async (caminho: string, opcoes?: { cabecalhos?: Record<string, string> }) => {
      const ifNoneMatch = opcoes?.cabecalhos?.['if-none-match']
      pedidosDoPdf.push({ caminho, ifNoneMatch })
      if (estado.erroDoPdf) throw estado.erroDoPdf
      if (ifNoneMatch === `"${estado.versaoDoPdf}"`) {
        return { bytes: null, etag: estado.versaoDoPdf } satisfies RespostaBinaria
      }
      return { bytes: estado.bytes, etag: estado.versaoDoPdf } satisfies RespostaBinaria
    },
  )
  const cliente = { get, pedir } as unknown as Pick<ClienteDaApi, 'get' | 'pedir'>
  return { cliente, estado, pedidosDoPdf, pedidosDoPacote, pedir }
}

async function particaoVazia(deposito = criarDeposito()) {
  return deposito.criar(
    { contaId: CONTA, comunidadeId: COMUNIDADE, vinculoId: null, validadeDias: 7 },
    new Date(),
  )
}

beforeEach(() => limparAparelho())

describe('baixar o repertório com PDF', () => {
  test('primeira vez: guarda o PDF na partição cifrada, na versão do pacote, e o resumo conta', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())

    expect(await baixarRepertorio(p, s.cliente, EVENTO_ID)).toBe('baixado')

    const guardado = await p.lerPdf('mus-1', VERSAO_DO_PDF)
    expect(guardado).not.toBeNull()
    expect(guardado!.versao).toBe(VERSAO_DO_PDF)
    expect(guardado!.nome).toBe(NOME_DO_PDF)
    expect(mesmosBytes(guardado!.bytes, BYTES_DO_PDF)).toBe(true)
    expect(s.pedidosDoPdf).toEqual([{ caminho: CAMINHO_DO_PDF('mus-1'), ifNoneMatch: undefined }])
    expect(await p.resumoDosRepertorios()).toEqual([
      expect.objectContaining({ eventoId: EVENTO_ID, musicas: 2, pdfs: 1, pdfsBaixados: 1 }),
    ])
    // O PDF vive no arquivo do banco cifrado de cada partição (a chave está no cofre).
    for (const arquivo of sqlite.__arquivos.values()) expect(arquivo.chave).toMatch(/^"x'/)
  })

  test('só baixa o binário de novo se a versão mudou: pacote igual não repete o PDF', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())
    await baixarRepertorio(p, s.cliente, EVENTO_ID)

    expect(await baixarRepertorio(p, s.cliente, EVENTO_ID)).toBe('em_dia')

    expect(s.pedidosDoPdf).toHaveLength(1)
    expect(s.pedidosDoPacote[1]).toContain('?versao=')
  })

  test('PDF trocado: o pacote muda, o aparelho baixa o novo mandando o ETag do antigo', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())
    await baixarRepertorio(p, s.cliente, EVENTO_ID)

    const novo = bytesDe('%PDF-1.7\n% versao nova\n%%EOF\n')
    s.estado.bytes = novo
    s.estado.versaoDoPdf = OUTRA_VERSAO_DO_PDF
    s.estado.pacote = pacoteComPdf({
      versao: 'versao-2',
      itens: itensComPdfDeTeste().map((i, n) =>
        n === 0 ? { ...i, pdf: { ...i.pdf!, versao: OUTRA_VERSAO_DO_PDF } } : i,
      ),
    })

    expect(await baixarRepertorio(p, s.cliente, EVENTO_ID)).toBe('atualizado')

    expect(s.pedidosDoPdf[1]).toEqual({
      caminho: CAMINHO_DO_PDF('mus-1'),
      ifNoneMatch: `"${VERSAO_DO_PDF}"`,
    })
    const guardado = await p.lerPdf('mus-1', OUTRA_VERSAO_DO_PDF)
    expect(guardado?.versao).toBe(OUTRA_VERSAO_DO_PDF)
    expect(mesmosBytes(guardado!.bytes, novo)).toBe(true)
    // Uma música, um PDF: o antigo foi substituído, não acumulado.
    expect(await p.versoesDosPdfs(EVENTO_ID)).toEqual({ 'mus-1': OUTRA_VERSAO_DO_PDF })
  })

  test('o PDF saiu da música: a cópia local sai junto na rodada seguinte', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())
    await baixarRepertorio(p, s.cliente, EVENTO_ID)
    s.estado.pacote = pacoteDoRepertorioDeTeste({ versao: 'versao-2' })

    await baixarRepertorio(p, s.cliente, EVENTO_ID)

    expect(await p.lerPdf('mus-1')).toBeNull()
    expect(await p.versoesDosPdfs(EVENTO_ID)).toEqual({})
  })

  test('falha do PDF (sem internet) não derruba o repertório: o resumo diz que falta, e a próxima rodada baixa', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())
    s.estado.erroDoPdf = new SemConexao()

    expect(await baixarRepertorio(p, s.cliente, EVENTO_ID)).toBe('baixado')

    // A cifra em texto chegou; o PDF não. "Pronto" ainda não vale: pdfsBaixados < pdfs.
    expect((await p.lerRepertorio(EVENTO_ID))?.pacote.itens).toHaveLength(2)
    expect(await p.lerPdf('mus-1')).toBeNull()
    expect(await p.resumoDosRepertorios()).toEqual([
      expect.objectContaining({ pdfs: 1, pdfsBaixados: 0 }),
    ])

    // Mesmo com o pacote igual ("em_dia"), o que ficou para trás é baixado.
    s.estado.erroDoPdf = null
    expect(await baixarRepertorio(p, s.cliente, EVENTO_ID)).toBe('em_dia')
    expect(await p.resumoDosRepertorios()).toEqual([
      expect.objectContaining({ pdfs: 1, pdfsBaixados: 1 }),
    ])
  })

  test('um PDF antigo guardado não conta como pronto para a versão nova', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())
    await baixarRepertorio(p, s.cliente, EVENTO_ID)
    s.estado.versaoDoPdf = OUTRA_VERSAO_DO_PDF
    s.estado.erroDoPdf = new SemConexao()
    s.estado.pacote = pacoteComPdf({
      versao: 'versao-2',
      itens: itensComPdfDeTeste().map((i, n) =>
        n === 0 ? { ...i, pdf: { ...i.pdf!, versao: OUTRA_VERSAO_DO_PDF } } : i,
      ),
    })

    await baixarRepertorio(p, s.cliente, EVENTO_ID)

    // O PDF antigo ainda abre sem rede (melhor que nada), mas o aparelho não está "pronto".
    expect((await p.lerPdf('mus-1', OUTRA_VERSAO_DO_PDF))?.versao).toBe(VERSAO_DO_PDF)
    expect(await p.resumoDosRepertorios()).toEqual([
      expect.objectContaining({ pdfs: 1, pdfsBaixados: 0 }),
    ])
  })

  test('sem o cliente completo (só `get`), a cifra em texto baixa e o PDF espera', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())

    await baixarRepertorio(p, { get: s.cliente.get }, EVENTO_ID)

    expect(await p.lerRepertorio(EVENTO_ID)).not.toBeNull()
    expect(await p.lerPdf('mus-1')).toBeNull()
  })

  test('repertório sem PDF não faz nenhum pedido de arquivo', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteDoRepertorioDeTeste())
    await baixarRepertorio(p, s.cliente, EVENTO_ID)
    expect(s.pedir).not.toHaveBeenCalled()
    expect(await p.resumoDosRepertorios()).toEqual([
      expect.objectContaining({ pdfs: 0, pdfsBaixados: 0 }),
    ])
  })
})

describe('o PDF sai junto com a cópia', () => {
  test('tirar o repertório do aparelho apaga os PDFs dele', async () => {
    const p = await particaoVazia()
    await baixarRepertorio(p, servidor(pacoteComPdf()).cliente, EVENTO_ID)
    expect(await p.lerPdf('mus-1')).not.toBeNull()

    await p.removerRepertorio(EVENTO_ID)

    expect(await p.lerPdf('mus-1')).toBeNull()
    expect(await p.lerRepertorio(EVENTO_ID)).toBeNull()
  })

  test('sair da comunidade (apagar a partição) apaga o arquivo do banco, PDFs inclusive', async () => {
    const deposito = criarDeposito()
    const p = await particaoVazia(deposito)
    await baixarRepertorio(p, servidor(pacoteComPdf()).cliente, EVENTO_ID)
    expect(sqlite.__despejar()).toContain('repertorio_pdfs')

    await deposito.apagar(CONTA, COMUNIDADE)

    expect(sqlite.__despejar()).not.toContain('repertorio_pdfs')
    expect(await deposito.abrir(CONTA, COMUNIDADE)).toBeNull()
  })

  test('403 e 404 do pacote: a cópia, o PDF incluído, sai do aparelho', async () => {
    for (const status of [403, 404]) {
      limparAparelho()
      const p = await particaoVazia()
      const s = servidor(pacoteComPdf())
      await baixarRepertorio(p, s.cliente, EVENTO_ID)
      s.estado.erroDoPacote = new ErroDaApi(status, 'x', 'sem acesso')

      await atualizarRepertorios(p, s.cliente)

      expect(await p.lerRepertorio(EVENTO_ID)).toBeNull()
      expect(await p.lerPdf('mus-1')).toBeNull()
    }
  })

  test('36 h depois do início do encontro, o PDF sai com o repertório', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())
    await baixarRepertorio(p, s.cliente, EVENTO_ID)
    const inicio = Date.parse((await p.lerRepertorio(EVENTO_ID))!.pacote.evento.inicio)

    await atualizarRepertorios(p, s.cliente, () => new Date(inicio + 36 * 3600_000 + 60_000))

    expect(await p.lerPdf('mus-1')).toBeNull()
  })

  test('sem conexão na rodada, a cópia e o PDF continuam abrindo', async () => {
    const p = await particaoVazia()
    const s = servidor(pacoteComPdf())
    await baixarRepertorio(p, s.cliente, EVENTO_ID)
    s.estado.erroDoPacote = new SemConexao()

    await atualizarRepertorios(p, s.cliente)

    expect(await p.lerPdf('mus-1', VERSAO_DO_PDF)).not.toBeNull()
  })
})

describe('sem conteúdo em log', () => {
  test('nem o nome nem os bytes do PDF vão para console em nenhuma etapa', async () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined),
    )
    try {
      const p = await particaoVazia()
      const s = servidor(pacoteComPdf())
      await baixarRepertorio(p, s.cliente, EVENTO_ID)
      s.estado.erroDoPdf = new SemConexao()
      await atualizarRepertorios(p, s.cliente)
      s.estado.erroDoPdf = null
      await baixarRepertorio(p, s.cliente, EVENTO_ID)
      const tudo = espioes
        .flatMap((e) => e.mock.calls)
        .flat()
        .map(String)
        .join('\n')
      expect(tudo).not.toContain(NOME_DO_PDF)
      expect(tudo).not.toContain('cifra inventada')
      expect(tudo).not.toContain('%PDF')
    } finally {
      espioes.forEach((e) => e.mockRestore())
    }
  })
})

test('o caminho do pacote não mudou', () => {
  expect(caminhoDoRepertorio(COMUNIDADE, EVENTO_ID)).toBe(
    `/api/v1/c/${COMUNIDADE}/eventos/${EVENTO_ID}/repertorio/pacote`,
  )
})
