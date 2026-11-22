/**
 * D78: o app não impõe um dia da semana. Esta varredura reprova texto "sábado" escrito à mão nas
 * telas de `eventos` e de `escalas` ("pro app só existe sábado?"). Fica de fora o que não é texto
 * para a pessoa: comentário, o id de compatibilidade do modelo (`sabado_padrao`, `MODELO_SABADO_PADRAO`) e as tabelas de
 * nomes de dia da recorrência (`nomes.ts`), que existem para os sete dias. Dado de exemplo mora
 * nos testes, que a varredura não lê.
 */
declare const __dirname: string

type Sistema = {
  readdirSync: (p: string) => string[]
  readFileSync: (p: string, e: string) => string
}

const PASTAS = ['eventos', 'escalas'] as const
const DE_FORA = new Set(['nomes.ts'])

function arquivosDeCodigo(pasta: string): string[] {
  const fs = require('node:fs') as Sistema
  const raiz = `${__dirname}/../../${pasta}`
  return fs
    .readdirSync(raiz)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !DE_FORA.has(f))
    .map((f) => `${raiz}/${f}`)
}

/** As linhas que têm código ou texto (sem comentário de linha ou de bloco). */
function linhasDeTexto(arquivo: string): { n: number; texto: string }[] {
  const fs = require('node:fs') as Sistema
  const saida: { n: number; texto: string }[] = []
  let emBloco = false
  fs.readFileSync(arquivo, 'utf8')
    .split(/\r?\n/)
    .forEach((linha, i) => {
      const t = linha.trim()
      if (emBloco) {
        if (t.includes('*/')) emBloco = false
        return
      }
      if (t.startsWith('/*')) {
        if (!t.includes('*/')) emBloco = true
        return
      }
      if (t.startsWith('//') || t.startsWith('*')) return
      saida.push({ n: i + 1, texto: linha.replace(/\/\/.*$/, '') })
    })
  return saida
}

describe('nenhum dia da semana fixo nas telas (D78)', () => {
  test.each(PASTAS)('%s: nenhuma string com "sábado" escrita à mão', (pasta) => {
    const achados: string[] = []
    for (const arquivo of arquivosDeCodigo(pasta)) {
      for (const { n, texto } of linhasDeTexto(arquivo)) {
        // O id do modelo fica como está, por compatibilidade com o que já foi gravado.
        const semId = texto.replace(/sabado_padrao|MODELO_SABADO_PADRAO/gi, '')
        if (/s[áa]bado/i.test(semId))
          achados.push(`${arquivo.split('/').pop()}:${n}: ${texto.trim()}`)
      }
    }
    expect(achados).toEqual([])
  })

  test('a própria varredura enxerga o que procura (não passa por estar cega)', () => {
    const arquivos = arquivosDeCodigo('eventos')
    expect(arquivos.length).toBeGreaterThan(10)
    expect(arquivos.some((a) => a.endsWith('TelaIgualAoUltimo.tsx'))).toBe(true)
    const linhas = arquivos.flatMap(linhasDeTexto)
    expect(linhas.some((l) => l.texto.includes('sabado_padrao'))).toBe(true)
  })
})
