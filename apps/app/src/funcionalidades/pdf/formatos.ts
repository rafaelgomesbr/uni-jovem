/** "340 KB", "1,2 MB": o tamanho de um arquivo em texto curto, com vírgula (pt-BR). */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  const texto = mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1).replace('.', ',')
  return `${texto.endsWith(',0') ? texto.slice(0, -2) : texto} MB`
}

/** "cifra.pdf · 1,2 MB": o que a tela mostra de um PDF anexado. */
export function descricaoDoPdf(pdf: { nome: string; tamanho: number }): string {
  return `${pdf.nome} · ${formatarTamanho(pdf.tamanho)}`
}
