/**
 * PDF anexado à música (D76): formato das respostas da API e as chamadas. Só o que a tela e o
 * armazenamento local precisam; as regras (limite, assinatura, direitos) moram na API.
 *
 * O PDF vai e volta como BYTES (corpo bruto, `application/pdf`), nunca em base64 dentro de JSON, e
 * o conteúdo e o nome do arquivo nunca vão para log.
 */
import { api, type ClienteDaApi, type RespostaBinaria } from './api'

/** O mesmo teto da API e do banco (10 MB). */
export const LIMITE_DO_PDF_BYTES = 10 * 1024 * 1024

/** Resumo do PDF de uma música, sem os bytes. `versao` é o SHA-256 do arquivo, em hexadecimal. */
export interface ResumoDoPdf {
  nome: string
  tamanho: number
  versao: string
}

export interface RespostaDoPdf {
  temPdf: boolean
  pdf: ResumoDoPdf | null
}

/** Um PDF baixado: os bytes e a versão (o ETag) que o servidor deu a eles. */
export interface PdfBaixado {
  bytes: Uint8Array
  versao: string
}

const daMusica = (comunidadeId: string, musicaId: string) =>
  `/api/v1/c/${comunidadeId}/conteudos/musicas/${musicaId}/pdf`

/** Subir ou baixar até 10 MB num 4G fraco leva mais que o tempo de um pedido comum. */
export const TEMPO_LIMITE_DO_PDF_MS = 120_000

/** O mesmo download, com o cliente da API que o chamador entregar (a rodada offline e os testes). */
export async function baixarPdfCom(
  cliente: Pick<ClienteDaApi, 'pedir'>,
  comunidadeId: string,
  musicaId: string,
  versaoConhecida?: string | null,
): Promise<PdfBaixado | null> {
  const r = await cliente.pedir<RespostaBinaria>(daMusica(comunidadeId, musicaId), {
    formato: 'binario',
    tempoLimiteMs: TEMPO_LIMITE_DO_PDF_MS,
    ...(versaoConhecida ? { cabecalhos: { 'if-none-match': `"${versaoConhecida}"` } } : {}),
  })
  if (r.bytes === null) return null
  return { bytes: r.bytes, versao: r.etag ?? '' }
}

export const chamadasDoPdf = {
  /**
   * Anexa (ou troca) o PDF da música. `direitosConfirmados` é o mesmo aceite da cifra em texto: sem
   * ele a API responde 400. O nome vai na consulta (a API o limpa e nunca o registra).
   */
  enviar: (comunidadeId: string, musicaId: string, bytes: Uint8Array, nome: string) =>
    api.pedir<RespostaDoPdf>(
      `${daMusica(comunidadeId, musicaId)}?direitosConfirmados=true&nome=${encodeURIComponent(nome)}`,
      {
        metodo: 'PUT',
        corpoBinario: { dados: bytes, tipo: 'application/pdf' },
        tempoLimiteMs: TEMPO_LIMITE_DO_PDF_MS,
      },
    ),

  remover: (comunidadeId: string, musicaId: string) =>
    api.delete<RespostaDoPdf>(daMusica(comunidadeId, musicaId)),

  /**
   * Baixa o PDF. Com `versaoConhecida` (a que o aparelho já tem), o servidor responde 304 sem corpo
   * quando nada mudou: devolve `null` e o aparelho segue com a cópia dele.
   */
  baixar: (comunidadeId: string, musicaId: string, versaoConhecida?: string | null) =>
    baixarPdfCom(api, comunidadeId, musicaId, versaoConhecida),
}
