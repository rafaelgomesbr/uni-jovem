/** Data (`AAAA-MM-DD`) e hora (`HH:MM`) locais dos campos de momento: conversão e formato. */

export type TipoDeMomento = 'data' | 'hora'

export interface PropsDoCampoDeMomento {
  rotulo: string
  /** Data `AAAA-MM-DD` ou hora `HH:MM` (horário local); `null` quando ainda não escolhida. */
  valor: string | null
  aoMudar: (valor: string) => void
  erro?: string | null
  ajuda?: string
  opcional?: boolean
  desabilitado?: boolean
  /** Data mínima e máxima (`AAAA-MM-DD`). */
  minimo?: string
  maximo?: string
  reservarApoio?: boolean
}

const dois = (n: number) => String(n).padStart(2, '0')

/** `AAAA-MM-DD` ou `HH:MM` para `Date` local (meio-dia na data, para o horário de verão não virar o dia). */
export function paraDate(tipo: TipoDeMomento, valor: string | null): Date {
  const agora = new Date()
  if (tipo === 'data') {
    const m = valor ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor) : null
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : agora
  }
  const m = valor ? /^(\d{2}):(\d{2})$/.exec(valor) : null
  const d = new Date(agora)
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return d
}

export function deDate(tipo: TipoDeMomento, d: Date): string {
  return tipo === 'data'
    ? `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
    : `${dois(d.getHours())}:${dois(d.getMinutes())}`
}

/** "Sáb., 15 de nov. de 2026" ou "16:00". */
export function formatarMomento(tipo: TipoDeMomento, valor: string | null): string | null {
  if (!valor) return null
  if (tipo === 'hora') return /^\d{2}:\d{2}$/.test(valor) ? valor : null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(paraDate('data', valor))
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

/**
 * O que o campo mostra na tela: "28/11/2026" (ou "16:00"). A forma por extenso cabe na linha
 * inteira mas não numa meia coluna ("Data | Hora"), onde cortava ("Sáb., 28 de…", emulador Android
 * em 23/11/2026, e pior com fonte grande). O leitor de tela continua ouvindo a forma por extenso.
 */
export function formatarMomentoCurto(tipo: TipoDeMomento, valor: string | null): string | null {
  if (!valor) return null
  if (tipo === 'hora') return formatarMomento(tipo, valor)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null
}
