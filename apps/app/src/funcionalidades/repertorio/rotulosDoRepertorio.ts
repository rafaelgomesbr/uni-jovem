import {
  formatarDuracaoDaMusica,
  metadadosDaCifra,
  resumoDosLinksDaMusica,
  type LinkDaMusica,
} from '@uj/dominio'

import type { ItemDoRepertorio } from '@/servicos/contratoDoRepertorio'

interface DadosDaMusica {
  tomDoDia: string | null
  tomOriginal: string | null
  andamentoBpm: number | null
  duracaoSeg: number | null
  artista?: string | null
  /** Cifra inteira (Meu repertório): sem ela não há como saber do capotraste que a cifra declara. */
  cifra?: string | null
  /** Só a informação de que há cifra (lista do repertório, que não traz o texto). */
  temCifra?: boolean
  /** PDF anexado (D76): com PDF a música não está "sem cifra", e a linha diz "PDF" em texto. */
  temPdf?: boolean
  /** Links do Drive e do YouTube (D80): a linha diz "Links: YouTube" em texto, sem abrir nada. */
  links?: readonly LinkDaMusica[] | null
}

/**
 * "Tom A (original G) · Capotraste 2 · 72 bpm · 4:05": o que a linha de uma música do repertório
 * diz, sempre em texto. O capotraste só aparece quando a própria cifra o declara (`{capo: 2}`).
 */
export function descricaoDaMusica(d: DadosDaMusica, { artista = false } = {}): string {
  const partes: string[] = []
  const tom = d.tomDoDia ?? d.tomOriginal
  if (!tom) {
    partes.push('Tom não informado')
  } else if (d.tomDoDia && d.tomOriginal && d.tomDoDia !== d.tomOriginal) {
    partes.push(`Tom ${d.tomDoDia} (original ${d.tomOriginal})`)
  } else {
    partes.push(`Tom ${tom}`)
  }
  const capo = d.cifra ? metadadosDaCifra(d.cifra).capotraste : null
  if (capo) partes.push(`Capotraste ${capo}`)
  if (d.andamentoBpm) partes.push(`${d.andamentoBpm} bpm`)
  const duracao = formatarDuracaoDaMusica(d.duracaoSeg)
  if (duracao) partes.push(duracao)
  const semCifra = d.cifra !== undefined ? !(d.cifra && d.cifra.trim()) : d.temCifra === false
  if (d.temPdf) partes.push(semCifra ? 'PDF' : 'Cifra e PDF')
  else if (semCifra) partes.push('Sem cifra')
  const links = resumoDosLinksDaMusica(d.links)
  if (links) partes.push(`Links: ${links}`)
  if (artista && d.artista) partes.push(`de ${d.artista}`)
  return partes.join(' · ')
}

/**
 * O que a linha de uma música do repertório do encontro diz, em texto: "Tom A (original G) · 72 bpm ·
 * 4:05 · de Novo Tom". O artista vem com "de", para não ler como "mudou de tom" (auditoria de UX, 44).
 */
export function descricaoDoItem(item: ItemDoRepertorio): string {
  return descricaoDaMusica(
    {
      tomDoDia: item.tomDoDia,
      tomOriginal: item.tomOriginal,
      andamentoBpm: item.andamentoBpm,
      duracaoSeg: item.duracaoSeg,
      artista: item.artista,
      temCifra: item.temCifra,
      temPdf: item.temPdf === true,
      ...(item.links ? { links: item.links } : {}),
    },
    { artista: true },
  )
}

/** "Sua parte: Violão" ou "Sua parte: Vocal e Violão" (sem repetir a mesma função). */
export function textoDaParte(funcoes: readonly string[]): string {
  const unicas = [...new Set(funcoes.map((f) => f.trim()).filter(Boolean))]
  if (unicas.length === 0) return 'Sua parte no louvor'
  const nomes =
    unicas.length === 1
      ? unicas[0]!
      : `${unicas.slice(0, -1).join(', ')} e ${unicas[unicas.length - 1]!}`
  return `Sua parte: ${nomes}`
}
