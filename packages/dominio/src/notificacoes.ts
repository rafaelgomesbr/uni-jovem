/**
 * Tipos de notificação (plano, seção 8). A preferência é por tipo E por
 * comunidade; sem preferência gravada, o tipo está ligado. Os mesmos nomes
 * existem no banco (0011_notificacoes.sql).
 */
export const TIPOS_DE_NOTIFICACAO = [
  'eventos',
  'escalas',
  'inscricoes',
  'tarefas',
  'substituicoes',
  'alteracoes_importantes',
  'avisos',
] as const
export type TipoDeNotificacao = (typeof TIPOS_DE_NOTIFICACAO)[number]

export const NOME_DO_TIPO_DE_NOTIFICACAO: Readonly<Record<TipoDeNotificacao, string>> = {
  eventos: 'Eventos',
  escalas: 'Escalas',
  inscricoes: 'Inscrições',
  tarefas: 'Tarefas',
  substituicoes: 'Substituições',
  alteracoes_importantes: 'Cancelamentos e adiamentos',
  avisos: 'Avisos',
}

/** Versículo do dia: preferência da conta, ligada por padrão às 07:00. */
export const VERSICULO_PADRAO = { ativo: true, hora: '07:00' } as const
