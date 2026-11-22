/**
 * Web: o PDF vira um blob e abre numa aba nova, no leitor do próprio navegador (D76). Se o
 * navegador barrar a aba (a pessoa tocou, esperou o download e o bloqueador de janelas já não
 * reconhece o toque), o arquivo é baixado com o nome dele, e o chamador diz isso à pessoa.
 */

/** Na web não há pasta para esvaziar: o endereço do blob é solto depois de um tempo. */
export function limparPdfsAbertos(): void {}

export const MENSAGEM_SEM_LEITOR_DE_PDF =
  'Este navegador não conseguiu abrir o PDF. Ele foi baixado: abra o arquivo baixado.'

export async function abrirPdfNoSistema(
  bytes: Uint8Array,
  nome: string,
): Promise<'aberto' | 'baixado'> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  // O blob fica de pé por um minuto: tempo de a aba nova carregar e de a pessoa usar "Salvar".
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  const janela = window.open(url, '_blank')
  if (janela) {
    janela.opener = null
    return 'aberto'
  }
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  return 'baixado'
}
