import type { Papel } from '@uj/dominio'
import type { Paleta } from '@uj/tokens'

import type { ConviteDaComunidade, EstadoDaComunidade, EstadoDoVinculo } from '@/servicos/contrato'
import type { TomDoChip } from '@/ui/Chip'
import type { NomeDoIcone } from '@/ui/Icone'

export const NOME_DO_ESTADO_DA_COMUNIDADE: Readonly<Record<EstadoDaComunidade, string>> = {
  ativa: 'Ativa',
  suspensa: 'Suspensa (somente leitura)',
  arquivada: 'Arquivada',
  exclusao_agendada: 'Exclusão agendada',
}

/** Em chip: uma ou duas palavras (2.12.12). */
export const NOME_CURTO_DO_ESTADO_DA_COMUNIDADE: Readonly<Record<EstadoDaComunidade, string>> = {
  ativa: 'Ativa',
  suspensa: 'Suspensa',
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
  organizador: 'Monta os encontros, as escalas e as tarefas.',
  membro: 'Participa, vê a agenda, confirma escalas e faz inscrições.',
}

/** Papel em chip (quadro 08): Administrador quente, Organizador info, Membro neutro. */
export const CHIP_DO_PAPEL: Readonly<Record<Papel, { tom: TomDoChip; icone: NomeDoIcone }>> = {
  admin: { tom: 'quente', icone: 'chave' },
  organizador: { tom: 'info', icone: 'tarefas' },
  membro: { tom: 'neutro', icone: 'pessoa' },
}

type SituacaoDoConviteDaLista = ConviteDaComunidade['situacao']

/** Nome da situação do convite na tela (quadro 08b). Revogado aparece como "Cancelado". */
export const NOME_DA_SITUACAO_DO_CONVITE: Readonly<Record<SituacaoDoConviteDaLista, string>> = {
  valido: 'Válido',
  expirado: 'Vencido',
  revogado: 'Cancelado',
  usado: 'Usado',
}

export const CHIP_DA_SITUACAO_DO_CONVITE: Readonly<
  Record<SituacaoDoConviteDaLista, { tom: TomDoChip; icone: NomeDoIcone }>
> = {
  valido: { tom: 'sucesso', icone: 'relogio' },
  usado: { tom: 'neutro', icone: 'confirmado' },
  revogado: { tom: 'erro', icone: 'cancelar' },
  expirado: { tom: 'neutro', icone: 'pendente' },
}
