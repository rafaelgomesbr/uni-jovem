import { ErroLocal } from '@/servicos/erros'
import { BYTES_DO_PDF, mesmosBytes } from '@/testes/repertorio'

import { abrirPdfNoSistema, limparPdfsAbertos, MENSAGEM_SEM_LEITOR_DE_PDF } from '../abrirPdf'
import { arquivoDoDocumento } from '../seletorDePdf'

/**
 * O visualizador do sistema (D76): grava o PDF no cache do app, numa pasta só dele, e abre no
 * Quick Look (iOS) ou na intenção de visualização (Android). Aqui o `expo-file-system` é um dublê
 * que guarda o "disco" em memória e registra o que foi pré-visualizado.
 */

interface Estado {
  arquivos: Map<string, Uint8Array>
  pastas: Set<string>
  previas: { uri: string; titulo?: string; mimeType?: string }[]
  podeAbrir: boolean
  falhaNaPrevia: boolean
}

jest.mock('expo-file-system', () => {
  const estado: Estado = {
    arquivos: new Map(),
    pastas: new Set(),
    previas: [],
    podeAbrir: true,
    falhaNaPrevia: false,
  }
  const caminho = (partes: unknown[]) =>
    partes
      .map((p) => (typeof p === 'object' && p ? (p as { uri: string }).uri : String(p)))
      .join('/')
  class Directory {
    uri: string
    constructor(...partes: unknown[]) {
      this.uri = caminho(partes)
    }
    get exists() {
      return estado.pastas.has(this.uri)
    }
    create() {
      estado.pastas.add(this.uri)
    }
    delete() {
      estado.pastas.delete(this.uri)
      for (const k of [...estado.arquivos.keys()])
        if (k.startsWith(`${this.uri}/`)) estado.arquivos.delete(k)
    }
  }
  class File {
    uri: string
    constructor(...partes: unknown[]) {
      this.uri = caminho(partes)
    }
    get exists() {
      return estado.arquivos.has(this.uri)
    }
    create() {
      estado.arquivos.set(this.uri, new Uint8Array())
    }
    async write(bytes: Uint8Array) {
      estado.arquivos.set(this.uri, bytes)
    }
    async canPreview() {
      return estado.podeAbrir
    }
    async preview(opcoes: { title?: string; mimeType?: string }) {
      if (estado.falhaNaPrevia) throw new Error('sem app')
      estado.previas.push({ uri: this.uri, ...opcoes })
    }
  }
  return { File, Directory, Paths: { cache: 'file:///cache' }, __estado: estado }
})

const estado = (jest.requireMock('expo-file-system') as { __estado: Estado }).__estado

beforeEach(() => {
  estado.arquivos.clear()
  estado.pastas.clear()
  estado.previas.length = 0
  estado.podeAbrir = true
  estado.falhaNaPrevia = false
})

describe('abrir o PDF no visualizador do sistema', () => {
  test('grava no cache, numa pasta só do app, com nome local seguro, e pede a pré-visualização como PDF', async () => {
    const r = await abrirPdfNoSistema(BYTES_DO_PDF, 'Cifra: Grande é o Senhor (v2).pdf')

    expect(r).toBe('aberto')
    expect(estado.previas).toHaveLength(1)
    expect(estado.previas[0]).toMatchObject({
      uri: 'file:///cache/uj-pdf/Cifra-Grande-e-o-Senhor-v2.pdf',
      title: 'Cifra: Grande é o Senhor (v2).pdf',
      mimeType: 'application/pdf',
    })
    const gravado = estado.arquivos.get('file:///cache/uj-pdf/Cifra-Grande-e-o-Senhor-v2.pdf')
    expect(mesmosBytes(gravado!, BYTES_DO_PDF)).toBe(true)
  })

  test('cada abertura esvazia a pasta: só o PDF aberto agora fica no cache', async () => {
    await abrirPdfNoSistema(BYTES_DO_PDF, 'primeiro.pdf')
    await abrirPdfNoSistema(BYTES_DO_PDF, 'segundo.pdf')
    expect([...estado.arquivos.keys()]).toEqual(['file:///cache/uj-pdf/segundo.pdf'])
  })

  test('sair da conta ou da comunidade limpa a pasta inteira', async () => {
    await abrirPdfNoSistema(BYTES_DO_PDF, 'x.pdf')
    limparPdfsAbertos()
    expect(estado.arquivos.size).toBe(0)
    expect(estado.pastas.size).toBe(0)
    // Sem pasta, limpar não é erro.
    expect(() => limparPdfsAbertos()).not.toThrow()
  })

  test('nome sem letras aproveitáveis cai no nome padrão', async () => {
    await abrirPdfNoSistema(BYTES_DO_PDF, '???.pdf')
    expect(estado.previas[0]!.uri).toBe('file:///cache/uj-pdf/cifra.pdf')
  })

  test('aparelho sem leitor de PDF: mensagem humana do que fazer (nunca erro técnico)', async () => {
    estado.podeAbrir = false
    await expect(abrirPdfNoSistema(BYTES_DO_PDF, 'x.pdf')).rejects.toMatchObject({
      mensagem: MENSAGEM_SEM_LEITOR_DE_PDF,
    })
    estado.podeAbrir = true
    estado.falhaNaPrevia = true
    await expect(abrirPdfNoSistema(BYTES_DO_PDF, 'x.pdf')).rejects.toBeInstanceOf(ErroLocal)
  })
})

describe('do documento do sistema para o arquivo escolhido', () => {
  test('web: lê do `File` do navegador', async () => {
    const buffer = BYTES_DO_PDF.buffer.slice(
      BYTES_DO_PDF.byteOffset,
      BYTES_DO_PDF.byteOffset + BYTES_DO_PDF.byteLength,
    )
    const a = arquivoDoDocumento({
      name: 'cifra.pdf',
      size: BYTES_DO_PDF.length,
      uri: 'blob:x',
      mimeType: 'application/pdf',
      file: { arrayBuffer: async () => buffer as ArrayBuffer },
    })
    expect(a).toMatchObject({
      nome: 'cifra.pdf',
      tamanho: BYTES_DO_PDF.length,
      tipo: 'application/pdf',
    })
    expect(mesmosBytes(await a.ler(), BYTES_DO_PDF)).toBe(true)
  })

  test('celular: lê a cópia do cache e informa tamanho e tipo nulos quando o sistema não os dá', async () => {
    const lerCopia = jest.fn(async () => BYTES_DO_PDF)
    const a = arquivoDoDocumento(
      { name: 'a.pdf', uri: 'file:///cache/DocumentPicker/a.pdf' },
      lerCopia,
    )
    expect(a.tamanho).toBeNull()
    expect(a.tipo).toBeNull()
    expect(await a.ler()).toBe(BYTES_DO_PDF)
    expect(lerCopia).toHaveBeenCalledWith('file:///cache/DocumentPicker/a.pdf')
  })
})
