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
  /** Sob o prefixo dos eventos: qualquer mudança num encontro (convocar, publicar) recarrega. */
  aguardandoResposta: (id: string) => ['c', id, 'eventos', 'aguardando-resposta'] as const,
  /** Sob o prefixo dos eventos: convocar, responder, concluir tarefa ou registrar presença recarrega. */
  visaoGeral: (id: string, escopo: 'minha' | 'comunidade') =>
    ['c', id, 'eventos', 'visao-geral', escopo] as const,
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
  /** ADR 0007: os próprios pedidos de entrada (da conta, fora de qualquer comunidade). */
  meusPedidos: ['eu', 'pedidos'] as const,
  /** Busca de comunidades que escolheram aparecer; o item tocado vira a "encontrada". */
  buscaDeComunidades: (q: string, cidade: string) => ['comunidades', 'busca', q, cidade] as const,
  comunidadeEncontrada: (idPublico: string) => ['comunidades', 'encontrada', idPublico] as const,
  /** Pedidos pendentes da comunidade (admin e organizador). */
  pedidosDeEntrada: (id: string) => ['c', id, 'pedidos'] as const,
  /** Código da comunidade (admin): nunca persistido. */
  codigoDaComunidade: (id: string) => ['c', id, 'codigo'] as const,
  /** Lista paginada da Plataforma, por filtro; o prefixo é `plataforma`. */
  listaDaPlataforma: (verificacao: string, busca: string) =>
    ['plataforma', 'comunidades', verificacao, busca] as const,
  denunciasDeComunidade: ['plataforma', 'denuncias-de-comunidade'] as const,
}

/** Novas tentativas de uma leitura que falhou por rede ou tempo (escritas não repetem). */
export const LEITURAS_NOVAS_TENTATIVAS = 1

export function criarClienteDeConsulta(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Erro da API é resposta definitiva (permissão, validação): repetir não ajuda.
        // Só a falta de rede/tempo esgotado tenta mais UMA vez (D58): duas repetições de 20 s
        // deixavam a tela carregando por um minuto antes do "Tentar de novo".
        retry: (falhas, erro) => !(erro instanceof ErroDaApi) && falhas < LEITURAS_NOVAS_TENTATIVAS,
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
