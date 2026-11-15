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
 * O que não cabe nas cinco abas: "Mais" no celular e na web estreita, e a
 * barra lateral na web larga. Cada item só aparece para quem pode usá-lo
 * (mesma matriz da API; quem decide é sempre a API).
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
      href: '/sugestoes',
      rotulo: 'Sugestões',
      descricao: pode('sugestao', 'moderar')
        ? 'Ideias da comunidade para analisar e responder.'
        : 'Mande uma ideia, se quiser sem mostrar seu nome.',
      icone: 'sugestao',
    },
    {
      href: '/oracao',
      rotulo: 'Oração',
      descricao: 'Pedidos de oração. Cada um mostra quem vê.',
      icone: 'oracao',
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
            descricao: 'Modelos de programação da comunidade.',
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

/** Atalhos pessoais (no "Mais" do celular; na web larga ficam no Perfil). */
export const ITENS_PESSOAIS: readonly ItemDoMais[] = [
  {
    href: '/conta',
    rotulo: 'Perfil e segurança',
    descricao: 'Seus dados, código extra ao entrar e aparelhos.',
    icone: 'perfil',
  },
  {
    href: '/notificacoes',
    rotulo: 'Notificações',
    descricao: 'O que o app avisa, por tipo e por comunidade.',
    icone: 'sino',
  },
  {
    href: '/versiculo',
    rotulo: 'Versículo do dia',
    descricao: 'Ligar, desligar e escolher o horário.',
    icone: 'versiculo',
  },
  {
    href: { pathname: '/missao', params: { rever: '1' } },
    rotulo: 'Mapa da missão',
    descricao: 'Rever o passeio pelo app.',
    icone: 'missao',
  },
  {
    href: '/pendencias',
    rotulo: 'Pendências e uso sem internet',
    descricao: 'Sincronizar, resolver conflitos e ver o que está guardado no aparelho.',
    icone: 'sincronizar',
  },
  {
    href: '/privacidade',
    rotulo: 'Privacidade e dados',
    descricao: 'Exportar seus dados, documentos e excluir a conta.',
    icone: 'seguranca',
  },
]
