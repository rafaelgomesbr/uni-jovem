/**
 * A banda do encontro (D61): a lista padrão de funções do louvor, a
 * normalização do texto livre da convocação ("violao", "Violão ", "voz") e o
 * resumo "5 de 7 aceitaram, falta bateria".
 *
 * Não há tabela nova: a função continua sendo o campo de texto `funcao` da
 * convocação (`uj.atribuicoes`). Aqui só se lê esse texto; o que não for
 * reconhecido cai em "Outro" e continua aparecendo como foi escrito.
 */

export const FUNCOES_DA_BANDA = [
  'Vocal',
  'Violão',
  'Guitarra',
  'Teclado',
  'Baixo',
  'Bateria',
  'Projeção',
  'Som',
  'Outro',
] as const
export type FuncaoDaBanda = (typeof FUNCOES_DA_BANDA)[number]

/** As funções para escolher ao convocar: todas menos "Outro", que pede o nome. */
export const FUNCOES_PARA_CONVOCAR_NO_LOUVOR: readonly FuncaoDaBanda[] = FUNCOES_DA_BANDA.filter(
  (f) => f !== 'Outro',
)

/** Sem acento, minúsculo e com espaços simples: base de toda comparação de texto. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Palavras (já sem acento) que indicam cada função. A primeira que aparecer no texto vence. */
const PALAVRAS_DA_FUNCAO: readonly { funcao: FuncaoDaBanda; palavras: readonly string[] }[] = [
  {
    funcao: 'Vocal',
    palavras: ['vocal', 'vocais', 'voz', 'vozes', 'vocalista', 'cantor', 'cantora', 'backing'],
  },
  { funcao: 'Violão', palavras: ['violao', 'violoes', 'violonista', 'acustico'] },
  { funcao: 'Guitarra', palavras: ['guitarra', 'guitarrista', 'guitar'] },
  {
    funcao: 'Teclado',
    palavras: ['teclado', 'teclas', 'piano', 'pianista', 'tecladista', 'sintetizador', 'keyboard'],
  },
  { funcao: 'Baixo', palavras: ['baixo', 'baixista', 'contrabaixo', 'bass'] },
  { funcao: 'Bateria', palavras: ['bateria', 'batera', 'baterista'] },
  { funcao: 'Projeção', palavras: ['projecao', 'telao', 'slides', 'slide'] },
  { funcao: 'Som', palavras: ['som', 'sonoplastia', 'sonoplasta', 'audio', 'mesa'] },
]

/**
 * A função da banda que o texto quer dizer. Reconhece com ou sem acento e
 * maiúsculas ("violao", "Violão", "VOZ", "técnico de som", "backing vocal");
 * o que não reconhece vira "Outro".
 */
export function normalizarFuncaoDaBanda(texto: string | null | undefined): FuncaoDaBanda {
  const base = semAcento(texto ?? '')
  if (!base) return 'Outro'
  let melhor: { funcao: FuncaoDaBanda; posicao: number } | null = null
  for (const { funcao, palavras } of PALAVRAS_DA_FUNCAO) {
    for (const palavra of palavras) {
      const achada = new RegExp(`(?:^|[^a-z])${palavra}(?:$|[^a-z])`).exec(base)
      if (achada && (melhor === null || achada.index < melhor.posicao)) {
        melhor = { funcao, posicao: achada.index }
      }
    }
  }
  return melhor?.funcao ?? 'Outro'
}

/** O texto é uma função da banda reconhecida (isto é, não caiu em "Outro")? */
export function ehFuncaoDaBanda(texto: string | null | undefined): boolean {
  return normalizarFuncaoDaBanda(texto) !== 'Outro'
}

const PALAVRAS_DA_ETAPA_DE_LOUVOR = [
  'louvor',
  'adoracao',
  'banda',
  'musica',
  'ministerio de louvor',
]

/** O título da etapa é a etapa do louvor ("Louvor", "Louvor e adoração", "Banda")? */
export function ehEtapaDeLouvor(titulo: string | null | undefined): boolean {
  const base = semAcento(titulo ?? '')
  return base !== '' && PALAVRAS_DA_ETAPA_DE_LOUVOR.some((p) => base.includes(p))
}

export interface ConvocacaoParaLouvor {
  funcao: string
  /** Título da etapa da convocação; nulo quando a pessoa foi convocada para o encontro todo. */
  etapaTitulo?: string | null
  /** A etapa da convocação é a que tem o repertório do encontro. */
  etapaComRepertorio?: boolean
}

/**
 * A convocação é de louvor? Sim se a etapa é a do louvor (pelo nome), se é a
 * etapa que recebeu o repertório, ou se a função é de banda (violão, bateria...),
 * mesmo com a pessoa convocada ao encontro todo.
 */
export function ehConvocacaoDeLouvor(c: ConvocacaoParaLouvor): boolean {
  return (
    ehEtapaDeLouvor(c.etapaTitulo) || c.etapaComRepertorio === true || ehFuncaoDaBanda(c.funcao)
  )
}

// ------------------------------------------------------------------ resumo

export type EstadoDaConvocacao = 'pendente' | 'confirmada' | 'recusada' | 'substituicao_pedida'

export interface PessoaDaBanda {
  funcao: string
  estado: EstadoDaConvocacao
}

export interface GrupoDaBanda<T extends PessoaDaBanda> {
  funcao: FuncaoDaBanda
  pessoas: T[]
  aceitaram: number
  aguardando: number
  naoPodem: number
  pediramTroca: number
}

/**
 * Um bloco por função, na ordem da lista padrão. Funções sem ninguém entram
 * com a lista vazia ("Ninguém convocado"). A função de cada pessoa é a
 * normalizada; o texto original continua no registro dela.
 */
export function agruparBanda<T extends PessoaDaBanda>(pessoas: readonly T[]): GrupoDaBanda<T>[] {
  return FUNCOES_DA_BANDA.map((funcao) => {
    const doGrupo = pessoas.filter((p) => normalizarFuncaoDaBanda(p.funcao) === funcao)
    const conta = (estado: EstadoDaConvocacao) => doGrupo.filter((p) => p.estado === estado).length
    return {
      funcao,
      pessoas: doGrupo,
      aceitaram: conta('confirmada'),
      aguardando: conta('pendente'),
      naoPodem: conta('recusada'),
      pediramTroca: conta('substituicao_pedida'),
    }
  })
}

export interface ResumoDaBanda {
  convocados: number
  aceitaram: number
  /** Funções esperadas (já convocadas, ou pedidas) sem nenhuma pessoa que aceitou. "Outro" não entra. */
  faltam: FuncaoDaBanda[]
  /** "5 de 7 aceitaram. Falta: bateria". Vazio quando ninguém foi convocado. */
  texto: string
}

/**
 * "5 de 7 aceitaram. Falta: bateria". Uma função é esperada quando alguém
 * foi convocado para ela (e `esperadas` acrescenta outras que a comunidade
 * sempre quer, se um dia houver). Falta quando nenhum convocado dela aceitou.
 * "Outro" não é função esperada: mistura gente de papéis diferentes.
 */
export function resumoDaBanda(
  pessoas: readonly PessoaDaBanda[],
  esperadas: readonly FuncaoDaBanda[] = [],
): ResumoDaBanda {
  const convocados = pessoas.length
  const aceitaram = pessoas.filter((p) => p.estado === 'confirmada').length
  const grupos = agruparBanda(pessoas)
  const faltam = grupos
    .filter(
      (g) =>
        g.funcao !== 'Outro' &&
        (g.pessoas.length > 0 || esperadas.includes(g.funcao)) &&
        g.aceitaram === 0,
    )
    .map((g) => g.funcao)
  if (convocados === 0) return { convocados, aceitaram, faltam, texto: '' }
  const partes = [`${aceitaram} de ${convocados} ${aceitaram === 1 ? 'aceitou' : 'aceitaram'}`]
  if (faltam.length) partes.push(`Falta: ${faltam.map((f) => f.toLowerCase()).join(', ')}`)
  return { convocados, aceitaram, faltam, texto: partes.join('. ') }
}
