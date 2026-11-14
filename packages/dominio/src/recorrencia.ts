/**
 * Recorrência de eventos, sem biblioteca externa. As DATAS são geradas no
 * calendário local da comunidade (datas "de parede", sem fuso); depois cada
 * data + hora local vira um instante real com `instanteNoFuso`, que respeita
 * horário de verão. Assim "todo sábado às 16h" continua às 16h locais mesmo
 * quando o fuso muda de deslocamento.
 */

export type DataLocal = string // 'AAAA-MM-DD'
export type HoraLocal = string // 'HH:MM'

/** 0 = domingo ... 6 = sábado. */
export type DiaDaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type RegraDeRecorrencia =
  | { frequencia: 'semanal'; intervaloSemanas: number; diasDaSemana: DiaDaSemana[] }
  | { frequencia: 'mensal'; modo: 'dia_do_mes'; dia: number }
  | {
      frequencia: 'mensal'
      modo: 'semana_do_mes'
      semana: 1 | 2 | 3 | 4 | -1
      diaDaSemana: DiaDaSemana
    }

const DIA_MS = 86_400_000

function paraUtc(data: DataLocal): number {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number]
  return Date.UTC(a, m - 1, d)
}

function deUtc(ms: number): DataLocal {
  return new Date(ms).toISOString().slice(0, 10)
}

export function dataValida(data: string): data is DataLocal {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  return deUtc(paraUtc(data)) === data
}

function diaDaSemana(ms: number): DiaDaSemana {
  return new Date(ms).getUTCDay() as DiaDaSemana
}

function ultimoDiaDoMes(ano: number, mes0: number): number {
  return new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate()
}

/**
 * Datas da regra a partir de `inicio` (inclusive) até `ate` (exclusive) e, se
 * houver, até `fim` (inclusive). Teto de 400 ocorrências por chamada.
 */
export function gerarDatas(
  regra: RegraDeRecorrencia,
  inicio: DataLocal,
  ate: DataLocal,
  fim?: DataLocal | null,
): DataLocal[] {
  const limite = Math.min(paraUtc(ate) - 1, fim ? paraUtc(fim) : Infinity)
  const comeco = paraUtc(inicio)
  const saida: DataLocal[] = []
  const teto = 400

  if (regra.frequencia === 'semanal') {
    const intervalo = Math.max(1, Math.min(4, Math.trunc(regra.intervaloSemanas)))
    const dias = [...new Set(regra.diasDaSemana)].sort()
    if (dias.length === 0) return []
    // Semana de referência: o domingo da semana do início.
    const domingoInicial = comeco - diaDaSemana(comeco) * DIA_MS
    for (let semana = 0; saida.length < teto; semana += intervalo) {
      const domingo = domingoInicial + semana * 7 * DIA_MS
      if (domingo > limite) break
      for (const d of dias) {
        const dia = domingo + d * DIA_MS
        if (dia >= comeco && dia <= limite) saida.push(deUtc(dia))
      }
    }
    return saida.slice(0, teto)
  }

  const base = new Date(comeco)
  for (let i = 0; saida.length < teto; i++) {
    const ano = base.getUTCFullYear() + Math.floor((base.getUTCMonth() + i) / 12)
    const mes0 = (base.getUTCMonth() + i) % 12
    const primeiroDoMes = Date.UTC(ano, mes0, 1)
    if (primeiroDoMes > limite) break
    let dia: number | null
    if (regra.modo === 'dia_do_mes') {
      // Mês sem o dia (ex.: 31 em abril) fica sem ocorrência, em vez de pular de data.
      dia = regra.dia <= ultimoDiaDoMes(ano, mes0) ? Date.UTC(ano, mes0, regra.dia) : null
    } else if (regra.semana === -1) {
      const ultimo = Date.UTC(ano, mes0, ultimoDiaDoMes(ano, mes0))
      const recuo = (diaDaSemana(ultimo) - regra.diaDaSemana + 7) % 7
      dia = ultimo - recuo * DIA_MS
    } else {
      const avanco = (regra.diaDaSemana - diaDaSemana(primeiroDoMes) + 7) % 7
      const candidato = primeiroDoMes + (avanco + (regra.semana - 1) * 7) * DIA_MS
      dia = new Date(candidato).getUTCMonth() === mes0 ? candidato : null
    }
    if (dia !== null && dia >= comeco && dia <= limite) saida.push(deUtc(dia))
  }
  return saida
}

/** Deslocamento (ms) do fuso num instante: horário local menos UTC. */
export function deslocamentoDoFuso(fuso: string, instante: number): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instante))
  const v = (t: string) => Number(partes.find((p) => p.type === t)!.value)
  const comoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'))
  return comoUtc - Math.floor(instante / 1000) * 1000
}

/**
 * Instante real de uma data e hora de parede num fuso. Na hora que "não existe"
 * (início do horário de verão), avança para a primeira hora válida; na hora
 * repetida (fim do horário de verão), escolhe a primeira.
 */
export function instanteNoFuso(data: DataLocal, hora: HoraLocal, fuso: string): Date {
  const [h, mi] = hora.split(':').map(Number) as [number, number]
  const parede = paraUtc(data) + (h * 60 + mi) * 60_000
  const d1 = deslocamentoDoFuso(fuso, parede)
  let t = parede - d1
  const d2 = deslocamentoDoFuso(fuso, t)
  if (d2 !== d1) {
    const t2 = parede - d2
    // Se a hora de parede de t2 bate, use-a (hora repetida: a primeira); senão, a hora não existe.
    t = deslocamentoDoFuso(fuso, t2) === d2 ? Math.min(t, t2) : Math.max(t, t2)
  }
  return new Date(t)
}

/** Data de parede (AAAA-MM-DD) de um instante num fuso. */
export function dataNoFuso(instante: Date, fuso: string): DataLocal {
  // Hora de parede = instante + deslocamento; a data dela é a data local.
  return deUtc(instante.getTime() + deslocamentoDoFuso(fuso, instante.getTime()))
}

/** Janela de materialização: ocorrências criadas com antecedência. */
export const JANELA_DE_MATERIALIZACAO_DIAS = 183
