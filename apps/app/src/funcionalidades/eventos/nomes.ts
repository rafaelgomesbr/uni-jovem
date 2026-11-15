import type { DiaDaSemana, RegraDeRecorrencia, StatusDoEvento } from '@uj/dominio'
import type { Paleta } from '@uj/tokens'

import type {
  EstadoDaAtribuicao,
  TipoDeChecklist,
  Visibilidade,
} from '@/servicos/contratoDosEventos'
import type { TomDoChip } from '@/ui/Chip'
import { NOMES_DOS_DIAS } from '@/utilidades/datas'

export const NOME_DO_STATUS: Readonly<Record<StatusDoEvento, string>> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  cancelado: 'Cancelado',
  adiado: 'Adiado',
  encerrado: 'Encerrado',
}

export const COR_DO_STATUS: Readonly<Record<StatusDoEvento, keyof Paleta>> = {
  rascunho: 'textoSuave',
  publicado: 'sucesso',
  cancelado: 'erro',
  adiado: 'alerta',
  encerrado: 'textoSuave',
}

/** Chip da situação (2.12.12). Publicado não ganha chip: é o normal. */
export const TOM_DO_STATUS: Readonly<Record<StatusDoEvento, TomDoChip | null>> = {
  rascunho: 'neutro',
  publicado: null,
  cancelado: 'erro',
  adiado: 'alerta',
  encerrado: 'neutro',
}

/** Chip da escala, em uma ou duas palavras (2.12.12). */
export const CHIP_DO_ESTADO_DA_ATRIBUICAO: Readonly<
  Record<EstadoDaAtribuicao, { texto: string; tom: TomDoChip }>
> = {
  pendente: { texto: 'Pendente', tom: 'alerta' },
  confirmada: { texto: 'Confirmada', tom: 'sucesso' },
  recusada: { texto: 'Recusada', tom: 'erro' },
  substituicao_pedida: { texto: 'Substituição', tom: 'info' },
}

export const NOME_DA_VISIBILIDADE: Readonly<Record<Visibilidade, string>> = {
  interna: 'Interna',
  publica: 'Pública',
}

export const DESCRICAO_DA_VISIBILIDADE: Readonly<Record<Visibilidade, string>> = {
  interna: 'Só quem participa da comunidade vê.',
  publica: 'Ganha uma página aberta com inscrição, para compartilhar no WhatsApp.',
}

export const NOME_DO_ESTADO_DA_ATRIBUICAO: Readonly<Record<EstadoDaAtribuicao, string>> = {
  pendente: 'Aguardando resposta',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  substituicao_pedida: 'Substituição pedida',
}

export const COR_DO_ESTADO_DA_ATRIBUICAO: Readonly<Record<EstadoDaAtribuicao, keyof Paleta>> = {
  pendente: 'alerta',
  confirmada: 'sucesso',
  recusada: 'erro',
  substituicao_pedida: 'alerta',
}

export const NOME_DO_CHECKLIST: Readonly<Record<TipoDeChecklist, string>> = {
  preparacao: 'Preparação',
  encerramento: 'Encerramento',
}

const PLURAL_DOS_DIAS = [
  'domingos',
  'segundas',
  'terças',
  'quartas',
  'quintas',
  'sextas',
  'sábados',
] as const

type Semana = 1 | 2 | 3 | 4 | -1
const ORDINAL_MASCULINO: Readonly<Record<Semana, string>> = {
  1: 'primeiro',
  2: 'segundo',
  3: 'terceiro',
  4: 'quarto',
  [-1]: 'último',
}
const ORDINAL_FEMININO: Readonly<Record<Semana, string>> = {
  1: 'primeira',
  2: 'segunda',
  3: 'terceira',
  4: 'quarta',
  [-1]: 'última',
}

function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

/** "Toda semana, aos sábados, às 16:00" e parecidos. */
export function descreverRegra(regra: RegraDeRecorrencia, hora?: string): string {
  let texto: string
  if (regra.frequencia === 'semanal') {
    const dias = [...regra.diasDaSemana]
      .sort()
      .map((d: DiaDaSemana) => `${d === 0 || d === 6 ? 'aos' : 'às'} ${PLURAL_DOS_DIAS[d]}`)
    const cada =
      regra.intervaloSemanas === 1 ? 'Toda semana' : `A cada ${regra.intervaloSemanas} semanas`
    texto = `${cada}, ${juntar(dias)}`
  } else if (regra.modo === 'dia_do_mes') {
    texto = `Todo mês, no dia ${regra.dia}`
  } else {
    // Sábado e domingo são masculinos; os demais dias, femininos.
    const masculino = regra.diaDaSemana === 0 || regra.diaDaSemana === 6
    const ordinal = (masculino ? ORDINAL_MASCULINO : ORDINAL_FEMININO)[regra.semana]
    texto = `Todo mês, ${masculino ? 'no' : 'na'} ${ordinal} ${NOMES_DOS_DIAS[regra.diaDaSemana]}`
  }
  return hora ? `${texto}, às ${hora}` : texto
}
