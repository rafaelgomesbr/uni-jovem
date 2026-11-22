import type { Href } from 'expo-router'

import { useSessao } from '@/estado/sessao'
import type { NomeDoIcone } from '@/ui/Icone'

import { useMinhasEscalas } from '../escalas/consultas'
import { escalaDeLouvor } from '../repertorio/souDoLouvor'
import { usePode } from './permissoes'

export interface AtalhoDoMural {
  href: Href
  rotulo: string
  descricao: string
  icone: NomeDoIcone
}

export interface AcaoRapida {
  id: 'pedir_oracao' | 'sugerir' | 'novo_aviso' | 'convidar'
  titulo: string
  icone: NomeDoIcone
  href: Href
  /** O que a ação precisa para valer: avisar gente ou publicar texto exige internet. */
  motivoSemInternet: string
}

/**
 * Tudo que a aba Comunidade oferece além do que vem da API do mural, decidido pela
 * matriz de permissões (a API decide de verdade; aqui só se evita oferecer o impossível):
 *
 * - **Ações rápidas:** quem organiza ganha "Novo aviso" e, se a matriz deixa, "Convidar";
 *   o par se completa com "Pedir oração" e "Sugerir uma ideia" quando falta (o organizador
 *   não convida: só a administração cria convite). O membro tem as duas últimas.
 * - **Mais:** Biblioteca, Louvor (só quem toca ou organiza, D62) e Sugestões.
 * - **Organização:** o que a matriz libera, dobrado na tela. Comunidade que não está ativa
 *   (suspensa) não convida nem muda configuração.
 */
export function useAtalhosDoMural(ativa: boolean) {
  const pode = usePode()
  const { comunidadeAtiva } = useSessao()
  const organizaOLouvor = pode('etapa', 'gerenciar')
  // Quem organiza não precisa da lista de convocações para ver o Louvor: nem a pede.
  const minhasEscalas = useMinhasEscalas(organizaOLouvor ? null : (comunidadeAtiva?.id ?? null))
  const veOLouvor = organizaOLouvor || escalaDeLouvor(minhasEscalas.data ?? []) !== null
  const modera = pode('sugestao', 'moderar')

  const pedirOracao: AcaoRapida = {
    id: 'pedir_oracao',
    titulo: 'Pedir oração',
    icone: 'oracao',
    href: '/oracao/novo',
    motivoSemInternet: 'Precisa de internet para publicar. O texto não é guardado no aparelho.',
  }
  const sugerir: AcaoRapida = {
    id: 'sugerir',
    titulo: 'Sugerir uma ideia',
    icone: 'sugestao',
    href: '/sugestoes/nova',
    motivoSemInternet: 'Precisa de internet para enviar a ideia.',
  }
  const daOrganizacao: AcaoRapida[] = [
    ...(pode('aviso', 'publicar')
      ? [
          {
            id: 'novo_aviso' as const,
            titulo: 'Novo aviso',
            icone: 'aviso' as const,
            href: '/avisos/novo' as const,
            motivoSemInternet: 'Precisa de internet para avisar as pessoas.',
          },
        ]
      : []),
    ...(pode('convite', 'criar') && ativa
      ? [
          {
            id: 'convidar' as const,
            titulo: 'Convidar',
            icone: 'convidar' as const,
            href: '/convidar' as const,
            motivoSemInternet: 'Precisa de internet para criar o convite.',
          },
        ]
      : []),
  ]
  const acoes: AcaoRapida[] =
    daOrganizacao.length >= 2
      ? daOrganizacao.slice(0, 2)
      : daOrganizacao.length === 1
        ? [...daOrganizacao, pedirOracao]
        : [pedirOracao, sugerir]

  const mais: AtalhoDoMural[] = [
    {
      href: '/conteudos',
      rotulo: 'Biblioteca',
      descricao: 'Músicas, palestrantes e dinâmicas da comunidade.',
      icone: 'conteudo',
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
      href: '/sugestoes',
      rotulo: 'Sugestões',
      descricao: modera
        ? 'Ideias da comunidade para analisar e responder.'
        : 'Mande uma ideia, se quiser sem mostrar seu nome.',
      icone: 'sugestao',
    },
  ]

  const organizacao: AtalhoDoMural[] = [
    ...(pode('relatorio', 'ler')
      ? [
          {
            href: '/relatorios' as const,
            rotulo: 'Relatórios',
            descricao: 'Presença, inscrições, convocações e atividade.',
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
    ...(pode('comunidade', 'configurar') && ativa
      ? [
          {
            href: '/configurar-comunidade' as const,
            rotulo: 'Configurações',
            descricao: 'Nome, cor, logotipo, cidade e quem pode entrar.',
            icone: 'ajustes' as const,
          },
          {
            href: '/codigo-da-comunidade' as const,
            rotulo: 'Código da comunidade',
            descricao: 'Código, QR e envio pelo WhatsApp.',
            icone: 'qr' as const,
          },
        ]
      : []),
  ]

  return {
    acoes,
    mais,
    organizacao,
    /** "Pedidos de entrada e convites": a administração e o organizador (pedidos) ou só a administração (convites). */
    verPedidosEConvites: pode('pedido_entrada', 'ler') || pode('convite', 'listar'),
    verPedidos: pode('pedido_entrada', 'ler'),
  }
}
