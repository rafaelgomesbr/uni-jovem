/**
 * Tipos da camada offline (F13, ADR 0005). O formato das operações e das
 * respostas é o contrato de `apps/api/src/rotas/sincronizacao.ts`; o app não
 * reimplementa regra: só guarda, envia e mostra o que o servidor decidiu.
 */
import type {
  InscritoParaCheckin,
  Local,
  RetratoAoVivo,
  TipoDeChecklist,
} from '@/servicos/contratoDosEventos'
import type { PacoteDoRepertorio } from '@/servicos/contratoV3'
import type { StatusDoEvento } from '@uj/dominio'

/** As únicas operações que o servidor aceita offline. Oração nunca está aqui. */
export const TIPOS_DE_OPERACAO = [
  'tarefa.concluir',
  'checklist.marcar',
  'presenca.registrar',
  'ao_vivo.proposta',
  'inscricao.intencao',
] as const
export type TipoDeOperacao = (typeof TIPOS_DE_OPERACAO)[number]

export type ComandoOffline =
  'iniciar' | 'avancar' | 'voltar' | 'ir_para' | 'pausar' | 'retomar' | 'encerrar'

export interface ComandoProposto {
  comando: ComandoOffline
  etapaId?: string
  ocorridoEm: string
}

export type AlvoDaPresencaOffline =
  { codigo: string } | { inscricaoId: string } | { vinculoId: string } | { nomeAvulso: string }

export interface DadosDasOperacoes {
  'tarefa.concluir': { tarefaId: string; concluida: boolean }
  'checklist.marcar': { itemId: string; marcado: boolean }
  'presenca.registrar': { eventoId: string; ocorridaEm: string } & AlvoDaPresencaOffline
  'ao_vivo.proposta': { eventoId: string; versaoBase: number; comandos: ComandoProposto[] }
  'inscricao.intencao': { eventoId: string }
}

/**
 * Dados que ficam só no aparelho e nunca vão para o servidor: a base do ao
 * vivo local (para mostrar as duas linhas do tempo) e o nome de quem foi
 * marcado (para a tela de pendências).
 */
export interface ContextoLocal {
  baseAoVivo?: RetratoAoVivo
  nome?: string
}

interface CamposDaOperacao<T extends TipoDeOperacao> {
  /** UUID v7: chave de idempotência. Reenviar a mesma chave nunca duplica. */
  chave: string
  tipo: T
  /** Gravados na criação: trocar de comunidade nunca muda o destino da operação. */
  comunidadeId: string
  vinculoId: string
  criadaEm: string
  dados: DadosDasOperacoes[T]
  /** Evento a que a operação se refere (para agrupar na tela). */
  eventoId: string | null
  /** Texto humano, sem dado sensível: "Concluir a tarefa Comprar o brinde". */
  descricao: string
  contexto: ContextoLocal
}

export type NovaOperacao = { [T in TipoDeOperacao]: CamposDaOperacao<T> }[TipoDeOperacao]

export type EstadoDaOperacao = 'pendente' | 'rejeitada' | 'conflito'

export type OperacaoNaFila = NovaOperacao & {
  estado: EstadoDaOperacao
  /** Quantas vezes já foi enviada. Maior que zero: pode ter chegado ao servidor. */
  tentativas: number
  motivo: string | null
  mensagem: string | null
  /** Estado atual do servidor, quando a resposta é `conflito`. */
  estadoDoServidor: unknown
}

/** O que a pessoa quer fazer; a fila completa com chave, comunidade, vínculo e hora. */
export type NovaAcao = {
  [T in TipoDeOperacao]: {
    tipo: T
    dados: DadosDasOperacoes[T]
    eventoId: string | null
    descricao: string
    contexto?: ContextoLocal
  }
}[TipoDeOperacao]

// ------------------------------------------------------------ respostas do servidor

export type SituacaoDaOperacao = 'aceita' | 'ja_aplicada' | 'rejeitada' | 'conflito'

export interface ResultadoDaOperacao {
  chave: string | null
  status: SituacaoDaOperacao
  motivo?: string
  mensagem?: string
  estado?: unknown
  resultado?: unknown
}

export interface RespostaDasOperacoes {
  resultados: ResultadoDaOperacao[]
  servidorEm: string
}

export interface RespostaDasMudancas {
  recomecar: boolean
  mudancas: { tabela: string; id: string; operacao: string; momento: string }[]
  cursor: string
  temMais: boolean
}

interface ComNome {
  vinculoId: string | null
  nome: string | null
}

/** `GET .../eventos/:eventoId/pacote-offline`: o mínimo para o dia do evento. */
export interface PacoteOffline {
  geradoEm: string
  validadeDias: number
  validoAte: string
  cursor: string
  vinculoId: string | null
  evento: {
    id: string
    titulo: string
    descricao: string | null
    categoria: string
    inicio: string
    duracaoMin: number
    fuso: string
    status: StatusDoEvento
    motivoStatus: string | null
    capacidade: number | null
    informacoesUteis: string | null
    versao: number
    local: Local | null
  }
  etapas: {
    id: string
    ordem: number
    titulo: string
    descricao: string | null
    duracaoMin: number
    versao: number
  }[]
  atribuicoes: (ComNome & {
    id: string
    etapaId: string | null
    funcao: string
    estado: string
  })[]
  tarefas: (ComNome & {
    id: string
    titulo: string
    prazo: string | null
    concluidaEm: string | null
    versao: number
  })[]
  checklist: (ComNome & {
    id: string
    tipo: TipoDeChecklist
    texto: string
    ordem: number
    marcadoEm: string | null
    versao: number
  })[]
  materiais: (ComNome & {
    id: string
    item: string
    quantidade: string | null
    providenciadoEm: string | null
    versao: number
  })[]
  aoVivo: RetratoAoVivo
  /** Só para a organização (lista de entrada com telefone mascarado). */
  checkin: {
    inscritos: InscritoParaCheckin[]
    membros: { vinculoId: string; nome: string; presente: boolean }[]
  } | null
}

export interface PacoteGuardado {
  eventoId: string
  pacote: PacoteOffline
  baixadoEm: string
  validoAte: string
}

export interface ResumoDoPacote {
  eventoId: string
  titulo: string
  inicio: string
  duracaoMin: number
  fuso: string
  baixadoEm: string
  validoAte: string
}

/**
 * Repertório do encontro guardado para tocar sem internet (modo músico, fatia 2). Vive na mesma
 * partição cifrada do pacote do encontro e sai junto com ela. Traz a cifra: nunca vai a log.
 */
export interface RepertorioGuardado {
  eventoId: string
  pacote: PacoteDoRepertorio
  baixadoEm: string
  validoAte: string
}

/** O que a tela precisa para dizer "Pronto para tocar sem internet", sem carregar a cifra. */
export interface ResumoDoRepertorioGuardado {
  eventoId: string
  versao: string
  titulo: string
  inicio: string
  fuso: string
  musicas: number
  /** Quantas músicas do repertório têm PDF e quantos deles já estão guardados na versão atual. */
  pdfs: number
  pdfsBaixados: number
  baixadoEm: string
  validoAte: string
}

/** Um PDF de música guardado no banco cifrado (D76). Traz os bytes: nunca vai a log. */
export interface PdfGuardado {
  versao: string
  nome: string
  bytes: Uint8Array
}

// ------------------------------------------------------------ partições

export interface MetaDaParticao {
  contaId: string
  comunidadeId: string
  /** Vínculo da conta nesta comunidade (vem do pacote). Sem ele, nada entra na fila. */
  vinculoId: string | null
  validadeDias: number
  validoAte: string
  /** Cursor `(xact, id)` do log de mudanças (D13). */
  cursor: string | null
  ultimaSincronizacao: string | null
}

export interface RegistroDaParticao {
  contaId: string
  comunidadeId: string
  validoAte: string
}

export interface Particao {
  readonly contaId: string
  readonly comunidadeId: string
  meta(): Promise<MetaDaParticao>
  atualizarMeta(
    mudanca: Partial<Omit<MetaDaParticao, 'contaId' | 'comunidadeId'>>,
  ): Promise<MetaDaParticao>
  /** `repetida` quando a chave já está na fila: a mesma operação nunca entra duas vezes. */
  enfileirar(op: NovaOperacao): Promise<'nova' | 'repetida'>
  operacoes(): Promise<OperacaoNaFila[]>
  atualizarOperacao(
    chave: string,
    mudanca: Partial<
      Pick<OperacaoNaFila, 'estado' | 'tentativas' | 'motivo' | 'mensagem' | 'estadoDoServidor'>
    > & { dados?: NovaOperacao['dados'] },
  ): Promise<void>
  removerOperacao(chave: string): Promise<void>
  gravarPacote(pacote: PacoteOffline, baixadoEm: string): Promise<void>
  lerPacote(eventoId: string): Promise<PacoteGuardado | null>
  pacotes(): Promise<ResumoDoPacote[]>
  removerPacote(eventoId: string): Promise<void>
  /** Guarda (ou troca) o repertório do encontro. A versão vem junto, para só baixar de novo se mudar. */
  gravarRepertorio(pacote: PacoteDoRepertorio, baixadoEm: string): Promise<void>
  lerRepertorio(eventoId: string): Promise<RepertorioGuardado | null>
  /** Todos os repertórios guardados, com a cifra (para o Meu repertório sem internet). */
  repertorios(): Promise<RepertorioGuardado[]>
  /** Só o resumo de cada um, sem a cifra. */
  resumoDosRepertorios(): Promise<ResumoDoRepertorioGuardado[]>
  /** Tira o repertório e os PDFs dele (a cópia inteira sai junto). */
  removerRepertorio(eventoId: string): Promise<void>
  /** Guarda (ou troca) o PDF de uma música deste repertório. */
  gravarPdf(
    eventoId: string,
    musicaId: string,
    pdf: { versao: string; nome: string },
    bytes: Uint8Array,
    baixadoEm?: string,
  ): Promise<void>
  /** O PDF guardado da música: o da `versao` pedida, ou o mais recente que houver. Sem a rede. */
  lerPdf(musicaId: string, versao?: string): Promise<PdfGuardado | null>
  /** Música e versão de cada PDF guardado deste encontro (sem ler os bytes). */
  versoesDosPdfs(eventoId: string): Promise<Record<string, string>>
  /** Apaga os PDFs deste encontro que não são de nenhuma das músicas em `manter`. */
  removerPdfsForaDe(eventoId: string, manter: readonly string[]): Promise<void>
}

export interface ParticaoVencida {
  registro: RegistroDaParticao
  operacoes: OperacaoNaFila[]
}

export interface DepositoLocal {
  /** `false` na web (nada fica guardado) e em binário sem SQLCipher. */
  readonly disponivel: boolean
  /** Por que não há modo offline (para a tela explicar). */
  readonly motivoIndisponivel: string | null
  /** Abre a partição existente. Vencida: apaga e devolve `null` (bloqueada). */
  abrir(contaId: string, comunidadeId: string, agora?: Date): Promise<Particao | null>
  /** Cria a partição (chave aleatória nova no Keychain/Keystore) ou abre a existente. */
  criar(
    dados: {
      contaId: string
      comunidadeId: string
      vinculoId: string | null
      validadeDias: number
    },
    agora?: Date,
  ): Promise<Particao>
  listar(): Promise<RegistroDaParticao[]>
  apagar(contaId: string, comunidadeId: string): Promise<void>
  /** Apaga as vencidas e devolve o que estava pendente nelas (para a tela mostrar). */
  apagarVencidas(agora?: Date): Promise<ParticaoVencida[]>
  apagarOutrasContas(contaId: string): Promise<void>
  apagarTudo(): Promise<void>
}
