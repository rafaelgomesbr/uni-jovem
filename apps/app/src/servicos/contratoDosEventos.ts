/**
 * Formato das respostas da API para eventos, séries, escalas, Início, ao vivo
 * e inscrições (F7 a F12). Só tipos: as regras moram na API e em `@uj/dominio`.
 * Datas chegam como texto ISO (o JSON não tem tipo de data).
 */
import type {
  EstadoAoVivo,
  ItemDeChecklistDoModelo,
  ModeloEmbutido,
  RegraDeRecorrencia,
  StatusDoEvento,
} from '@uj/dominio'

import type { AvisoDoInicio } from './contratoDosModulos'

export type Visibilidade = 'interna' | 'publica'
export type TipoDeLocal = 'interno' | 'externo'

/** Item da lista `GET /eventos`. */
export interface ResumoDoEvento {
  id: string
  titulo: string
  categoria: string
  inicio: string
  duracaoMin: number
  fuso: string
  status: StatusDoEvento
  visibilidade: Visibilidade
  serieId: string | null
  versao: number
  localNome: string | null
  localTipo: TipoDeLocal | null
  quantidadeDeEtapas: number
}

export interface Local {
  id: string
  nome: string
  tipo: TipoDeLocal
  endereco: string | null
  latitude: number | null
  longitude: number | null
  referencia: string | null
  arquivado?: boolean
  versao?: number
}

export interface Etapa {
  id: string
  ordem: number
  titulo: string
  descricao: string | null
  duracaoMin: number
  versao: number
  inicioPrevisto: string
  fimPrevisto: string
}

export type EstadoDaAtribuicao = 'pendente' | 'confirmada' | 'recusada' | 'substituicao_pedida'

export interface Atribuicao {
  id: string
  etapaId: string | null
  vinculoId: string
  funcao: string
  estado: EstadoDaAtribuicao
  nome: string
}

interface ComResponsavel {
  responsavelVinculoId: string | null
  responsavelNome: string | null
}

export interface Tarefa extends ComResponsavel {
  id: string
  titulo: string
  descricao: string | null
  prazo: string | null
  concluidaEm: string | null
  versao: number
}

export interface Material extends ComResponsavel {
  id: string
  nome: string
  quantidade: string | null
  providenciadoEm: string | null
  versao: number
}

export type TipoDeChecklist = 'preparacao' | 'encerramento'

export interface ItemDeChecklist extends ComResponsavel {
  id: string
  tipo: TipoDeChecklist
  texto: string
  ordem: number
  marcadoEm: string | null
  versao: number
}

export interface Anexo {
  id: string
  tipo: 'link'
  titulo: string
  url: string
  criadoEm: string
}

export interface NotaInterna {
  id: string
  texto: string
  criadoEm: string
  autorContaId: string
}

/** `GET /eventos/:id`. Notas internas vêm vazias para quem não é organizador. */
export interface DetalheDoEvento {
  id: string
  titulo: string
  descricao: string | null
  categoria: string
  inicio: string
  duracaoMin: number
  fuso: string
  status: StatusDoEvento
  motivoStatus: string | null
  visibilidade: Visibilidade
  capacidade: number | null
  inscricaoAte: string | null
  listaDeEspera: boolean
  informacoesUteis: string | null
  serieId: string | null
  versao: number
  idPublico: string
  local: Local | null
  etapas: Etapa[]
  atribuicoes: Atribuicao[]
  tarefas: Tarefa[]
  materiais: Material[]
  checklist: ItemDeChecklist[]
  anexos: Anexo[]
  notas: NotaInterna[]
}

export interface ModeloDaComunidade {
  id: string
  nome: string
  categoria: string
  descricao: string | null
  etapas: { titulo: string; duracaoMin: number; descricao?: string | null }[]
  checklist: ItemDeChecklistDoModelo[]
}

export interface RespostaDeModelos {
  embutidos: ModeloEmbutido[]
  daComunidade: ModeloDaComunidade[]
}

/** `GET /series/:id`. Esta rota responde em snake_case (colunas da tabela). */
export interface DetalheDaSerie {
  id: string
  regra: RegraDeRecorrencia
  hora_local: string
  fuso: string
  duracao_min: number
  inicio_em: string
  fim_em: string | null
  titulo: string
  descricao: string | null
  categoria: string
  local_id: string | null
  versao: number
  /** Encerrada: não recebe mais alterações (a API responde 409 `serie_encerrada`). */
  estado: 'ativa' | 'encerrada'
  encerrada_em: string | null
  ocorrencias: {
    id: string
    inicio: string
    status: StatusDoEvento
    editadoIndividualmente: boolean
  }[]
}

// ------------------------------------------------------------ Início e escalas

export interface EventoDoInicio {
  id: string
  titulo: string
  categoria: string
  inicio: string
  duracaoMin: number
  status: StatusDoEvento
  localNome: string | null
  localTipo: TipoDeLocal | null
}

export interface EscalaDoInicio {
  id: string
  funcao: string
  estado: EstadoDaAtribuicao
  eventoId: string
  eventoTitulo: string
  eventoInicio: string
  etapaTitulo: string | null
}

export interface TarefaDoInicio {
  id: string
  titulo: string
  prazo: string | null
  eventoId: string
  eventoTitulo: string
}

export interface RespostaDoInicio {
  proximosEventos: EventoDoInicio[]
  minhasEscalas: EscalaDoInicio[]
  minhasTarefas: TarefaDoInicio[]
  substituicoesAbertas: number
  /** Avisos publicados, fixados primeiro. Opcional: API antiga não manda. */
  avisos?: AvisoDoInicio[]
}

/** `GET /convocacoes/aguardando-resposta` (D57): só contagens, para a organização. */
export interface EncontroAguardandoResposta {
  id: string
  titulo: string
  inicio: string
  fuso: string
  /** Convocados que ainda não responderam. */
  pendentes: number
  /** Convocados que avisaram que não podem ir. */
  recusadas: number
}

export interface MinhaEscala extends EscalaDoInicio {
  eventoStatus: StatusDoEvento
  /** Id do pedido de substituição em aberto, se houver. */
  substituicaoAberta: string | null
}

export interface Substituicao {
  id: string
  pedidaPor: string
  minha: boolean
  possoAssumir: boolean
  dirigida: boolean
  motivo: string | null
  funcao: string
  evento: { id: string; titulo: string; inicio: string }
  etapa: string | null
}

export interface Disponibilidade {
  vinculo_id: string
  data: string
  disponivel: boolean
  observacao: string | null
  nome: string | null
}

// ------------------------------------------------------------ ao vivo

export type SituacaoDaEtapaAoVivo = 'concluida' | 'atual' | 'proxima'

export interface EtapaAoVivo {
  id: string
  titulo: string
  duracaoMin: number
  inicioPrevisto: string
  fimPrevisto: string
  inicioReal: string | null
  situacao: SituacaoDaEtapaAoVivo
}

export interface RetratoAoVivo extends EstadoAoVivo {
  evento: { id: string; titulo: string; status: StatusDoEvento; inicio: string }
  versao: number
  condutor: { vinculoId: string; nome: string | null; ate: string } | null
  souCondutor: boolean
  atrasoMin: number | null
  etapas: EtapaAoVivo[]
  /** Relógio do servidor no momento da resposta (corrige o relógio do aparelho). */
  agora: string
}

export type ComandoDoAoVivo =
  'assumir' | 'liberar' | 'iniciar' | 'avancar' | 'voltar' | 'pausar' | 'retomar' | 'encerrar'

// ------------------------------------------------------------ inscrições e presença

export type EstadoDaInscricao = 'confirmada' | 'espera' | 'cancelada'

export interface Inscricao {
  id: string
  origem: 'publica' | 'membro'
  nome: string
  telefone: string | null
  email: string | null
  estado: EstadoDaInscricao
  codigoCheckin: string
  criadoEm: string
  promovidaEm: string | null
  presente: boolean
}

export interface ListaDeInscricoes {
  contagem: { confirmadas: number; espera: number; presentes: number }
  inscricoes: Inscricao[]
}

/** Resposta de `POST /inscricoes/eu` (idempotente: devolve a existente). */
export interface MinhaInscricao {
  inscricaoId: string
  estado: EstadoDaInscricao
  codigoCheckin: string
}

/** Item de `GET /inscricoes/eu` (as próprias inscrições, com o evento). */
export interface InscricaoMinha extends MinhaInscricao {
  criadaEm: string
  presente: boolean
  evento: {
    id: string
    titulo: string
    inicio: string
    duracaoMin: number
    fuso: string
    status: StatusDoEvento
    localNome: string | null
  }
}

export interface RespostaDasMinhasInscricoes {
  inscricoes: InscricaoMinha[]
}

export interface InscritoParaCheckin {
  inscricaoId: string
  vinculoId: string | null
  nome: string
  /** Já mascarado pela API. */
  telefone: string | null
  codigo: string
  estado: EstadoDaInscricao
  presente: boolean
}

export interface ListaDeCheckin {
  inscritos: InscritoParaCheckin[]
  membros: { vinculoId: string; nome: string; presente: boolean }[]
  geradoEm: string
}

export interface Presenca {
  id: string
  origem: 'qr' | 'manual' | 'offline'
  ocorridaEm: string
  inscricaoId: string | null
  vinculoId: string | null
  nome: string | null
}

export interface ListaDePresencas {
  total: number
  presencas: Presenca[]
}
