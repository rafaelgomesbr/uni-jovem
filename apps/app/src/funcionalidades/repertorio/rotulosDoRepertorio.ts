import { formatarDuracaoDaMusica, metadadosDaCifra } from '@uj/dominio'

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
  if (artista && d.artista) partes.push(d.artista)
  const semCifra = d.cifra !== undefined ? !(d.cifra && d.cifra.trim()) : d.temCifra === false
  if (semCifra) partes.push('Sem cifra')
  return partes.join(' · ')
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
