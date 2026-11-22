import {
  conferirLinkDeMusica,
  MAXIMO_DE_LINKS_DA_MUSICA,
  MAXIMO_DO_NOME_DO_LINK,
  type LinkDaMusica,
} from '@uj/dominio'

/**
 * Os links da música no formulário (D80). O formulário guarda tudo como texto (`Record<string,
 * string>`), então a lista de links viaja como JSON numa chave só ("links"), e este módulo é o
 * único que sabe ler e escrever esse texto, e validar as linhas com a regra do domínio.
 *
 * Cada linha tem um `id` só do formulário (a chave estável da lista, nunca o índice): ele não vai
 * para a API.
 */

export interface LinhaDeLink {
  id: string
  url: string
  rotulo: string
}

let contador = 0
/** Identidade de uma linha nova (só vale enquanto o formulário está aberto). */
export function novoIdDeLinha(): string {
  contador += 1
  return `link-${contador}`
}

export function linhaEmBranco(): LinhaDeLink {
  return { id: novoIdDeLinha(), url: '', rotulo: '' }
}

/** O que a API devolve (`links` da música) como linhas do formulário. */
export function linhasDosLinks(links: unknown): LinhaDeLink[] {
  if (!Array.isArray(links)) return []
  return links.flatMap((l): LinhaDeLink[] => {
    const item = l as Partial<LinkDaMusica> | null
    if (!item || typeof item.url !== 'string') return []
    return [
      {
        id: novoIdDeLinha(),
        url: item.url,
        rotulo: typeof item.rotulo === 'string' ? item.rotulo : '',
      },
    ]
  })
}

/** O texto que o formulário guarda para as linhas ('' quando não há nenhuma). */
export function escreverLinhas(linhas: readonly LinhaDeLink[]): string {
  return linhas.length === 0 ? '' : JSON.stringify(linhas)
}

/** As linhas guardadas no texto do formulário. Texto que não é a lista vira lista vazia. */
export function lerLinhas(texto: string | undefined): LinhaDeLink[] {
  if (!texto) return []
  try {
    const bruto: unknown = JSON.parse(texto)
    if (!Array.isArray(bruto)) return []
    return bruto.flatMap((l): LinhaDeLink[] => {
      const item = l as { id?: unknown; url?: unknown; rotulo?: unknown } | null
      if (!item || typeof item.url !== 'string') return []
      return [
        {
          id: typeof item.id === 'string' ? item.id : novoIdDeLinha(),
          url: item.url,
          rotulo: typeof item.rotulo === 'string' ? item.rotulo : '',
        },
      ]
    })
  } catch {
    return []
  }
}

/** A chave do erro de uma linha: `links:<id>` (endereço) e `links:<id>:rotulo` (nome). */
export const chaveDoErroDoLink = (id: string) => `links:${id}`
export const chaveDoErroDoNomeDoLink = (id: string) => `links:${id}:rotulo`

export const MENSAGENS_DOS_LINKS = {
  semEndereco: 'Cole o link, ou apague este item.',
  nomeGrande: `O nome pode ter até ${MAXIMO_DO_NOME_DO_LINK} letras.`,
  demais: `Use até ${MAXIMO_DE_LINKS_DA_MUSICA} links por música.`,
} as const

/**
 * Valida as linhas com a regra do domínio. Linha totalmente em branco é ignorada (a pessoa tocou
 * em "Adicionar link" e desistiu); nome sem endereço pede o endereço. Devolve o que vai para a
 * API (endereço sem espaços nas pontas, nome só quando preenchido) e os erros em palavras.
 */
export function validarLinhas(linhas: readonly LinhaDeLink[]): {
  erros: Record<string, string>
  links: LinkDaMusica[]
} {
  const erros: Record<string, string> = {}
  const links: LinkDaMusica[] = []
  const preenchidas = linhas.filter((l) => l.url.trim() !== '' || l.rotulo.trim() !== '')
  if (preenchidas.length > MAXIMO_DE_LINKS_DA_MUSICA) {
    erros['links'] = MENSAGENS_DOS_LINKS.demais
  }
  for (const l of preenchidas) {
    const url = l.url.trim()
    const rotulo = l.rotulo.trim()
    if (url === '') {
      erros[chaveDoErroDoLink(l.id)] = MENSAGENS_DOS_LINKS.semEndereco
      continue
    }
    const r = conferirLinkDeMusica(url)
    if (!r.ok) erros[chaveDoErroDoLink(l.id)] = r.motivo
    if (rotulo.length > MAXIMO_DO_NOME_DO_LINK) {
      erros[chaveDoErroDoNomeDoLink(l.id)] = MENSAGENS_DOS_LINKS.nomeGrande
    }
    links.push(rotulo ? { url, rotulo } : { url })
  }
  return { erros, links }
}
