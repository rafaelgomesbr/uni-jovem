import { agruparBanda, ehConvocacaoDeLouvor, resumoDaBanda } from '@uj/dominio'

import type { DetalheDoEvento } from '@/servicos/contratoDosEventos'

import { useEvento } from '../eventos/consultas'

/**
 * A banda do louvor está completa? Devolve quantas funções ela tem (o "5" de "5 de 5") quando
 * toda função convocada tem pelo menos uma pessoa que aceitou, e `null` em qualquer outro caso
 * (sem louvor, sem convocados, alguém ainda sem resposta na única vaga da função). Função pura,
 * sobre o detalhe do encontro.
 */
export function funcoesDaBandaCompleta(
  evento: Pick<DetalheDoEvento, 'etapas' | 'atribuicoes'>,
): number | null {
  const titulos = new Map(evento.etapas.map((e) => [e.id, e.titulo] as const))
  const pessoas = evento.atribuicoes.filter((a) =>
    ehConvocacaoDeLouvor({
      funcao: a.funcao,
      etapaTitulo: a.etapaId ? (titulos.get(a.etapaId) ?? null) : null,
    }),
  )
  if (pessoas.length === 0) return null
  const resumo = resumoDaBanda(pessoas)
  if (resumo.faltam.length > 0) return null
  const funcoes = agruparBanda(pessoas).filter(
    (g) => g.funcao !== 'Outro' && g.pessoas.length > 0,
  ).length
  return funcoes > 0 ? funcoes : null
}

/**
 * Só o líder pede o detalhe (é a mesma leitura que a tela do encontro faz: já vem do cache
 * quando ele a abriu). `habilitado` é falso para o membro e sem encontro.
 */
export function useBandaCompleta(
  comunidadeId: string,
  eventoId: string | null,
  habilitado: boolean,
): number | null {
  const detalhe = useEvento(habilitado ? comunidadeId : null, habilitado ? eventoId : null)
  return detalhe.data ? funcoesDaBandaCompleta(detalhe.data) : null
}
