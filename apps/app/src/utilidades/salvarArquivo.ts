import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

export type TipoDeArquivo = 'csv' | 'json'

const MIME: Readonly<Record<TipoDeArquivo, { mime: string; uti: string }>> = {
  csv: { mime: 'text/csv', uti: 'public.comma-separated-values-text' },
  json: { mime: 'application/json', uti: 'public.json' },
}

/**
 * Celular: grava o arquivo no cache do app e abre a folha de compartilhamento
 * (salvar em Arquivos, mandar por e-mail, abrir na planilha). Depois apaga a
 * cópia do cache, para dado pessoal não ficar parado no aparelho.
 */
export async function salvarArquivo(
  nome: string,
  conteudo: string,
  tipo: TipoDeArquivo,
): Promise<'compartilhado'> {
  const arquivo = new File(Paths.cache, nome)
  try {
    arquivo.create({ overwrite: true })
    await arquivo.write(conteudo)
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Este aparelho não oferece compartilhamento de arquivos.')
    }
    await Sharing.shareAsync(arquivo.uri, {
      mimeType: MIME[tipo].mime,
      UTI: MIME[tipo].uti,
      dialogTitle: nome,
    })
    return 'compartilhado'
  } finally {
    try {
      if (arquivo.exists) arquivo.delete()
    } catch {
      // Se não apagar agora, o sistema limpa o cache depois.
    }
  }
}
