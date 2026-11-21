import type { Href } from 'expo-router'

import type { NomeDoIcone } from '@/ui/Icone'

import { usePode } from '../comunidade/permissoes'

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
 * Os módulos da comunidade que não são aba (D57): atalhos no topo da aba
 * Comunidade e, na web larga, na barra lateral. Cada item só aparece para
 * quem pode usá-lo (mesma matriz da API; quem decide é sempre a API).
 */
export function useGruposDoMais(): GrupoDoMais[] {
  const pode = usePode()
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
    {
      href: '/louvor',
      rotulo: 'Louvor',
      descricao: 'Meu repertório, músicas, cifras e o repertório dos encontros.',
      icone: 'musica',
    },
    {
      href: '/conteudos',
      rotulo: 'Conteúdos',
      descricao: 'Músicas, músicos, palestrantes e dinâmicas.',
      icone: 'conteudo',
    },
  ]
  const organizacao: ItemDoMais[] = [
    ...(pode('relatorio', 'ler')
      ? [
          {
            href: '/relatorios' as const,
            rotulo: 'Relatórios',
            descricao: 'Presença, inscrições, escalas e atividade; exportar CSV.',
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
