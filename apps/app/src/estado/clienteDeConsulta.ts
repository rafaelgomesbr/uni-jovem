import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'

import { ErroDaApi } from '@/servicos/erros'

/** Chaves de cache. Tudo que é de comunidade leva o id dela na chave (isolamento). */
export const CHAVES = {
  eu: ['eu'] as const,
  aparelhos: ['eu', 'aparelhos'] as const,
  comunidade: (id: string) => ['c', id] as const,
  membros: (id: string) => ['c', id, 'membros'] as const,
  convites: (id: string) => ['c', id, 'convites'] as const,
  plataforma: ['plataforma', 'comunidades'] as const,
  inicio: (id: string) => ['c', id, 'inicio'] as const,
  /** Prefixo de todas as listas de eventos (para invalidar de uma vez). */
  eventos: (id: string) => ['c', id, 'eventos'] as const,
  eventosNoPeriodo: (id: string, de: string | null, ate: string | null) =>
    ['c', id, 'eventos', 'periodo', de, ate] as const,
  evento: (id: string, eventoId: string) => ['c', id, 'evento', eventoId] as const,
  locais: (id: string) => ['c', id, 'locais'] as const,
  modelos: (id: string) => ['c', id, 'modelos'] as const,
  serie: (id: string, serieId: string) => ['c', id, 'serie', serieId] as const,
  minhasEscalas: (id: string) => ['c', id, 'minhas-escalas'] as const,
  substituicoes: (id: string) => ['c', id, 'substituicoes'] as const,
  disponibilidade: (id: string, de: string, ate: string) =>
    ['c', id, 'disponibilidade', de, ate] as const,
  aoVivo: (id: string, eventoId: string) => ['c', id, 'ao-vivo', eventoId] as const,
  inscricoes: (id: string, eventoId: string) => ['c', id, 'inscricoes', eventoId] as const,
  minhaInscricao: (id: string, eventoId: string) => ['c', id, 'minha-inscricao', eventoId] as const,
  /** As próprias inscrições (`GET /inscricoes/eu`), para o Início. */
  minhasInscricoes: (id: string) => ['c', id, 'minhas-inscricoes'] as const,
  checkin: (id: string, eventoId: string) => ['c', id, 'checkin', eventoId] as const,
  presencas: (id: string, eventoId: string) => ['c', id, 'presencas', eventoId] as const,
  /** Prefixo de tudo que é pedido de oração (nunca persistido; ver `oracao/consultas`). */
  oracao: (id: string) => ['c', id, 'oracao'] as const,
  sugestoes: (id: string) => ['c', id, 'sugestoes'] as const,
  conteudos: (id: string, tipo: string) => ['c', id, 'conteudos', tipo] as const,
  avisos: (id: string) => ['c', id, 'avisos'] as const,
  relatorio: (id: string, tipo: string, filtros: Record<string, string>) =>
    ['c', id, 'relatorio', tipo, filtros] as const,
  exportacoes: (id: string) => ['c', id, 'exportacoes'] as const,
  preferenciasDeNotificacao: (id: string) => ['c', id, 'notificacoes', 'preferencias'] as const,
  denuncias: (id: string, estado: string) => ['c', id, 'denuncias', estado] as const,
  /** Preferências da conta (versículo) e o aparelho registrado para push. */
  notificacoesDaConta: ['eu', 'notificacoes'] as const,
  /** Caixa de entrada do sino (todas as comunidades da conta) e o contador; prefixo ['eu', 'caixa']. */
  paginasDaCaixa: ['eu', 'caixa', 'paginas'] as const,
  notificacoesNaoLidas: ['eu', 'caixa', 'nao-lidas'] as const,
}

export function criarClienteDeConsulta(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Erro da API é resposta definitiva (permissão, validação): repetir não ajuda.
        retry: (falhas, erro) => !(erro instanceof ErroDaApi) && falhas < 2,
      },
      mutations: {
        retry: false,
        // A1: o padrão (`online`) PAUSA a mutação sem rede e a envia sozinha quando
        // a rede volta: o botão gira para sempre e o aviso (com push) sai minutos
        // depois sem a pessoa saber. Com `always`, o pedido tenta na hora, falha
        // com `SemConexao` e a tela mostra "Sem conexão". O que precisa esperar a
        // rede tem fila própria e explícita (offline, D30), nunca esta pausa.
        networkMode: 'always',
      },
    },
  })
}

/**
 * Liga o React Query à rede (NetInfo) e ao primeiro plano (AppState) no
 * celular. Na web ele já usa os eventos do navegador.
 */
export function ligarGerentesDoReactQuery(): () => void {
  if (Platform.OS === 'web') return () => {}
  onlineManager.setEventListener((definirOnline) =>
    NetInfo.addEventListener((estado) => {
      definirOnline(estado.isConnected !== false)
    }),
  )
  const assinatura = AppState.addEventListener('change', (estado) => {
    focusManager.setFocused(estado === 'active')
  })
  return () => assinatura.remove()
}
