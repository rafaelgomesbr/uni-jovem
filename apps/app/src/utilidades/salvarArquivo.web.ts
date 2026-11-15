import type { TipoDeArquivo } from './salvarArquivo'

export type { TipoDeArquivo } from './salvarArquivo'

const MIME: Readonly<Record<TipoDeArquivo, string>> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
}

/** Web: o conteúdo vira um blob e o navegador baixa com o nome do arquivo. */
export async function salvarArquivo(
  nome: string,
  conteudo: string,
  tipo: TipoDeArquivo,
): Promise<'baixado'> {
  const url = URL.createObjectURL(new Blob([conteudo], { type: MIME[tipo] }))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = nome
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return 'baixado'
  } finally {
    // Dá tempo ao navegador de começar o download antes de soltar o blob.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
