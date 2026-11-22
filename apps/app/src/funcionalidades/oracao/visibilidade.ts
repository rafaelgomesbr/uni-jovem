import type { VisibilidadeDeOracao } from '@uj/dominio'

import { useSessao } from '@/estado/sessao'
import type { Opcao } from '@/ui/ListaDeOpcoes'

import { useMembros } from '../comunidade/consultas'

/** Nomes curtos das opções (TC-06). */
export const NOME_DA_VISIBILIDADE: Readonly<Record<VisibilidadeDeOracao, string>> = {
  somente_eu: 'Somente eu',
  equipe_oracao: 'Equipe de oração',
  comunidade: 'Comunidade',
}

const ORDEM: Readonly<Record<VisibilidadeDeOracao, number>> = {
  somente_eu: 0,
  equipe_oracao: 1,
  comunidade: 2,
}

/** Quantas pessoas além de você leem em cada público (`null` enquanto não sabe). */
export interface Contagem {
  equipe: number | null
  comunidade: number | null
}

/** Conta com a lista de membros ativos; a própria pessoa não entra na conta. */
export function useContagemDeLeitores(comunidadeId: string): Contagem {
  const { conta } = useSessao()
  const membros = useMembros(comunidadeId)
  if (!membros.data) return { equipe: null, comunidade: null }
  const outros = membros.data.filter((m) => m.estado === 'ativo' && m.contaId !== conta?.id)
  return {
    equipe: outros.filter((m) => m.designacoes.includes('equipe_oracao')).length,
    comunidade: outros.length,
  }
}

const pessoas = (n: number) => (n === 1 ? '1 pessoa' : `${n} pessoas`)

/** Texto de quem vê, mostrado ANTES de publicar (TC-06.v1). */
export function explicarVisibilidade(
  v: VisibilidadeDeOracao,
  comunidade: string,
  c: Contagem,
): string {
  switch (v) {
    case 'somente_eu':
      return 'Só você vê. Nem administradores nem o Criador do app têm tela para ler.'
    case 'equipe_oracao':
      if (c.equipe === 0) {
        return `Você e a equipe de oração da ${comunidade} veem. Hoje ninguém está na equipe, então só você vê até alguém ser designado. Administradores só veem se estiverem na equipe.`
      }
      return `Você e ${c.equipe === null ? 'as pessoas' : `as ${pessoas(c.equipe)}`} da equipe de oração da ${comunidade} veem. Administradores só veem se estiverem na equipe.`
    case 'comunidade':
      return `Você e todos os membros ativos da ${comunidade} veem${c.comunidade === null ? '' : ` (${pessoas(c.comunidade)} hoje)`}.`
  }
}

/**
 * Quantas pessoas leem, para a descrição de cada opção (3.7.1): "Só você",
 * "4 pessoas além de você". A explicação completa vem abaixo da lista.
 */
export function contagemDaVisibilidade(v: VisibilidadeDeOracao, c: Contagem): string {
  if (v === 'somente_eu') return 'Só você lê.'
  const n = v === 'equipe_oracao' ? c.equipe : c.comunidade
  if (n === null)
    return v === 'equipe_oracao' ? 'Quem está na equipe de oração.' : 'Todos os membros ativos.'
  if (n === 0) return 'Hoje, ninguém além de você.'
  return `${pessoas(n)} além de você.`
}

/**
 * A frase grande do resumo antes de publicar: quem lê e com que nome. "Vai aparecer como
 * Anônimo para 15 pessoas." Com a equipe vazia, diz a verdade: só a própria pessoa vê.
 */
export function quemVaiVer(v: VisibilidadeDeOracao, anonimo: boolean, c: Contagem): string {
  const como = anonimo ? 'como Anônimo' : 'com o seu nome'
  if (v === 'somente_eu') return 'Só você vai ver este pedido.'
  if (v === 'equipe_oracao') {
    if (c.equipe === 0) {
      return 'Hoje ninguém além de você está na equipe de oração, então só você vê até alguém ser designado.'
    }
    return `Vai aparecer ${como} para a equipe de oração${c.equipe === null ? '' : ` (${pessoas(c.equipe)})`}.`
  }
  return `Vai aparecer ${como} para ${c.comunidade === null ? 'toda a comunidade' : pessoas(c.comunidade)}.`
}

export function opcoesDeVisibilidade(c: Contagem): Opcao<VisibilidadeDeOracao>[] {
  return (Object.keys(NOME_DA_VISIBILIDADE) as VisibilidadeDeOracao[]).map((valor) => ({
    valor,
    rotulo: valor === 'somente_eu' ? 'Somente eu (padrão)' : NOME_DA_VISIBILIDADE[valor],
    descricao: contagemDaVisibilidade(valor, c),
  }))
}

/** Quantas pessoas vão ler (texto para o diálogo de confirmação). */
export function leitores(v: VisibilidadeDeOracao, c: Contagem): string {
  if (v === 'somente_eu') return 'Só você vai poder ler este pedido.'
  const n = v === 'equipe_oracao' ? c.equipe : c.comunidade
  if (n === null) return 'Outras pessoas vão poder ler este pedido.'
  if (n === 0) return 'Hoje ninguém além de você vai poder ler este pedido.'
  return `${pessoas(n)} ${n === 1 ? 'vai' : 'vão'} poder ler este pedido.`
}

export function ampliando(de: VisibilidadeDeOracao, para: VisibilidadeDeOracao): boolean {
  return ORDEM[para] > ORDEM[de]
}
