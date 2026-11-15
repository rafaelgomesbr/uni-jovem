import type { Papel } from '@uj/dominio'
import type { Paleta } from '@uj/tokens'

import type { ConviteDaComunidade, EstadoDaComunidade, EstadoDoVinculo } from '@/servicos/contrato'
import type { NomeDoIcone } from '@/ui/Icone'

import type { TomDoChip } from './visual'

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

export const CHIP_DO_ESTADO_DA_COMUNIDADE: Readonly<
  Record<EstadoDaComunidade, { tom: TomDoChip; icone: NomeDoIcone }>
> = {
  ativa: { tom: 'sucesso', icone: 'confirmado' },
  suspensa: { tom: 'alerta', icone: 'pausar' },
  arquivada: { tom: 'neutro', icone: 'guardadoNoAparelho' },
  exclusao_agendada: { tom: 'erro', icone: 'excluir' },
}

export const NOME_DO_ESTADO_DO_VINCULO: Readonly<Record<EstadoDoVinculo, string>> = {
  ativo: 'Ativo',
  desativado: 'Desativado',
  removido: 'Removido',
}

export const CHIP_DO_ESTADO_DO_VINCULO: Readonly<
  Record<EstadoDoVinculo, { tom: TomDoChip; icone: NomeDoIcone }>
> = {
  ativo: { tom: 'sucesso', icone: 'confirmado' },
  desativado: { tom: 'alerta', icone: 'pausar' },
  removido: { tom: 'erro', icone: 'cancelar' },
}

export const DESCRICAO_DO_PAPEL: Readonly<Record<Papel, string>> = {
  admin: 'Configura a comunidade, convida pessoas e altera papéis.',
  organizador: 'Monta eventos, programações, escalas e tarefas.',
  membro: 'Participa, vê a agenda, confirma escalas e faz inscrições.',
}

export const CHIP_DO_PAPEL: Readonly<Record<Papel, { tom: TomDoChip; icone: NomeDoIcone }>> = {
  admin: { tom: 'destaque', icone: 'chave' },
  organizador: { tom: 'neutro', icone: 'tarefas' },
  membro: { tom: 'neutro', icone: 'pessoa' },
}

type SituacaoDoConviteDaLista = ConviteDaComunidade['situacao']

/** Nome da situação do convite na tela. "Válido" aparece como "Pendente": ninguém usou ainda. */
export const NOME_DA_SITUACAO_DO_CONVITE: Readonly<Record<SituacaoDoConviteDaLista, string>> = {
  valido: 'Pendente',
  expirado: 'Vencido',
  revogado: 'Revogado',
  usado: 'Usado',
}

export const CHIP_DA_SITUACAO_DO_CONVITE: Readonly<
  Record<SituacaoDoConviteDaLista, { tom: TomDoChip; icone: NomeDoIcone }>
> = {
  valido: { tom: 'destaque', icone: 'relogio' },
  usado: { tom: 'sucesso', icone: 'confirmado' },
  revogado: { tom: 'erro', icone: 'cancelar' },
  expirado: { tom: 'neutro', icone: 'pendente' },
}
