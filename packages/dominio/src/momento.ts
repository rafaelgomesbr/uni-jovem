import { ehFuncaoDaBanda, normalizarFuncaoDaBanda, semAcento } from './banda.ts'
import { dataNoFuso, type DataLocal, type HoraLocal } from './recorrencia.ts'

/**
 * Regras puras do app v3 (D66): o estado do cartão do momento, a data do
 * "Igual ao último sábado" e as sugestões de quem convocar para uma função.
 * Nada aqui toca banco, rede ou relógio: quem chama passa o "agora".
 */

// ------------------------------------------------------------------ cartão do momento

export const ESTADOS_DO_MOMENTO = ['longe', 'vespera', 'no_dia', 'acontecendo', 'terminou'] as const
export type EstadoDoMomento = (typeof ESTADOS_DO_MOMENTO)[number]

export type SituacaoDoAoVivo = 'nao_iniciado' | 'em_andamento' | 'pausado' | 'encerrado'

export interface EntradaDoMomento {
  agora: Date
  inicio: Date
  duracaoMin: number
  /** Fuso do encontro: "amanhã" e "hoje" são os do relógio de parede dele. */
  fuso: string
  /** O que o ao vivo diz; vence o relógio (um encontro que estoura o horário continua "acontecendo"). */
  situacaoAoVivo?: SituacaoDoAoVivo | null
}

const DIA_MS = 86_400_000

function somarDias(data: DataLocal, dias: number): DataLocal {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(a, m - 1, d) + dias * DIA_MS).toISOString().slice(0, 10)
}

/**
 * Em que momento o encontro está, para o cartão do Início:
 * - `acontecendo`: entre o início e o fim, ou com o ao vivo iniciado e não encerrado;
 * - `terminou`: passou do fim, ou o ao vivo foi encerrado;
 * - `no_dia`: ainda não começou e é o mesmo dia (de parede) de agora;
 * - `vespera`: começa no dia seguinte;
 * - `longe`: mais adiante.
 */
export function estadoDoMomento(e: EntradaDoMomento): EstadoDoMomento {
  const inicio = e.inicio.getTime()
  const fim = inicio + e.duracaoMin * 60_000
  const agora = e.agora.getTime()
  if (e.situacaoAoVivo === 'encerrado') return 'terminou'
  if (e.situacaoAoVivo === 'em_andamento' || e.situacaoAoVivo === 'pausado') return 'acontecendo'
  if (agora >= fim) return 'terminou'
  if (agora >= inicio) return 'acontecendo'
  const diaDoEncontro = dataNoFuso(e.inicio, e.fuso)
  const hoje = dataNoFuso(e.agora, e.fuso)
  if (diaDoEncontro === hoje) return 'no_dia'
  if (diaDoEncontro === somarDias(hoje, 1)) return 'vespera'
  return 'longe'
}

/** Hora de parede (HH:MM) de um instante num fuso. */
export function horaNoFuso(instante: Date, fuso: string): HoraLocal {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: fuso,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instante)
  const v = (t: string) => partes.find((p) => p.type === t)!.value
  return `${v('hour')}:${v('minute')}`
}

// ------------------------------------------------------------------ "Igual ao último sábado"

/**
 * A data do novo encontro quando a pessoa não pediu uma: o mesmo dia da semana
 * do encontro de origem, a primeira data DEPOIS de hoje que ainda não tenha um
 * encontro do mesmo título (`ocupadas`). Origem em 21/11 (sábado), hoje 22/11:
 * 28/11; se 28/11 já tem, 05/12.
 */
export function proximaDataParaCopiar(entrada: {
  dataDaOrigem: DataLocal
  hoje: DataLocal
  ocupadas: ReadonlySet<DataLocal>
}): DataLocal {
  let data = entrada.dataDaOrigem
  for (let i = 0; i < 1000; i++) {
    data = somarDias(data, 7)
    if (data > entrada.hoje && !entrada.ocupadas.has(data)) return data
  }
  // Origem absurdamente antiga: cai no mesmo cálculo a partir de hoje, nunca em loop.
  return somarDias(entrada.hoje, 7)
}

// ------------------------------------------------------------------ sugestões de quem convocar

/** A mesma função, ignorando acento e caixa; "voz" e "Vocal" contam como a mesma da banda. */
export function mesmaFuncao(a: string, b: string): boolean {
  if (semAcento(a) === semAcento(b)) return true
  return ehFuncaoDaBanda(a) && normalizarFuncaoDaBanda(a) === normalizarFuncaoDaBanda(b)
}

export interface ServicoPassado {
  vinculoId: string
  funcao: string
  /** Quando o encontro aconteceu. */
  quando: Date
}

export interface SugestaoDeConvocacao {
  vinculoId: string
  /** Quantas vezes serviu nesta função nos encontros considerados. */
  vezes: number
  ultimaVez: Date | null
  /** `true`: informou que pode neste dia; `false`: que não pode; `null`: não informou. */
  disponivelNoDia: boolean | null
}

export interface EntradaDeSugestoes {
  funcao: string
  historico: readonly ServicoPassado[]
  /** Disponibilidade informada para a data do encontro, por vínculo. */
  disponibilidade: ReadonlyMap<string, boolean>
  /** Quem já está convocado ou não pode ser sugerido. */
  excluir: ReadonlySet<string>
  limite?: number
}

/**
 * Quem sugerir para uma função, na ordem: serviu na função e disse que pode
 * neste dia; serviu na função (mais vezes, mais recente primeiro); só disse que
 * pode neste dia. Quem disse que NÃO pode sai das sugestões e vai para
 * `naoDisponiveis` (a tela mostra com o motivo, não oferece).
 */
export function sugerirParaFuncao(entrada: EntradaDeSugestoes): {
  sugeridas: SugestaoDeConvocacao[]
  naoDisponiveis: string[]
} {
  const porPessoa = new Map<string, { vezes: number; ultima: Date | null }>()
  for (const s of entrada.historico) {
    if (!mesmaFuncao(s.funcao, entrada.funcao)) continue
    const atual = porPessoa.get(s.vinculoId) ?? { vezes: 0, ultima: null }
    atual.vezes += 1
    if (atual.ultima === null || s.quando > atual.ultima) atual.ultima = s.quando
    porPessoa.set(s.vinculoId, atual)
  }
  for (const [vinculoId, disponivel] of entrada.disponibilidade) {
    if (disponivel && !porPessoa.has(vinculoId))
      porPessoa.set(vinculoId, { vezes: 0, ultima: null })
  }
  const naoDisponiveis: string[] = []
  const todas: SugestaoDeConvocacao[] = []
  for (const [vinculoId, p] of porPessoa) {
    if (entrada.excluir.has(vinculoId)) continue
    const disp = entrada.disponibilidade.get(vinculoId) ?? null
    if (disp === false) {
      naoDisponiveis.push(vinculoId)
      continue
    }
    todas.push({ vinculoId, vezes: p.vezes, ultimaVez: p.ultima, disponivelNoDia: disp })
  }
  const grupo = (s: SugestaoDeConvocacao) =>
    s.vezes > 0 && s.disponivelNoDia === true ? 0 : s.vezes > 0 ? 1 : 2
  todas.sort(
    (a, b) =>
      grupo(a) - grupo(b) ||
      b.vezes - a.vezes ||
      (b.ultimaVez?.getTime() ?? 0) - (a.ultimaVez?.getTime() ?? 0) ||
      a.vinculoId.localeCompare(b.vinculoId),
  )
  return { sugeridas: todas.slice(0, entrada.limite ?? 10), naoDisponiveis }
}
