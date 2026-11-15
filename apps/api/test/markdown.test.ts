import { describe, expect, it } from 'vitest'
import { markdownParaHtml, semAnexos, semNotasInternas } from '../src/publico/markdown.ts'

describe('markdown das páginas de política', () => {
  it('escapa HTML do documento e só aceita link relativo, https ou mailto', () => {
    const html = markdownParaHtml(
      [
        '# Título <script>alert(1)</script>',
        'Texto com <img src=x onerror=alert(1)> e [interno](/termos), [externo](https://exemplo.test),',
        '[perigoso](javascript:alert(1)) e [relativo](outro-arquivo.md).',
      ].join('\n'),
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('<a href="/termos">interno</a>')
    expect(html).toContain('<a href="https://exemplo.test">externo</a>')
    // Destino não permitido vira texto: o link some.
    expect(html).not.toContain('href="javascript')
    expect(html).not.toContain('href="outro-arquivo.md"')
  })

  it('recusa destino relativo ao protocolo: // e /\\ levam a outro site', () => {
    const html = markdownParaHtml(
      '[a](//malicioso.test/x) [b](/\\malicioso.test/x) [c](/\\/malicioso.test) [ok](/termos)',
    )
    expect(html).not.toContain('href="//')
    expect(html).not.toContain('href="/\\')
    expect(html).not.toContain('<a href="/\\')
    expect(html).toContain('<a href="/termos">ok</a>')
  })

  it('tabelas, listas, citação, negrito e código', () => {
    const html = markdownParaHtml(
      ['| A | B |', '| - | - |', '| **x** | `y` |', '', '- um', '- dois', '', '> citação'].join(
        '\n',
      ),
    )
    expect(html).toContain('<th scope="col">A</th>')
    expect(html).toContain('<td><strong>x</strong></td>')
    expect(html).toContain('<code>y</code>')
    expect(html).toContain('<ul><li>um</li><li>dois</li></ul>')
    expect(html).toContain('<blockquote><p>citação</p></blockquote>')
  })

  it('tira notas para o advogado, notas de implementação e o anexo', () => {
    const texto = semNotasInternas(
      'Antes [REVISÃO JURÍDICA: ver [link](x) e mais] depois **[A IMPLEMENTAR]** fim [IMPLEMENTAÇÃO: algo].',
    )
    expect(texto).toBe('Antes depois fim .')
    expect(semAnexos('# Política\n\nTexto\n\n## Anexo (não publicar)\nSegredo')).not.toContain(
      'Segredo',
    )
  })
})
