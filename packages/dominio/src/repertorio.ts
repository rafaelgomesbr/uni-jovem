/**
 * Repertório do encontro (D61): a soma do tempo das músicas contra os minutos
 * da etapa, só como aviso (nunca bloqueia nada).
 */

export interface ItemParaSomar {
  /** Duração da música em segundos, quando cadastrada. */
  duracaoSeg: number | null
}

export interface ResumoDoRepertorio {
  musicas: number
  /** Soma das durações conhecidas, em segundos. */
  segundos: number
  /** Músicas sem duração cadastrada (a soma fica menor que a real). */
  semDuracao: number
  /** Passa dos minutos previstos da etapa (só com duração conhecida e prevista). */
  passaDoPrevisto: boolean
  /** "4 músicas, cerca de 17 min de 15 previstos". Vazio sem músicas. */
  texto: string
}

/** Arredonda para cima no minuto fechado mais perto: 16 min e 20 s viram 17 min. */
function minutosArredondados(segundos: number): number {
  return Math.max(1, Math.round(segundos / 60))
}

/**
 * Resume o repertório. Músicas sem duração não entram na soma e são
 * contadas à parte: o aviso nunca finge saber o que não sabe.
 */
export function resumoDoRepertorio(
  itens: readonly ItemParaSomar[],
  minutosPrevistos: number | null = null,
): ResumoDoRepertorio {
  const musicas = itens.length
  const comDuracao = itens.filter((i) => i.duracaoSeg !== null && i.duracaoSeg > 0)
  const segundos = comDuracao.reduce((s, i) => s + (i.duracaoSeg ?? 0), 0)
  const semDuracao = musicas - comDuracao.length
  const minutos = minutosArredondados(segundos)
  const passaDoPrevisto = minutosPrevistos !== null && segundos > 0 && minutos > minutosPrevistos
  if (musicas === 0) return { musicas, segundos, semDuracao, passaDoPrevisto, texto: '' }
  const partes = [`${musicas} ${musicas === 1 ? 'música' : 'músicas'}`]
  if (segundos > 0) {
    partes.push(
      minutosPrevistos !== null
        ? `cerca de ${minutos} min de ${minutosPrevistos} previstos`
        : `cerca de ${minutos} min`,
    )
  }
  let texto = partes.join(', ')
  if (semDuracao > 0 && segundos > 0) {
    texto += ` (${semDuracao} sem duração cadastrada)`
  }
  return { musicas, segundos, semDuracao, passaDoPrevisto, texto }
}

/** "3:45" a partir de segundos; vazio sem duração. */
export function formatarDuracaoDaMusica(segundos: number | null | undefined): string {
  if (!segundos || segundos <= 0) return ''
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Lê "3:45" ou "225" (segundos) como segundos; nulo se não for duração válida (10 s a 1 h). */
export function lerDuracaoDaMusica(texto: string): number | null {
  const t = texto.trim()
  if (!t) return null
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(t)
  const segundos = m ? Number(m[1]) * 60 + Number(m[2]) : /^\d{1,4}$/.test(t) ? Number(t) : NaN
  return Number.isInteger(segundos) && segundos >= 10 && segundos <= 3600 ? segundos : null
}
