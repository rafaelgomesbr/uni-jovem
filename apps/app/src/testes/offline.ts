/**
 * Apoio dos testes da camada offline: o cofre (SecureStore dublado), o
 * "disco" do SQLite dublado, um pacote de evento fictício e um servidor de
 * sincronização falso que guarda as chaves já aplicadas (como o de verdade).
 */
import * as SecureStore from 'expo-secure-store'

import type {
  PacoteOffline,
  RespostaDasMudancas,
  ResultadoDaOperacao,
} from '@/funcionalidades/offline/tipos'
import type { ClienteDaApi } from '@/servicos/api'
import { ErroDaApi, SemConexao } from '@/servicos/erros'

import { eventoDeTeste, EVENTO_ID, retratoDeTeste } from './fixturas'
import type * as SqliteFalso from './sqliteFalso'
import { MEU_VINCULO, PESSOAS } from './telas'

/** O mesmo módulo que o `expo-sqlite` dublado usa (ver `jest.setup.ts`). */
export const sqlite = jest.requireMock<typeof SqliteFalso>('expo-sqlite')

export const cofre = (SecureStore as unknown as { __cofre: Map<string, string> }).__cofre

export function limparAparelho(): void {
  sqlite.__limpar()
  cofre.clear()
}

export const DIA_MS = 24 * 3600_000

export function pacoteDeTeste(parcial: Partial<PacoteOffline> = {}): PacoteOffline {
  const e = eventoDeTeste()
  const geradoEm = new Date().toISOString()
  return {
    geradoEm,
    validadeDias: 7,
    validoAte: new Date(Date.now() + 7 * DIA_MS).toISOString(),
    cursor: '1000:0',
    vinculoId: MEU_VINCULO,
    evento: {
      id: e.id,
      titulo: e.titulo,
      descricao: e.descricao,
      categoria: e.categoria,
      inicio: e.inicio,
      duracaoMin: e.duracaoMin,
      fuso: e.fuso,
      status: e.status,
      motivoStatus: e.motivoStatus,
      capacidade: e.capacidade,
      informacoesUteis: e.informacoesUteis,
      versao: e.versao,
      local: e.local,
    },
    etapas: e.etapas.map(({ id, ordem, titulo, descricao, duracaoMin, versao }) => ({
      id,
      ordem,
      titulo,
      descricao,
      duracaoMin,
      versao,
    })),
    atribuicoes: e.atribuicoes.map((a) => ({ ...a })),
    tarefas: e.tarefas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      vinculoId: t.responsavelVinculoId,
      nome: t.responsavelNome,
      prazo: t.prazo,
      concluidaEm: t.concluidaEm,
      versao: t.versao,
    })),
    checklist: [
      {
        id: 'chk-1',
        tipo: 'preparacao',
        texto: 'Ligar o projetor',
        ordem: 0,
        vinculoId: MEU_VINCULO,
        nome: 'Ana Souza',
        marcadoEm: null,
        versao: 1,
      },
    ],
    materiais: [],
    aoVivo: retratoDeTeste({
      situacao: 'nao_iniciado',
      etapaAtualId: null,
      etapaIniciadaEm: null,
      iniciadoEm: null,
      condutor: null,
      souCondutor: false,
      atrasoMin: null,
      versao: 0,
      etapas: retratoDeTeste().etapas.map((x) => ({ ...x, inicioReal: null, situacao: 'proxima' })),
    }),
    checkin: {
      inscritos: [
        {
          inscricaoId: 'insc-1',
          vinculoId: null,
          nome: 'Davi Rocha',
          telefone: '(11) •••••-4321',
          codigo: 'A1B2C3D4E5',
          estado: 'confirmada',
          presente: false,
        },
      ],
      membros: PESSOAS.map((p) => ({ vinculoId: p.vinculoId, nome: p.nome, presente: false })),
    },
    ...parcial,
  }
}

interface OperacaoEnviada {
  chave: string
  tipo: string
  vinculoId: string
  criadaEm: string
  dados: Record<string, unknown>
}

export interface OpcoesDoServidor {
  /** Resposta para uma operação nova (padrão: `aceita`). */
  responder?: (op: OperacaoEnviada) => Omit<ResultadoDaOperacao, 'chave'>
  validadeOfflineDias?: number
  mudancas?: (cursor: string) => RespostaDasMudancas
  pacote?: () => PacoteOffline
  /** Comunidades que respondem 404 (vínculo revogado). */
  revogadas?: string[]
}

/**
 * Servidor de sincronização falso. Guarda o conteúdo de cada chave aplicada:
 * a mesma chave com o mesmo conteúdo vira `ja_aplicada` e nunca é aplicada
 * de novo (é o que o servidor de verdade faz em `uj.sync_operacoes`).
 */
export function servidorDeSincronizacao(opcoes: OpcoesDoServidor = {}) {
  const aplicadas = new Map<string, string>()
  const efeitos: OperacaoEnviada[] = []
  const lotes: { caminho: string; operacoes: OperacaoEnviada[] }[] = []
  const leituras: string[] = []
  const controle = { perderAProximaResposta: false, semRede: false }

  const revogada = (caminho: string) =>
    (opcoes.revogadas ?? []).some((id) => caminho.startsWith(`/api/v1/c/${id}`))

  const naoEncontrado = () => new ErroDaApi(404, 'nao_encontrado', 'Não encontrado.')

  const post = jest.fn(async <T>(caminho: string, corpo?: unknown): Promise<T> => {
    if (controle.semRede) throw new SemConexao()
    if (revogada(caminho)) throw naoEncontrado()
    const { operacoes } = corpo as { operacoes: OperacaoEnviada[] }
    lotes.push({ caminho, operacoes })
    const resultados = operacoes.map((op) => {
      const { chave: _chave, ...resto } = op
      const conteudo = JSON.stringify(resto)
      const anterior = aplicadas.get(op.chave)
      if (anterior !== undefined) {
        return anterior === conteudo
          ? { chave: op.chave, status: 'ja_aplicada' as const }
          : {
              chave: op.chave,
              status: 'rejeitada' as const,
              motivo: 'chave_com_conteudo_diferente',
              mensagem: 'Esta alteração já foi enviada com outro conteúdo.',
            }
      }
      const r = opcoes.responder?.(op) ?? { status: 'aceita' as const }
      if (r.status === 'aceita') {
        aplicadas.set(op.chave, conteudo)
        efeitos.push(op)
      }
      return { chave: op.chave, ...r }
    })
    // A resposta se perde no caminho, mas o servidor já aplicou.
    if (controle.perderAProximaResposta) {
      controle.perderAProximaResposta = false
      throw new SemConexao()
    }
    return { resultados, servidorEm: new Date().toISOString() } as T
  })
  const get = jest.fn(async <T>(caminho: string): Promise<T> => {
    if (controle.semRede) throw new SemConexao()
    leituras.push(caminho)
    if (revogada(caminho)) throw naoEncontrado()
    if (caminho.includes('/sync/mudancas')) {
      const cursor = decodeURIComponent(caminho.split('cursor=')[1] ?? '0:0')
      return (opcoes.mudancas?.(cursor) ?? {
        recomecar: false,
        mudancas: [],
        cursor,
        temMais: false,
      }) as T
    }
    if (caminho.endsWith('/pacote-offline')) return (opcoes.pacote ?? pacoteDeTeste)() as T
    const id = caminho.split('/')[4] ?? ''
    return {
      id,
      nome: 'Jovens Centro',
      cor: '#5B4BDB',
      fuso: 'America/Sao_Paulo',
      estado: 'ativa',
      validadeOfflineDias: opcoes.validadeOfflineDias ?? 7,
      retencaoInscricoesDias: 90,
      versao: 1,
      meuPapel: 'organizador',
    } as T
  })
  // O jest.fn perde o genérico da assinatura: o cliente é o mesmo par, tipado como o de verdade.
  const cliente = {
    post: post as unknown as ClienteDaApi['post'],
    get: get as unknown as ClienteDaApi['get'],
  }
  return { cliente, post, get, aplicadas, efeitos, lotes, leituras, controle }
}

export { EVENTO_ID, MEU_VINCULO }
