import { LIMITE_DO_PDF_BYTES } from '@/servicos/contratoDoPdf'

import { formatarTamanho } from './formatos'

/**
 * Escolha do arquivo PDF (D76). O seletor do sistema (`expo-document-picker`) fica atrás desta
 * interface: os testes entregam um dublê com `trocarSeletorDePdf`, e quem quiser trocar o seletor
 * (ex.: a escolha de arquivo do `expo-file-system`) mexe só aqui.
 */

export interface ArquivoEscolhido {
  nome: string
  /** Tamanho que o sistema informou, quando informou. A conferência de verdade é nos bytes lidos. */
  tamanho: number | null
  /** Tipo que o sistema informou (`application/pdf`), quando informou. */
  tipo: string | null
  /** Lê o conteúdo. Só é chamada depois de o nome, o tipo e o tamanho passarem. */
  ler(): Promise<Uint8Array>
}

export interface SeletorDePdf {
  /** `null` quando a pessoa cancelou. */
  escolher(): Promise<ArquivoEscolhido | null>
}

/** O que o seletor do sistema devolve de cada arquivo (só os campos que usamos). */
export interface DocumentoEscolhido {
  name: string
  size?: number | undefined
  uri: string
  mimeType?: string | undefined
  /** Web: o navegador entrega o `File`. */
  file?: { arrayBuffer(): Promise<ArrayBuffer> } | undefined
}

/** Lê e apaga a cópia que o sistema fez no cache do app (celular). Carrega o módulo só quando precisa. */
async function lerEApagarCopia(uri: string): Promise<Uint8Array> {
  const { File } = await import('expo-file-system')
  const copia = new File(uri)
  try {
    return await copia.bytes()
  } finally {
    try {
      copia.delete()
    } catch {
      // O sistema limpa o cache depois.
    }
  }
}

/** Do documento do sistema para o que a tela e a conferência entendem. */
export function arquivoDoDocumento(
  d: DocumentoEscolhido,
  lerCopia: (uri: string) => Promise<Uint8Array> = lerEApagarCopia,
): ArquivoEscolhido {
  return {
    nome: d.name,
    tamanho: d.size ?? null,
    tipo: d.mimeType ?? null,
    async ler() {
      if (d.file) return new Uint8Array(await d.file.arrayBuffer())
      return lerCopia(d.uri)
    },
  }
}

/** Seletor do sistema: carregado só quando a pessoa toca em "Anexar PDF" (e nunca nos testes). */
const seletorDoSistema: SeletorDePdf = {
  async escolher() {
    const DocumentPicker = await import('expo-document-picker')
    const r = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      // No celular o sistema copia o arquivo para o cache do app, que `ler` lê e apaga em seguida.
      copyToCacheDirectory: true,
      multiple: false,
      // A web leria o arquivo inteiro em base64 só para entregar o `File`: pedimos sem.
      base64: false,
    })
    const a = r.canceled ? null : (r.assets?.[0] ?? null)
    return a ? arquivoDoDocumento(a as DocumentoEscolhido) : null
  },
}

let atual: SeletorDePdf = seletorDoSistema

/** O seletor em uso. */
export const seletorDePdf: SeletorDePdf = { escolher: () => atual.escolher() }

/** Só para testes: troca o seletor (sem argumento, volta ao do sistema). */
export function trocarSeletorDePdf(novo?: SeletorDePdf): void {
  atual = novo ?? seletorDoSistema
}

export const MENSAGEM_PDF_GRANDE = (bytes: number) =>
  `Este PDF tem ${formatarTamanho(bytes)} e o limite é de ${formatarTamanho(LIMITE_DO_PDF_BYTES)}. Escolha um arquivo menor ou reduza o PDF antes de anexar.`

export const MENSAGEM_NAO_E_PDF =
  'Este arquivo não parece ser um PDF. Escolha um arquivo com final .pdf.'

export interface PdfConferido {
  nome: string
  bytes: Uint8Array
}

/** `%PDF-` seguido do número da versão (`1.7`, `2.0`): o mesmo que a API confere. */
export function comecaComoPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  const cabeca = String.fromCharCode(...bytes.subarray(0, 8))
  return /^%PDF-[1-9]\.\d/.test(cabeca)
}

/**
 * Confere o arquivo escolhido ANTES de enviar, para a pessoa ouvir o problema na hora e em palavras
 * humanas (a API confere tudo de novo). Devolve a mensagem ou o PDF lido.
 */
export async function conferirPdfEscolhido(
  arquivo: ArquivoEscolhido,
): Promise<{ ok: true; pdf: PdfConferido } | { ok: false; mensagem: string }> {
  const nome = arquivo.nome.trim()
  const dizPdf =
    arquivo.tipo?.toLowerCase().startsWith('application/pdf') === true || /\.pdf$/i.test(nome)
  if (!dizPdf) return { ok: false, mensagem: MENSAGEM_NAO_E_PDF }
  if (arquivo.tamanho !== null && arquivo.tamanho > LIMITE_DO_PDF_BYTES) {
    return { ok: false, mensagem: MENSAGEM_PDF_GRANDE(arquivo.tamanho) }
  }
  let bytes: Uint8Array
  try {
    bytes = await arquivo.ler()
  } catch {
    return {
      ok: false,
      mensagem: 'Não deu para ler este arquivo. Escolha de novo, ou escolha outro PDF.',
    }
  }
  if (bytes.length > LIMITE_DO_PDF_BYTES) {
    return { ok: false, mensagem: MENSAGEM_PDF_GRANDE(bytes.length) }
  }
  if (!comecaComoPdf(bytes)) return { ok: false, mensagem: MENSAGEM_NAO_E_PDF }
  return { ok: true, pdf: { nome: nome || 'cifra.pdf', bytes } }
}
