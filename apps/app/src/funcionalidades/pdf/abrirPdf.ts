import { Directory, File, Paths } from 'expo-file-system'

import { ErroLocal } from '@/servicos/erros'

/**
 * Abre o PDF no visualizador do próprio sistema (D76): o Quick Look no iPhone (tela cheia, com
 * "OK" para voltar) e o aplicativo de PDF do Android (intenção de visualização, o botão Voltar do
 * sistema volta para cá). Sem WebView e sem biblioteca de PDF: o iOS e o Android já leem PDF
 * melhor que qualquer visualizador embutido, com zoom, páginas e busca.
 *
 * O arquivo vai para o CACHE do app, numa pasta só dele, e a pasta é esvaziada antes de cada
 * abertura e ao sair da conta (`limparPdfsAbertos`): nada de cifra fica parada no aparelho. O nome
 * e o conteúdo nunca vão a log.
 */

const PASTA = 'uj-pdf'

function pasta(): Directory {
  return new Directory(Paths.cache, PASTA)
}

/** Apaga os PDFs que ficaram no cache de aberturas anteriores. */
export function limparPdfsAbertos(): void {
  try {
    const p = pasta()
    if (p.exists) p.delete()
  } catch {
    // O sistema limpa o cache sozinho quando precisa de espaço.
  }
}

/** Nome local seguro: só letras, números, ponto, hífen e sublinhado, sempre terminando em .pdf. */
function nomeLocal(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'cifra'}.pdf`
}

export const MENSAGEM_SEM_LEITOR_DE_PDF =
  'Este aparelho não tem um aplicativo para abrir PDF. Instale um leitor de PDF e tente de novo.'

/** `aberto`: o visualizador do sistema foi apresentado. `baixado` só acontece na web. */
export async function abrirPdfNoSistema(
  bytes: Uint8Array,
  nome: string,
): Promise<'aberto' | 'baixado'> {
  limparPdfsAbertos()
  const p = pasta()
  p.create({ intermediates: true, idempotent: true })
  const arquivo = new File(p, nomeLocal(nome))
  arquivo.create({ overwrite: true })
  await arquivo.write(bytes)
  const pode = await arquivo.canPreview({ mimeType: 'application/pdf' }).catch(() => false)
  if (!pode) throw new ErroLocal(MENSAGEM_SEM_LEITOR_DE_PDF)
  try {
    await arquivo.preview({ title: nome, mimeType: 'application/pdf' })
  } catch {
    throw new ErroLocal(MENSAGEM_SEM_LEITOR_DE_PDF)
  }
  return 'aberto'
}
