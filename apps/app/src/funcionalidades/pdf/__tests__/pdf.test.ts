import { ErroDaApi, ErroLocal, SemConexao } from '@/servicos/erros'
import type { PdfBaixado } from '@/servicos/contratoDoPdf'
import {
  bytesDe,
  BYTES_DO_PDF,
  OUTRA_VERSAO_DO_PDF,
  resumoDoPdfDeTeste,
  VERSAO_DO_PDF,
} from '@/testes/repertorio'

import { formatarTamanho } from '../formatos'
import {
  MENSAGEM_PDF_REMOVIDO,
  MENSAGEM_PDF_SEM_INTERNET,
  obterPdf,
  type CopiaLocalDoPdf,
  type FontesDoPdf,
} from '../obterPdf'
import {
  comecaComoPdf,
  conferirPdfEscolhido,
  MENSAGEM_NAO_E_PDF,
  MENSAGEM_PDF_GRANDE,
  seletorDePdf,
  trocarSeletorDePdf,
  type ArquivoEscolhido,
} from '../seletorDePdf'

const MB = 1024 * 1024
const pdf = resumoDoPdfDeTeste()

function arquivo(parcial: Partial<ArquivoEscolhido> = {}): ArquivoEscolhido {
  return {
    nome: 'cifra.pdf',
    tamanho: BYTES_DO_PDF.length,
    tipo: 'application/pdf',
    ler: async () => BYTES_DO_PDF,
    ...parcial,
  }
}

describe('tamanho em texto', () => {
  test.each([
    [500, '500 bytes'],
    [2048, '2 KB'],
    [340 * 1024, '340 KB'],
    [1.2 * MB, '1,2 MB'],
    [2 * MB, '2 MB'],
    [14 * MB, '14 MB'],
    [10 * MB, '10 MB'],
  ])('%d bytes: %s', (bytes, texto) => {
    expect(formatarTamanho(bytes)).toBe(texto)
  })
})

describe('conferir o arquivo escolhido antes de enviar', () => {
  test('PDF de verdade passa, com o nome e os bytes', async () => {
    const r = await conferirPdfEscolhido(arquivo())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.pdf.nome).toBe('cifra.pdf')
      expect(r.pdf.bytes).toBe(BYTES_DO_PDF)
    }
  })

  test('acima de 10 MB pelo tamanho informado: recusa sem nem ler o arquivo', async () => {
    const ler = jest.fn(async () => BYTES_DO_PDF)
    const r = await conferirPdfEscolhido(arquivo({ tamanho: 14 * MB, ler }))
    expect(r).toEqual({ ok: false, mensagem: MENSAGEM_PDF_GRANDE(14 * MB) })
    expect(ler).not.toHaveBeenCalled()
  })

  test('o sistema não informou o tamanho, mas os bytes lidos passam do limite: recusa', async () => {
    const grande = new Uint8Array(10 * MB + 1)
    grande.set(BYTES_DO_PDF)
    const r = await conferirPdfEscolhido(arquivo({ tamanho: null, ler: async () => grande }))
    expect(r.ok).toBe(false)
  })

  test('exatamente 10 MB passa', async () => {
    const no_limite = new Uint8Array(10 * MB)
    no_limite.set(BYTES_DO_PDF)
    expect(
      (await conferirPdfEscolhido(arquivo({ tamanho: 10 * MB, ler: async () => no_limite }))).ok,
    ).toBe(true)
  })

  test.each([
    ['imagem', { nome: 'foto.png', tipo: 'image/png' }],
    ['planilha', { nome: 'dados.xlsx', tipo: null }],
  ])('que não é PDF pelo nome e pelo tipo (%s): mensagem humana', async (_nome, parcial) => {
    const ler = jest.fn(async () => BYTES_DO_PDF)
    expect(await conferirPdfEscolhido(arquivo({ ...parcial, ler }))).toEqual({
      ok: false,
      mensagem: MENSAGEM_NAO_E_PDF,
    })
    expect(ler).not.toHaveBeenCalled()
  })

  test('nome .pdf mas conteúdo de outra coisa: recusa pelo conteúdo', async () => {
    const r = await conferirPdfEscolhido(
      arquivo({ ler: async () => bytesDe('<html><body>oi</body></html>') }),
    )
    expect(r).toEqual({ ok: false, mensagem: MENSAGEM_NAO_E_PDF })
  })

  test('o sistema diz application/pdf mesmo sem a extensão no nome: vale', async () => {
    expect((await conferirPdfEscolhido(arquivo({ nome: 'cifra-sem-extensao' }))).ok).toBe(true)
  })

  test('arquivo que não abre: mensagem humana, sem termo técnico', async () => {
    const r = await conferirPdfEscolhido(
      arquivo({
        ler: async () => {
          throw new Error('EACCES: permission denied')
        },
      }),
    )
    expect(r).toEqual({
      ok: false,
      mensagem: 'Não deu para ler este arquivo. Escolha de novo, ou escolha outro PDF.',
    })
  })

  test('a assinatura confere %PDF- e o número da versão', () => {
    expect(comecaComoPdf(bytesDe('%PDF-1.7\n'))).toBe(true)
    expect(comecaComoPdf(bytesDe('%PDF-2.0\n'))).toBe(true)
    expect(comecaComoPdf(bytesDe('%PDF-'))).toBe(false)
    expect(comecaComoPdf(bytesDe('GIF89a......'))).toBe(false)
  })
})

describe('o seletor é trocável (dublê)', () => {
  afterEach(() => trocarSeletorDePdf())

  test('o dublê responde no lugar do seletor do sistema; cancelar devolve null', async () => {
    trocarSeletorDePdf({ escolher: async () => arquivo({ nome: 'do-duble.pdf' }) })
    expect((await seletorDePdf.escolher())?.nome).toBe('do-duble.pdf')
    trocarSeletorDePdf({ escolher: async () => null })
    expect(await seletorDePdf.escolher()).toBeNull()
  })
})

describe('de onde sai o PDF (aparelho ou rede)', () => {
  const local = (versao = VERSAO_DO_PDF): CopiaLocalDoPdf => ({ versao, bytes: BYTES_DO_PDF })
  const baixado = (versao = VERSAO_DO_PDF): PdfBaixado => ({
    versao,
    bytes: bytesDe('%PDF-1.4\n% da rede\n'),
  })

  function fontes(parcial: Partial<FontesDoPdf> = {}) {
    const f = {
      lerLocal: jest.fn(async () => null as CopiaLocalDoPdf | null),
      baixar: jest.fn(async () => baixado() as PdfBaixado | null),
      ...parcial,
    }
    return f as typeof f & FontesDoPdf
  }

  test('cópia na versão certa: abre do aparelho, sem tocar na rede', async () => {
    const f = fontes({ lerLocal: jest.fn(async () => local()) })
    const r = await obterPdf('mus-1', pdf, f)
    expect(r).toMatchObject({ origem: 'aparelho', desatualizado: false, versao: VERSAO_DO_PDF })
    expect(f.baixar).not.toHaveBeenCalled()
  })

  test('sem cópia: baixa pela rede', async () => {
    const f = fontes()
    const r = await obterPdf('mus-1', pdf, f)
    expect(r.origem).toBe('rede')
    expect(f.baixar).toHaveBeenCalledWith('mus-1', null)
  })

  test('cópia de outra versão: baixa mandando a versão que tem (ETag); o 304 mantém a cópia', async () => {
    const f = fontes({
      lerLocal: jest.fn(async () => local(OUTRA_VERSAO_DO_PDF)),
      baixar: jest.fn(async () => null),
    })
    const r = await obterPdf('mus-1', pdf, f)
    expect(f.baixar).toHaveBeenCalledWith('mus-1', OUTRA_VERSAO_DO_PDF)
    expect(r).toMatchObject({ origem: 'aparelho', desatualizado: false })
  })

  test('sem internet com cópia de versão antiga: abre a que há, avisando que pode estar desatualizada', async () => {
    const f = fontes({
      lerLocal: jest.fn(async () => local(OUTRA_VERSAO_DO_PDF)),
      baixar: jest.fn(async () => {
        throw new SemConexao()
      }),
    })
    expect(await obterPdf('mus-1', pdf, f)).toMatchObject({
      origem: 'aparelho',
      desatualizado: true,
    })
  })

  test('sem internet e sem cópia: texto claro de o que fazer', async () => {
    const f = fontes({
      baixar: jest.fn(async () => {
        throw new SemConexao()
      }),
    })
    await expect(obterPdf('mus-1', pdf, f)).rejects.toMatchObject({
      mensagem: MENSAGEM_PDF_SEM_INTERNET,
    })
    await expect(obterPdf('mus-1', pdf, f)).rejects.toBeInstanceOf(ErroLocal)
  })

  test('404: o PDF foi removido, e a cópia antiga não é mostrada como se valesse', async () => {
    const f = fontes({
      lerLocal: jest.fn(async () => local(OUTRA_VERSAO_DO_PDF)),
      baixar: jest.fn(async () => {
        throw new ErroDaApi(404, 'nao_encontrado', 'Não encontramos o que você procurou.')
      }),
    })
    await expect(obterPdf('mus-1', pdf, f)).rejects.toMatchObject({
      mensagem: MENSAGEM_PDF_REMOVIDO,
    })
  })

  test('leitura local que falha não impede de baixar', async () => {
    const f = fontes({
      lerLocal: jest.fn(async () => {
        throw new Error('banco fechado')
      }),
    })
    expect((await obterPdf('mus-1', pdf, f)).origem).toBe('rede')
  })

  test('outros erros da API sobem como são (a tela mostra a mensagem dela)', async () => {
    const f = fontes({
      baixar: jest.fn(async () => {
        throw new ErroDaApi(500, 'interno', 'Algo deu errado do nosso lado.')
      }),
    })
    await expect(obterPdf('mus-1', pdf, f)).rejects.toMatchObject({ status: 500 })
  })
})
