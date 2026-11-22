import { dataDoInstante, formatarHora, hojeNoFuso } from '@/utilidades/datas'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function numeros(data: string): [number, number, number] {
  const [a, m, d] = data.split('-').map(Number)
  return [a ?? 0, m ?? 1, d ?? 1]
}

/** Quantos dias do calendário do fuso faltam para o encontro (0 é hoje, negativo já passou). */
export function diasAte(inicio: string, fuso: string, agora: Date): number {
  const [a, m, d] = numeros(dataDoInstante(inicio, fuso))
  const [ha, hm, hd] = numeros(hojeNoFuso(fuso, agora))
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86_400_000)
}

/** "Hoje", "Amanhã" ou "Em 5 dias": a proximidade em texto, para quem varre a tela (D62). */
export function proximidadeDoEncontro(dias: number): string {
  if (dias < 0) return 'Já começou'
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `Em ${dias} dias`
}

/** "Sábado, 21 de nov.": o dia da semana e a data completa (o encontro de daqui a 12 dias não diz só "Sábado"). */
export function dataCompleta(inicio: string, fuso: string): string {
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: fuso }).format(
    new Date(inicio),
  )
  // "segunda-feira" vira "Segunda".
  const curto = nome.split('-')[0] ?? nome
  const dia = curto.charAt(0).toLocaleUpperCase('pt-BR') + curto.slice(1)
  const [, mes, d] = numeros(dataDoInstante(inicio, fuso))
  return `${dia}, ${d} de ${MESES[mes - 1] ?? ''}.`
}

/** "Sáb., 28 de nov.": o dia da semana abreviado e a data (o formato do cartão do momento, D68). */
export function dataCurta(inicio: string, fuso: string): string {
  const nome = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: fuso }).format(
    new Date(inicio),
  )
  const dia = nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1)
  const [, mes, d] = numeros(dataDoInstante(inicio, fuso))
  return `${dia.endsWith('.') ? dia : `${dia}.`}, ${d} de ${MESES[mes - 1] ?? ''}.`
}

/** "16:00 às 17:00". */
export function faixaDeHorario(inicio: string, duracaoMin: number, fuso: string): string {
  const fim = new Date(new Date(inicio).getTime() + duracaoMin * 60_000).toISOString()
  return `${formatarHora(inicio, fuso)} às ${formatarHora(fim, fuso)}`
}
