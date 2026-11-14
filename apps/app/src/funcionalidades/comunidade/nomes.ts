import type { Paleta } from '@uj/tokens'

import type { EstadoDaComunidade, EstadoDoVinculo } from '@/servicos/contrato'

export const NOME_DO_ESTADO_DA_COMUNIDADE: Readonly<Record<EstadoDaComunidade, string>> = {
  ativa: 'Ativa',
  suspensa: 'Suspensa (somente leitura)',
  arquivada: 'Arquivada',
  exclusao_agendada: 'Exclusão agendada',
}

export const COR_DO_ESTADO_DA_COMUNIDADE: Readonly<Record<EstadoDaComunidade, keyof Paleta>> = {
  ativa: 'sucesso',
  suspensa: 'alerta',
  arquivada: 'textoSuave',
  exclusao_agendada: 'erro',
}

export const NOME_DO_ESTADO_DO_VINCULO: Readonly<Record<EstadoDoVinculo, string>> = {
  ativo: 'Ativo',
  desativado: 'Desativado',
  removido: 'Removido',
}

export const NOME_DA_SITUACAO_DO_CONVITE = {
  valido: 'Válido',
  expirado: 'Vencido',
  revogado: 'Cancelado',
  usado: 'Usado',
} as const
