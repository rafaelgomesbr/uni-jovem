/**
 * Programação: modelos de evento, horários das etapas e categorias.
 * Puro (sem banco nem data atual), compartilhado entre API e app.
 */

export interface EtapaDoModelo {
  titulo: string
  duracaoMin: number
  descricao?: string
}

export interface ItemDeChecklistDoModelo {
  tipo: 'preparacao' | 'encerramento'
  texto: string
}

export interface ModeloEmbutido {
  chave: string
  nome: string
  categoria: string
  descricao: string
  etapas: readonly EtapaDoModelo[]
  checklist: readonly ItemDeChecklistDoModelo[]
}

/**
 * Um dos modelos de roteiro que o app oferece (D81). NENHUM é aplicado sozinho: o encontro novo
 * nasce sem etapas e a pessoa escolhe "Começar do zero" ou "Usar um modelo". Etapas e ordem são
 * editáveis em cada evento, e nenhuma é obrigatória. Nenhum modelo impõe o dia da semana (D78):
 * a chave `sabado_padrao` fica só por compatibilidade com o que já foi gravado e com as rotas.
 */
export const MODELO_SABADO_PADRAO: ModeloEmbutido = {
  chave: 'sabado_padrao',
  nome: 'Encontro completo',
  categoria: 'Programação semanal',
  descricao: 'Sete etapas, com cerca de uma hora: da recepção ao encerramento.',
  etapas: [
    { titulo: 'Boas-vindas', duracaoMin: 5 },
    { titulo: 'Louvor', duracaoMin: 15 },
    { titulo: 'Oração intercessora', duracaoMin: 10 },
    { titulo: 'Dinâmica', duracaoMin: 10 },
    { titulo: 'Estudo da lição', duracaoMin: 15 },
    { titulo: 'Brinde', duracaoMin: 3 },
    { titulo: 'Encerramento', duracaoMin: 2 },
  ],
  checklist: [
    { tipo: 'preparacao', texto: 'Confirmar quem conduz cada etapa' },
    { tipo: 'preparacao', texto: 'Testar som, microfones e projeção' },
    { tipo: 'preparacao', texto: 'Organizar o espaço e as cadeiras' },
    { tipo: 'preparacao', texto: 'Separar o brinde' },
    { tipo: 'encerramento', texto: 'Registrar a presença' },
    { tipo: 'encerramento', texto: 'Recolher materiais e equipamentos' },
    { tipo: 'encerramento', texto: 'Anotar o que melhorar na próxima' },
  ],
}

/** Um encontro curto: palavra e oração, sem o resto (cerca de meia hora). */
export const MODELO_REUNIAO_CURTA: ModeloEmbutido = {
  chave: 'reuniao_curta',
  nome: 'Reunião curta',
  categoria: 'Programação semanal',
  descricao: 'Boas-vindas, uma palavra e oração, em cerca de meia hora.',
  etapas: [
    { titulo: 'Boas-vindas', duracaoMin: 5 },
    { titulo: 'Palavra', duracaoMin: 15 },
    { titulo: 'Oração', duracaoMin: 10 },
  ],
  checklist: [],
}

/** Um encontro só de música, com um momento de oração no fim. */
export const MODELO_SO_LOUVOR: ModeloEmbutido = {
  chave: 'so_louvor',
  nome: 'Só louvor',
  categoria: 'Luau musical',
  descricao: 'Um tempo de louvor, com recepção e uma oração no fim.',
  etapas: [
    { titulo: 'Boas-vindas', duracaoMin: 5 },
    { titulo: 'Louvor', duracaoMin: 30 },
    { titulo: 'Oração', duracaoMin: 5 },
  ],
  checklist: [],
}

export const MODELOS_EMBUTIDOS: readonly ModeloEmbutido[] = [
  MODELO_SABADO_PADRAO,
  MODELO_REUNIAO_CURTA,
  MODELO_SO_LOUVOR,
]

/** A chave é de um modelo do app (e não de um modelo salvo pela comunidade)? */
export function ehModeloEmbutido(chave: string): boolean {
  return MODELOS_EMBUTIDOS.some((m) => m.chave === chave)
}

/** Sugestões de categoria (texto livre também é aceito). */
export const CATEGORIAS_SUGERIDAS = [
  'Programação semanal',
  'Noite de jogos',
  'Luau musical',
  'Sarau',
  'Atividade esportiva',
  'Doação de sangue',
  'Ação social',
  'Oração intercessora',
  'Almoço',
  'Pequeno grupo de oração',
  'Outra iniciativa',
] as const

export interface HorarioDaEtapa {
  inicio: Date
  fim: Date
}

/** Horário previsto de cada etapa, em sequência a partir do início do evento. */
export function calcularHorarios(
  inicio: Date,
  etapas: readonly { duracaoMin: number }[],
): HorarioDaEtapa[] {
  let cursor = inicio.getTime()
  return etapas.map((e) => {
    const h = { inicio: new Date(cursor), fim: new Date(cursor + e.duracaoMin * 60_000) }
    cursor = h.fim.getTime()
    return h
  })
}

export function duracaoTotal(etapas: readonly { duracaoMin: number }[]): number {
  return etapas.reduce((soma, e) => soma + e.duracaoMin, 0)
}

export const STATUS_DO_EVENTO = [
  'rascunho',
  'publicado',
  'cancelado',
  'adiado',
  'encerrado',
] as const
export type StatusDoEvento = (typeof STATUS_DO_EVENTO)[number]

/** Transições de status permitidas (o resto é recusado pela API). */
export const TRANSICOES_DE_STATUS: Readonly<Record<StatusDoEvento, readonly StatusDoEvento[]>> = {
  rascunho: ['publicado'],
  publicado: ['cancelado', 'adiado', 'encerrado'],
  adiado: ['publicado', 'cancelado'],
  cancelado: [],
  encerrado: [],
}

export function podeMudarStatus(de: StatusDoEvento, para: StatusDoEvento): boolean {
  return TRANSICOES_DE_STATUS[de].includes(para)
}
