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
 * A programação habitual de sábado (cerca de 1 hora). É ponto de partida:
 * etapas e ordem são editáveis em cada evento, e nenhuma é obrigatória.
 */
export const MODELO_SABADO_PADRAO: ModeloEmbutido = {
  chave: 'sabado_padrao',
  nome: 'Sábado padrão',
  categoria: 'Programação de sábado',
  descricao: 'Programação habitual de sábado, com cerca de uma hora.',
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

export const MODELOS_EMBUTIDOS: readonly ModeloEmbutido[] = [MODELO_SABADO_PADRAO]

/** Sugestões de categoria (texto livre também é aceito). */
export const CATEGORIAS_SUGERIDAS = [
  'Programação de sábado',
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
