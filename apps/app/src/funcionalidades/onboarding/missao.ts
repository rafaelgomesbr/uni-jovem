import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Papel } from '@uj/dominio'

import { gravarPreferenciaLocal, lerPreferenciaLocal } from '@/estado/preferenciaLocal'
import { useSessao } from '@/estado/sessao'

/**
 * "Mapa da missão" (F17): um passeio curto pelo app, por papel, com dados de
 * exemplo SÓ EM MEMÓRIA. Nada aqui chama rota de escrita da API; o progresso
 * fica no aparelho (preferência de interface). Sem pontos nem ranking.
 */

export type Demonstracao =
  'evento' | 'escala' | 'oracao' | 'aoVivo' | 'checkin' | 'aviso' | 'convite' | null

export interface Etapa {
  id: string
  titulo: string
  texto: string
  demo: Demonstracao
}

const BOAS_VINDAS: Etapa = {
  id: 'boas-vindas',
  titulo: 'Boas-vindas',
  texto:
    'Este é um passeio rápido pelo que você vai usar. Tudo aqui é exemplo: nada muda os dados da sua comunidade. Dá para pausar e voltar depois.',
  demo: null,
}

const AGENDA: Etapa = {
  id: 'agenda',
  titulo: 'Agenda e programação',
  texto:
    'Cada encontro tem etapas com horário: boas-vindas, louvor, estudo. Na Agenda você vê o mês e a linha do tempo do dia.',
  demo: 'evento',
}

const ESCALA: Etapa = {
  id: 'escala',
  titulo: 'Sua escala',
  texto:
    'Quando escalarem você, confirme ou recuse. Se não puder ir, peça substituição: alguém da equipe assume.',
  demo: 'escala',
}

const ORACAO: Etapa = {
  id: 'oracao',
  titulo: 'Pedidos de oração',
  texto:
    'Todo pedido começa visível só para você. Você decide se a equipe de oração ou a comunidade pode ler, e o app explica quem vê antes de publicar.',
  demo: 'oracao',
}

const AVISOS: Etapa = {
  id: 'avisos',
  titulo: 'Avisos e sugestões',
  texto:
    'Os avisos da organização aparecem no Início, os fixados primeiro. Tem uma ideia? Mande uma sugestão, se quiser sem mostrar seu nome.',
  demo: 'aviso',
}

const MONTAR: Etapa = {
  id: 'montar',
  titulo: 'Montar a programação',
  texto:
    'Comece pelo Sábado padrão e ajuste as etapas. Para reordenar, use os botões subir e descer.',
  demo: 'evento',
}

const AO_VIVO: Etapa = {
  id: 'ao-vivo',
  titulo: 'Conduzir ao vivo',
  texto:
    'No dia, a tela Ao vivo mostra a etapa atual, o tempo e o atraso. Uma pessoa conduz por vez; as outras acompanham.',
  demo: 'aoVivo',
}

const CHECKIN: Etapa = {
  id: 'checkin',
  titulo: 'Presença',
  texto:
    'Na entrada, leia o QR Code da inscrição ou busque pelo nome e toque em "Marcar presença". Marcar de novo não duplica.',
  demo: 'checkin',
}

const CONVITE: Etapa = {
  id: 'convite',
  titulo: 'Convidar pessoas',
  texto:
    'Cada pessoa entra por um convite com papel definido: membro, organizador ou administrador. O link vale por pouco tempo e pode ser revogado.',
  demo: 'convite',
}

export const ETAPAS_POR_PAPEL: Readonly<Record<Papel, readonly Etapa[]>> = {
  membro: [BOAS_VINDAS, AGENDA, ESCALA, ORACAO, AVISOS],
  organizador: [BOAS_VINDAS, MONTAR, ESCALA, AO_VIVO, CHECKIN, AVISOS],
  admin: [BOAS_VINDAS, MONTAR, ESCALA, AO_VIVO, CHECKIN, CONVITE, AVISOS],
}

export type EstadoDaMissao = 'nao_iniciado' | 'em_andamento' | 'pausado' | 'concluido' | 'pulado'

export interface ProgressoDaMissao {
  estado: EstadoDaMissao
  etapa: number
  /** Missões de configuração marcadas pela própria pessoa (ex.: conferiu o próximo evento). */
  feitas: string[]
}

export const PROGRESSO_INICIAL: ProgressoDaMissao = { estado: 'nao_iniciado', etapa: 0, feitas: [] }

const chave = (contaId: string) => `uj.missao.${contaId}`

export function useProgressoDaMissao() {
  const { conta } = useSessao()
  const contaId = conta?.id ?? ''
  const consultas = useQueryClient()
  const chaveDeCache = ['local', 'missao', contaId] as const
  const progresso = useQuery({
    queryKey: chaveDeCache,
    queryFn: async () =>
      (await lerPreferenciaLocal<ProgressoDaMissao>(chave(contaId))) ?? PROGRESSO_INICIAL,
    enabled: contaId !== '',
    staleTime: Infinity,
  })
  const salvar = useMutation({
    mutationFn: async (novo: ProgressoDaMissao) => {
      consultas.setQueryData(chaveDeCache, novo)
      await gravarPreferenciaLocal(chave(contaId), novo)
      return novo
    },
  })
  return {
    progresso: progresso.data ?? null,
    salvar: (novo: ProgressoDaMissao) => salvar.mutate(novo),
  }
}
