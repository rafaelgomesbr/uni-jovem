/**
 * Links da música (D80): até 3 endereços do Google Drive/Docs ou do YouTube, cada um com um
 * nome opcional ("Cifra no Drive", "Versão ao vivo"). É a regra ÚNICA: o app valida com ela antes
 * de enviar, a API valida de novo e o banco confere pela mesma lista de endereços
 * (`uj.link_de_musica_valido`, migração 0031). Se a lista mudar aqui, muda lá.
 *
 * O link é só uma referência: abre no aplicativo ou no navegador do sistema. O conteúdo do outro
 * lado não é guardado, e o endereço nunca vai para log (só o id da música).
 */

export type TipoDeLinkDeMusica = 'youtube' | 'drive'

/** Os únicos endereços aceitos, em minúsculas e sem porta: o servidor precisa ser exatamente um deles. */
export const ENDERECOS_DO_DRIVE = ['drive.google.com', 'docs.google.com'] as const
export const ENDERECOS_DO_YOUTUBE = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
] as const

export const MAXIMO_DE_LINKS_DA_MUSICA = 3
export const MAXIMO_DO_ENDERECO_DO_LINK = 2000
export const MAXIMO_DO_NOME_DO_LINK = 40

export interface LinkDaMusica {
  url: string
  /** Nome curto para a pessoa reconhecer o link. Opcional. */
  rotulo?: string
}

export type ResultadoDoLink = { ok: true; tipo: TipoDeLinkDeMusica } | { ok: false; motivo: string }

export const MENSAGENS_DO_LINK = {
  semHttps:
    'O link precisa começar com https://. Cole o endereço inteiro, do jeito que está no Drive ou no YouTube.',
  comEspaco: 'O link não pode ter espaços nem quebras de linha. Cole só o endereço.',
  comSenha: 'Esse link traz usuário e senha. Cole o endereço sem eles.',
  outroSite: 'Só dá para usar links do Google Drive ou do YouTube. Cole o link de um deles.',
  longo: `Esse link é muito longo (até ${MAXIMO_DO_ENDERECO_DO_LINK} letras).`,
} as const

// Espaços, controles e os separadores de linha do Unicode, escritos por código (o arquivo não os contém).
const ESPACOS_E_CONTROLES = new RegExp(
  // eslint-disable-next-line no-control-regex
  '[\\s\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]',
  'u',
)
const COMECA_COM_HTTPS = /^https:\/\//i
/** O trecho entre `https://` e a primeira `/`, `?` ou `#` (onde ficam usuário, senha, servidor e porta). */
const AUTORIDADE = /^https:\/\/([^/?#]*)/i

/** Confere o endereço do link e diz o tipo (YouTube ou Drive) ou o motivo, em palavras. */
export function conferirLinkDeMusica(bruto: string): ResultadoDoLink {
  const url = bruto.trim()
  if (url.length > MAXIMO_DO_ENDERECO_DO_LINK) return { ok: false, motivo: MENSAGENS_DO_LINK.longo }
  if (!COMECA_COM_HTTPS.test(url)) return { ok: false, motivo: MENSAGENS_DO_LINK.semHttps }
  if (ESPACOS_E_CONTROLES.test(url)) return { ok: false, motivo: MENSAGENS_DO_LINK.comEspaco }
  const autoridade = AUTORIDADE.exec(url)?.[1] ?? ''
  if (autoridade.includes('@')) return { ok: false, motivo: MENSAGENS_DO_LINK.comSenha }
  // Sem porta e sem barra invertida: o servidor tem de ser exatamente um da lista.
  const servidor = autoridade.toLowerCase()
  if ((ENDERECOS_DO_YOUTUBE as readonly string[]).includes(servidor)) {
    return { ok: true, tipo: 'youtube' }
  }
  if ((ENDERECOS_DO_DRIVE as readonly string[]).includes(servidor)) {
    return { ok: true, tipo: 'drive' }
  }
  return { ok: false, motivo: MENSAGENS_DO_LINK.outroSite }
}

/** O tipo do link, ou `null` se o endereço não é aceito. */
export function tipoDoLinkDeMusica(url: string): TipoDeLinkDeMusica | null {
  const r = conferirLinkDeMusica(url)
  return r.ok ? r.tipo : null
}

/** "Abrir no YouTube" ou "Abrir no Drive": o texto do botão. */
export function textoDeAbrirLink(tipo: TipoDeLinkDeMusica): string {
  return tipo === 'youtube' ? 'Abrir no YouTube' : 'Abrir no Drive'
}

/** "YouTube", "Drive" ou "YouTube e Drive": o resumo em texto para as linhas de lista. */
export function resumoDosLinksDaMusica(links: readonly LinkDaMusica[] | null | undefined): string {
  const tipos = new Set((links ?? []).map((l) => tipoDoLinkDeMusica(l.url)))
  const nomes = [tipos.has('youtube') ? 'YouTube' : null, tipos.has('drive') ? 'Drive' : null]
  return nomes.filter(Boolean).join(' e ')
}

/** Só os links que passam na regra (o que vem de fora nunca é aberto sem conferir). */
export function linksAbriveisDaMusica(
  links: readonly LinkDaMusica[] | null | undefined,
): (LinkDaMusica & { tipo: TipoDeLinkDeMusica })[] {
  const abriveis: (LinkDaMusica & { tipo: TipoDeLinkDeMusica })[] = []
  for (const l of links ?? []) {
    const r = conferirLinkDeMusica(l.url)
    if (r.ok) abriveis.push({ ...l, url: l.url.trim(), tipo: r.tipo })
  }
  return abriveis
}
