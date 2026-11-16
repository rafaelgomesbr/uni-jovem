/**
 * Formato das respostas da API para oração, sugestões, conteúdos, avisos,
 * relatórios, exportações, notificações, privacidade e denúncias (F14 a F18).
 * Só tipos: as regras moram na API e em `@uj/dominio`. Datas chegam como ISO.
 */
import type { TipoDeNotificacao, VisibilidadeDeOracao } from '@uj/dominio'

// ------------------------------------------------------------ oração

export type FiltroDeOracao = 'todos' | 'meus' | 'outros'
export type FiltroDeRespondidos = 'incluir' | 'ocultar' | 'somente'

export interface PedidoDeOracao {
  id: string
  /** `null` quando o servidor não conseguiu decifrar (aparece sem o texto). */
  texto: string | null
  visibilidade: VisibilidadeDeOracao
  quemVe: string
  minha: boolean
  /** Publicado como anônimo (D55): o nome só aparece para a própria autora. */
  anonimo: boolean
  /** `null` quando é anônimo (para todos, inclusive equipe e liderança) e não é seu. */
  autorNome: string | null
  respondidoEm: string | null
  criadoEm: string
  atualizadoEm: string
  versao: number
  orando: { total: number; euEstouOrando: boolean; pessoas: string[] }
}

// ------------------------------------------------------------ sugestões

export const STATUS_DA_SUGESTAO = ['recebida', 'em_analise', 'aceita', 'recusada'] as const
export type StatusDaSugestao = (typeof STATUS_DA_SUGESTAO)[number]

export interface Sugestao {
  id: string
  anonima: boolean
  titulo: string
  texto: string
  status: StatusDaSugestao
  resposta: string | null
  respondidaEm: string | null
  respondidaPorNome: string | null
  /** `null` quando é anônima (para todos, inclusive a liderança) e não é sua. */
  autorNome: string | null
  minha: boolean
  criadoEm: string
  atualizadoEm: string
  versao: number
}

// ------------------------------------------------------------ conteúdos

export type TipoDeConteudo = 'musicas' | 'musicos' | 'palestrantes' | 'dinamicas'

interface Base {
  id: string
  versao: number
  criadoEm: string
  atualizadoEm: string
}

export interface Musica extends Base {
  titulo: string
  artista: string | null
  tom: string | null
  link: string | null
  /** Só no detalhe. */
  cifra?: string | null
  observacoes: string | null
  arquivada: boolean
  musicos: { id: string; nome: string }[]
}

export interface Musico extends Base {
  nome: string
  instrumentos: string[] | null
  vinculoId: string | null
  observacoes: string | null
  ativo: boolean
}

export interface Palestrante extends Base {
  nome: string
  temas: string | null
  origem: string | null
  vinculoId: string | null
  observacoes: string | null
  ativo: boolean
}

export interface Dinamica extends Base {
  titulo: string
  objetivo: string | null
  /** Só no detalhe. */
  instrucoes?: string | null
  duracaoMin: number | null
  materiais: string | null
  arquivada: boolean
}

export interface ItensPorTipo {
  musicas: Musica
  musicos: Musico
  palestrantes: Palestrante
  dinamicas: Dinamica
}

// ------------------------------------------------------------ avisos

export type EstadoDoAviso = 'rascunho' | 'publicado' | 'despublicado'

export interface Aviso {
  id: string
  titulo: string
  texto: string
  estado: EstadoDoAviso
  fixado: boolean
  publicadoEm: string | null
  visivelAte: string | null
  criadoEm: string
  atualizadoEm: string
  versao: number
  autorNome: string | null
}

/** Aviso resumido que vem no `GET /inicio`. */
export interface AvisoDoInicio {
  id: string
  titulo: string
  texto: string
  fixado: boolean
  publicadoEm: string
}

// ------------------------------------------------------------ relatórios

export type Agrupamento = 'semana' | 'mes'

export interface PeriodoDoRelatorio {
  de: string
  ate: string
  fuso: string
  hoje: string
  agrupar?: Agrupamento
}

export interface RelatorioDePresenca {
  periodo: PeriodoDoRelatorio
  totais: { eventos: number; presentes: number; mediaPorEvento: number; membrosDistintos: number }
  porPeriodo: {
    inicio: string
    eventos: number
    presentes: number
    membrosDistintos: number
    mediaPorEvento: number
  }[]
  porEvento: {
    id: string
    titulo: string
    categoria: string
    inicio: string
    status: string
    presentes: number
    presentesInscritos: number
    presentesMembros: number
    presentesSemInscricao: number
  }[]
}

export interface RelatorioDeInscricoes {
  periodo: PeriodoDoRelatorio
  totais: {
    eventos: number
    eventosRealizados: number
    confirmadas: number
    espera: number
    canceladas: number
    compareceram: number
    faltaram: number
    presentesSemInscricao: number
    taxaDeComparecimento: number | null
  }
  porEvento: {
    id: string
    titulo: string
    inicio: string
    status: string
    capacidade: number | null
    realizado: boolean
    confirmadas: number
    espera: number
    canceladas: number
    publicas: number
    deMembros: number
    compareceram: number
    presentesSemInscricao: number
    faltaram: number | null
    taxaDeComparecimento: number | null
  }[]
}

export interface RelatorioDeEscalas {
  periodo: PeriodoDoRelatorio
  totais: {
    escalas: number
    confirmadas: number
    recusadas: number
    semResposta: number
    substituicaoPedida: number
    cumpridas: number
    cumpridasComPresenca: number
    substituicoesPedidas: number
    substituicoesAssumidas: number
    substituicoesCanceladas: number
    substituicoesAbertas: number
  }
  porPessoa: {
    vinculoId: string
    nome: string
    escalas: number
    confirmadas: number
    recusadas: number
    cumpridas: number
    substituicoesPedidas: number
    substituicoesAssumidas: number
  }[]
}

export interface RelatorioDeAtividade {
  periodo: PeriodoDoRelatorio
  atividade: {
    eventosRealizados: number
    eventosPrevistos: number
    eventosCancelados: number
    inscricoes: number
    presencas: number
    novosVinculos: number
    avisosPublicados: number
    sugestoesRecebidas: number
    sugestoesAceitas: number
    substituicoesPedidas: number
  }
}

export const TIPOS_DE_EXPORTACAO = ['presenca', 'inscricoes', 'escalas', 'membros'] as const
export type TipoDeExportacao = (typeof TIPOS_DE_EXPORTACAO)[number]

export interface Exportacao {
  id: string
  tipo: TipoDeExportacao
  comContatos: boolean
  filtros: { de?: string; ate?: string }
  nomeArquivo: string
  linhas: number
  criadoEm: string
  expiraEm: string
  baixadaEm: string | null
  downloads: number
}

export interface ExportacaoGerada {
  id: string
  /** Só existe na resposta da geração: o app guarda em memória para baixar. */
  token: string
  nomeArquivo: string
  linhas: number
  expiraEm: string
  baixar: { metodo: 'POST'; caminho: string }
}

// ------------------------------------------------------------ notificações

export interface PreferenciasDaConta {
  versiculo: { ativo: boolean; hora: string }
  aparelhoAtual: { registrado: true; plataforma: string; desde: string } | { registrado: false }
}

export interface PreferenciasDaComunidade {
  todas: boolean
  tipos: { tipo: TipoDeNotificacao; ativo: boolean }[]
}

// ------------------------------------------------------------ privacidade e denúncias

export type FaixaEtaria = '18_mais' | '16_17' | 'menos_16'

export type RecursoDenunciavel = 'pedido_oracao' | 'sugestao' | 'aviso'
export type MotivoDaDenuncia = 'ofensivo' | 'dados_de_terceiros' | 'spam' | 'risco' | 'outro'
export type EstadoDaDenuncia = 'aberta' | 'procedente' | 'improcedente'

export interface Denuncia {
  id: string
  recursoTipo: RecursoDenunciavel
  recursoId: string
  motivo: MotivoDaDenuncia
  detalhe: string | null
  estado: EstadoDaDenuncia
  resolucao: string | null
  conteudoRetirado: boolean
  resolvidaEm: string | null
  criadoEm: string
}
