import { esc } from './html.ts'

/**
 * Markdown mínimo e SEGURO para as páginas de política (/privacidade, /termos,
 * /excluir-conta): títulos, parágrafos, listas, citações, tabelas, negrito,
 * itálico, código e links. Todo texto passa por `esc` antes de virar marcação,
 * e link só sai com destino relativo (`/`, `#`), `https:` ou `mailto:`; outro
 * destino vira texto. Não há HTML cru: o que estiver no arquivo aparece escapado.
 */

/** Tira as notas internas do rascunho: `[REVISÃO JURÍDICA: ...]` e `[IMPLEMENTAÇÃO: ...]`. */
export function semNotasInternas(texto: string): string {
  const marcas = ['[REVISÃO JURÍDICA', '[IMPLEMENTAÇÃO', '[A IMPLEMENTAR']
  let saida = ''
  let i = 0
  while (i < texto.length) {
    const marca = marcas.find((m) => texto.startsWith(m, i))
    if (!marca) {
      saida += texto[i]
      i++
      continue
    }
    let profundidade = 0
    let j = i
    for (; j < texto.length; j++) {
      if (texto[j] === '[') profundidade++
      else if (texto[j] === ']') {
        profundidade--
        if (profundidade === 0) break
      }
    }
    i = j + 1
  }
  // Negrito que ficou vazio (`**[A IMPLEMENTAR]**`) e espaços duplos.
  return saida.replace(/\*\*\s*\*\*/g, '').replace(/[ \t]{2,}/g, ' ')
}

/** Corta do primeiro título "Anexo" até o fim (notas para o advogado não se publicam). */
export function semAnexos(texto: string): string {
  const linhas = texto.split(/\r?\n/)
  const corte = linhas.findIndex((l) => /^#{1,6}\s+Anexo\b/i.test(l))
  return (corte >= 0 ? linhas.slice(0, corte) : linhas).join('\n')
}

export function ancora(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** `//x` e `/\x` os navegadores tratam como outro site (relativo ao protocolo). */
function destinoSeguro(url: string): boolean {
  return /^(\/(?![/\\])|#|https:\/\/|mailto:)/.test(url)
}

function inline(texto: string): string {
  const codigos: string[] = []
  let s = texto.replace(/`([^`]+)`/g, (_, c: string) => {
    codigos.push(`<code>${esc(c)}</code>`)
    return `\u0001${codigos.length - 1}\u0001`
  })
  s = esc(s)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, rotulo: string, url: string) => {
    // `url` já está escapado: o escape não altera / # : e letras.
    const cru = url.replace(/&amp;/g, '&')
    return destinoSeguro(cru) ? `<a href="${url}">${rotulo}</a>` : rotulo
  })
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u0001(\d+)\u0001/g, (_, i: string) => codigos[Number(i)] ?? '')
}

function celulas(linha: string): string[] {
  return linha
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

/**
 * Âncoras extras citadas pelos textos de consentimento e pelo app
 * (/privacidade#fe, #inscricao e #oracao, esta na tela de novo pedido de
 * oração). A seção 4 da Política, "Dado sensível: sua fé (e o que você
 * escreve na oração)", recebe #fe e #oracao.
 */
const APELIDOS: [RegExp, string][] = [
  [/sua-fe/, 'fe'],
  [/escreve-na-oracao/, 'oracao'],
  [/inscricao-publica/, 'inscricao'],
]

export function markdownParaHtml(md: string): string {
  const linhas = md.split(/\r?\n/)
  const saida: string[] = []
  let i = 0
  while (i < linhas.length) {
    const linha = linhas[i]!
    if (!linha.trim()) {
      i++
      continue
    }
    const titulo = /^(#{1,6})\s+(.*)$/.exec(linha)
    if (titulo) {
      // h1 é da página; os do documento descem um nível.
      const nivel = Math.min(6, titulo[1]!.length + 1)
      const id = ancora(titulo[2]!)
      const extra = APELIDOS.filter(([r]) => r.test(id))
        .map(([, a]) => `<span id="${a}"></span>`)
        .join('')
      saida.push(`${extra}<h${nivel} id="${id}">${inline(titulo[2]!)}</h${nivel}>`)
      i++
      continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(linha)) {
      saida.push('<hr />')
      i++
      continue
    }
    if (linha.trim().startsWith('|')) {
      const bloco: string[] = []
      while (i < linhas.length && linhas[i]!.trim().startsWith('|')) bloco.push(linhas[i++]!)
      const [cabecalho, , ...corpo] = bloco
      const th = celulas(cabecalho ?? '')
        .map((c) => `<th scope="col">${inline(c)}</th>`)
        .join('')
      const tr = corpo
        .map(
          (l) =>
            `<tr>${celulas(l)
              .map((c) => `<td>${inline(c)}</td>`)
              .join('')}</tr>`,
        )
        .join('')
      saida.push(
        `<div class="tabela"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`,
      )
      continue
    }
    if (linha.trim().startsWith('>')) {
      const bloco: string[] = []
      while (i < linhas.length && linhas[i]!.trim().startsWith('>')) {
        bloco.push(linhas[i++]!.trim().replace(/^>\s?/, ''))
      }
      saida.push(`<blockquote>${markdownParaHtml(bloco.join('\n'))}</blockquote>`)
      continue
    }
    const item = /^\s*([-*]|\d+\.)\s+/
    if (item.test(linha)) {
      const ordenada = /^\s*\d+\./.test(linha)
      const itens: string[] = []
      while (i < linhas.length && (item.test(linhas[i]!) || /^\s{2,}\S/.test(linhas[i]!))) {
        const l = linhas[i++]!
        if (item.test(l)) itens.push(l.replace(item, ''))
        else itens[itens.length - 1] += ` ${l.trim()}`
      }
      const tag = ordenada ? 'ol' : 'ul'
      saida.push(`<${tag}>${itens.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`)
      continue
    }
    const paragrafo: string[] = []
    while (
      i < linhas.length &&
      linhas[i]!.trim() &&
      !/^(#{1,6}\s|\s*>|\s*\||\s*([-*]|\d+\.)\s)/.test(linhas[i]!)
    ) {
      paragrafo.push(linhas[i++]!.trim())
    }
    saida.push(`<p>${paragrafo.map(inline).join('<br />')}</p>`)
  }
  return saida.join('\n')
}
