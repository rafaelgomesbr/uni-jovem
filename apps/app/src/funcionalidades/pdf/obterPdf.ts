import type { PdfBaixado, ResumoDoPdf } from '@/servicos/contratoDoPdf'
import { ErroDaApi, ErroLocal, SemConexao } from '@/servicos/erros'

/**
 * De onde sai o PDF que a pessoa vai abrir (D76): a cópia guardada no aparelho, quando é a
 * versão certa (abre sem internet e sem gastar dados), ou a rede. A versão é o SHA-256 do arquivo,
 * o mesmo ETag da API: o aparelho só baixa de novo se a versão mudou. Os bytes nunca vão a log.
 */

export interface CopiaLocalDoPdf {
  versao: string
  bytes: Uint8Array
}

export interface FontesDoPdf {
  /** A cópia guardada: a da `versao` pedida, ou a mais recente que houver. Nula sem cópia. */
  lerLocal(musicaId: string, versao: string): Promise<CopiaLocalDoPdf | null>
  /** Baixa pela API. Nulo quando o servidor respondeu 304 (a versão conhecida continua valendo). */
  baixar(musicaId: string, versaoConhecida: string | null): Promise<PdfBaixado | null>
}

export interface PdfObtido {
  bytes: Uint8Array
  versao: string
  origem: 'aparelho' | 'rede'
  /** Sem internet, abriu a cópia que há, de uma versão mais antiga que a atual. */
  desatualizado: boolean
}

export const MENSAGEM_PDF_SEM_INTERNET =
  'Sem internet, e este PDF não está guardado neste aparelho. Conecte-se para abri-lo, ou baixe o repertório com a internet ligada para tocar sem rede.'

export const MENSAGEM_PDF_REMOVIDO =
  'Este PDF foi removido da música. Volte e atualize a lista para ver o que ficou.'

export async function obterPdf(
  musicaId: string,
  pdf: ResumoDoPdf,
  fontes: FontesDoPdf,
): Promise<PdfObtido> {
  const local = await fontes.lerLocal(musicaId, pdf.versao).catch(() => null)
  if (local && local.versao === pdf.versao) {
    return { bytes: local.bytes, versao: local.versao, origem: 'aparelho', desatualizado: false }
  }
  try {
    const baixado = await fontes.baixar(musicaId, local?.versao ?? null)
    if (baixado) {
      return { bytes: baixado.bytes, versao: baixado.versao, origem: 'rede', desatualizado: false }
    }
    // 304: a versão que o aparelho já tem é a atual.
    if (local) {
      return { bytes: local.bytes, versao: local.versao, origem: 'aparelho', desatualizado: false }
    }
    throw new ErroLocal('O PDF não chegou. Tente de novo.')
  } catch (e) {
    if (e instanceof SemConexao) {
      if (local) {
        return { bytes: local.bytes, versao: local.versao, origem: 'aparelho', desatualizado: true }
      }
      throw new ErroLocal(MENSAGEM_PDF_SEM_INTERNET)
    }
    if (e instanceof ErroDaApi && e.status === 404) throw new ErroLocal(MENSAGEM_PDF_REMOVIDO)
    throw e
  }
}
