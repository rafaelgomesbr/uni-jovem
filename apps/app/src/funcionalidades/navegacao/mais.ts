import type { Href } from 'expo-router'

import type { NomeDoIcone } from '@/ui/Icone'

import { useSessao } from '@/estado/sessao'

import { usePode } from '../comunidade/permissoes'
import { useMinhasEscalas } from '../escalas/consultas'
import { escalaDeLouvor } from '../repertorio/souDoLouvor'

export interface ItemDoMais {
  href: Href
  rotulo: string
  descricao: string
  icone: NomeDoIcone
}

export interface GrupoDoMais {
  titulo: string
  itens: ItemDoMais[]
}

/**
 * Os módulos da comunidade que não são aba (D57, D68): atalhos na aba
 * Comunidade e, na web larga, na barra lateral. Cada item só aparece para
 * quem pode usá-lo (mesma matriz da API; quem decide é sempre a API).
 */
export function useGruposDoMais(): GrupoDoMais[] {
  const pode = usePode()
  const { comunidadeAtiva } = useSessao()
  // "Louvor" só para quem toca (convocada ao louvor) ou organiza (D62). Quem organiza
  // não precisa da lista de convocações: nem a pede.
  const organizaOLouvor = pode('etapa', 'gerenciar')
  const minhasEscalas = useMinhasEscalas(organizaOLouvor ? null : (comunidadeAtiva?.id ?? null))
  const veOLouvor = organizaOLouvor || escalaDeLouvor(minhasEscalas.data ?? []) !== null
  const comunidade: ItemDoMais[] = [
    {
      href: '/avisos',
      rotulo: 'Avisos',
      descricao: 'Recados da organização.',
      icone: 'aviso',
    },
    {
      href: '/oracao',
      rotulo: 'Pedidos de oração',
      descricao: 'Cada pedido mostra quem pode ler.',
      icone: 'oracao',
    },
    {
      href: '/sugestoes',
      rotulo: 'Sugestões',
      descricao: pode('sugestao', 'moderar')
        ? 'Ideias da comunidade para analisar e responder.'
        : 'Mande uma ideia, se quiser sem mostrar seu nome.',
      icone: 'sugestao',
    },
    ...(veOLouvor
      ? [
          {
            href: '/louvor' as const,
            rotulo: 'Louvor',
            descricao: 'Repertório e cifras do encontro.',
            icone: 'musica' as const,
          },
        ]
      : []),
    {
      href: '/conteudos',
      rotulo: 'Biblioteca',
      descricao: 'Músicas, palestrantes e dinâmicas da comunidade.',
      icone: 'conteudo',
    },
  ]
  const organizacao: ItemDoMais[] = [
    ...(pode('relatorio', 'ler')
      ? [
          {
            href: '/relatorios' as const,
            rotulo: 'Relatórios',
            descricao: 'Presença, inscrições, convocações e atividade; exportar CSV.',
            icone: 'relatorio' as const,
          },
        ]
      : []),
    ...(pode('evento', 'editar')
      ? [
          {
            href: '/locais' as const,
            rotulo: 'Locais',
            descricao: 'Editar e arquivar os locais dos encontros.',
            icone: 'local' as const,
          },
        ]
      : []),
    ...(pode('modelo', 'ler')
      ? [
          {
            href: '/modelos' as const,
            rotulo: 'Modelos',
            descricao: 'Modelos de encontro da comunidade.',
            icone: 'modelo' as const,
          },
        ]
      : []),
    ...(pode('denuncia', 'ler')
      ? [
          {
            href: '/denuncias' as const,
            rotulo: 'Denúncias',
            descricao: 'Conteúdos apontados como problema.',
            icone: 'denuncia' as const,
          },
        ]
      : []),
  ]
  return [
    { titulo: 'Comunidade', itens: comunidade },
    ...(organizacao.length ? [{ titulo: 'Organização', itens: organizacao }] : []),
  ]
}
