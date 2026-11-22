/**
 * Regras puras da conferência "Igual ao último encontro" (D78): qual das três datas está escolhida,
 * quem é da equipe do rascunho e o título que combina com o dia. Sem tela, para testar à parte.
 */
import { tituloNaData } from '@uj/dominio'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'
import type { ResumoDaCopia } from '@/servicos/contratoV3'
import type { DataLocal } from '@/utilidades/datas'

export type EscolhaDeData = 'sugerida' | 'depois' | 'outra'

/**
 * A opção marcada na pergunta "Quando?": a data sugerida, uma semana depois dela ou "Outra data".
 * "Outra data" também vale enquanto a pessoa escolhe (`aberta`) e para qualquer data que não seja
 * uma das duas primeiras.
 */
export function escolhaDeData({
  aberta,
  dataAtual,
  sugerida,
  depois,
}: {
  aberta: boolean
  dataAtual: DataLocal | null
  sugerida: DataLocal | null
  depois: DataLocal | null
}): EscolhaDeData {
  if (aberta || (dataAtual && dataAtual !== sugerida && dataAtual !== depois)) return 'outra'
  return dataAtual !== null && dataAtual === depois ? 'depois' : 'sugerida'
}

export interface LinhaDaEquipe {
  chave: string
  vinculoId: string
  nome: string
  funcao: string
  /** O bloco do roteiro (ex.: "Louvor"); nulo = o encontro inteiro. */
  onde: string | null
}

/**
 * Quem está convocado no rascunho: o encontro carregado, que muda quando a pessoa troca alguém, ou,
 * enquanto ele carrega, o que a própria cópia trouxe.
 */
export function equipeDoRascunho(
  detalhe: DetalheDoEvento | null,
  resumo: Pick<ResumoDaCopia, 'convocados'>,
): LinhaDaEquipe[] {
  if (detalhe) {
    return detalhe.atribuicoes.map((a) => ({
      chave: a.id,
      vinculoId: a.vinculoId,
      nome: a.nome,
      funcao: a.funcao,
      onde: detalhe.etapas.find((e) => e.id === a.etapaId)?.titulo ?? null,
    }))
  }
  return resumo.convocados.itens.map((i) => ({
    chave: i.atribuicaoId,
    vinculoId: i.vinculoId,
    nome: i.nome,
    funcao: i.funcao,
    onde: i.etapaTitulo,
  }))
}

/**
 * O título que a conferência mostra: o do rascunho já carregado, ou o do encontro de origem
 * ajustado ao dia da data nova ("Sábado" copiado para um domingo é "Domingo"). Um título que a
 * pessoa escreveu fica como está.
 */
export function tituloDaConferencia(
  detalhe: Pick<DetalheDoEvento, 'titulo'> | null,
  tituloDaOrigem: string,
  data: DataLocal | null,
): string {
  if (detalhe) return detalhe.titulo
  return data ? tituloNaData(tituloDaOrigem, data) : tituloDaOrigem
}

/** "Ninguém foi avisado ainda. Ao publicar, 3 pessoas recebem o aviso." */
export function fraseDoRascunho(pessoas: number): string {
  if (pessoas === 0) return 'Ninguém foi avisado ainda.'
  return `Ninguém foi avisado ainda. Ao publicar, ${pessoas} ${pessoas === 1 ? 'pessoa recebe' : 'pessoas recebem'} o aviso.`
}
